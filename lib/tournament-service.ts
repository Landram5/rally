import {scheduleDraw} from './tournament-scheduling';
import {eventLogistics,optionalText,optionalInstant,registrationClosed} from './logistics';
import {suggestSeeds,type SeedMatch} from './seeding';
import {AppError} from './rally-errors';
import {createDraw,recordFixture,resetFixture,withdrawPlayer,outcome,type Draw} from './tournament-engine';
type Tournament={table_count:number;estimated_match_minutes:number;claim_window_minutes:number;allow_visitors:number;registration_closes_at:string|null;starts_at:string|null;check_in_open:number;id:string;name:string;club_id:string;date:string;format:string;capacity:number;status:string;best_of:number;state_json:string|null;revision:number;last_operation:string|null;created_by:string|null;deleted_at:string|null};
const bad=(status:number,message:string):never=>{throw new AppError(status,message)};
const validId=(v:unknown)=>{if(typeof v!=='string'||!v||v.length>80||!/^[a-zA-Z0-9_-]+$/.test(v))bad(400,'Invalid identifier.');return v as string};
export async function tournamentAction(db:D1Database,user:{id:string},body:Record<string,unknown>){
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args),eventId=validId(body.id),action=body.action as string;
 const t=await q('SELECT * FROM tournaments WHERE id=?',eventId).first<Tournament>();if(!t)bad(404,'Tournament not found.');const event=t!;
 const membership=await q("SELECT m.role FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND p.deleted_at IS NULL",event.club_id,user.id).first<{role:string}>(),isAdmin=!!membership&&['owner','admin','board'].includes(membership.role);
 const canScore=isAdmin||!!membership&&!!await q('SELECT 1 FROM tournament_scorekeepers WHERE tournament_id=? AND player_id=?',eventId,user.id).first();
 const operationId=body.operationId===undefined?crypto.randomUUID():validId(body.operationId),payload=JSON.stringify(body);
 const previous=await q('SELECT actor_id,tournament_id,payload FROM tournament_operations WHERE id=?',operationId).first<{actor_id:string;tournament_id:string;payload:string}>();
 if(previous){if(action==='score_fixture'&&!canScore)bad(403,'Scorekeeping access was removed.');if(previous.actor_id!==user.id||previous.tournament_id!==eventId||previous.payload!==payload)bad(409,'This action ID was already used.');return {ok:true,id:eventId}}
 if(event.deleted_at)bad(404,'Tournament not found.');
 if(body.revision!==undefined&&body.revision!==event.revision)bad(409,'The tournament changed. Refresh it before trying again.');

 if(action==='delete_tournament'){
  if(body.confirmation!=='DELETE')bad(400,'Confirm tournament deletion.');
  if(body.revision===undefined)bad(400,'Refresh the tournament before deleting it.');
  if(!membership||(event.created_by?event.created_by!==user.id:!await q('SELECT id FROM clubs WHERE id=? AND owner_id=?',event.club_id,user.id).first()))bad(403,'Only the tournament creator can delete it. For older tournaments, the club owner can delete it.');
  const now=new Date().toISOString(),guard='EXISTS (SELECT 1 FROM tournaments WHERE id=? AND deleted_at IS NOT NULL AND last_operation=?)';
  const statements=[q(`UPDATE tournaments SET deleted_at=?,revision=revision+1,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM memberships m WHERE m.club_id=tournaments.club_id AND m.player_id=? AND m.status='active') AND (created_by=? OR (created_by IS NULL AND EXISTS (SELECT 1 FROM clubs c WHERE c.id=tournaments.club_id AND c.owner_id=?)))`,now,operationId,eventId,event.revision,user.id,user.id,user.id),
   q(`INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?||id,id,?,'tournament_deleted',? FROM matches WHERE tournament_id=? AND status!='voided' AND ${guard}`,crypto.randomUUID(),user.id,now,eventId,eventId,operationId),
   q(`UPDATE matches SET status='voided' WHERE tournament_id=? AND ${guard}`,eventId,eventId,operationId),
   q(`INSERT INTO tournament_operations (id,tournament_id,actor_id,action,payload,before_state,after_state,revision,created_at) SELECT ?,?,?,?, ?,?,NULL,?,? WHERE ${guard}`,operationId,eventId,user.id,action,payload,event.state_json,event.revision+1,now,eventId,operationId)];
  const results=await db.batch(statements);if(results[0].meta.changes!==1)bad(409,'The tournament or your access changed. Refresh and try again.');return {ok:true,id:eventId,deleted:true};
 }
 const participants=(await q('SELECT player_id FROM entries WHERE tournament_id=? ORDER BY created_at,id',eventId).all<{player_id:string}>()).results.map(e=>e.player_id);
 const before:Draw|null=event.state_json?JSON.parse(event.state_json):null;let after=before,status=event.status,bestOf=event.best_of,capacity=event.capacity;const extra:D1PreparedStatement[]=[];
 const guard='EXISTS (SELECT 1 FROM tournaments WHERE id=? AND last_operation=?)';
 if(action==='set_scorekeeper'){
  if(!isAdmin)bad(403,'Only organizers can appoint scorekeepers.');if(event.status==='completed')bad(409,'This event is completed.');
  const playerId=validId(body.playerId);if(typeof body.enabled!=='boolean')bad(400,'Choose scorekeeper access.');
  if(body.enabled&&!await q("SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND p.auth_id IS NOT NULL AND p.deleted_at IS NULL",event.club_id,playerId).first())bad(400,'Choose an active host-club member with an account.');
  extra.push(body.enabled?q(`INSERT OR IGNORE INTO tournament_scorekeepers(tournament_id,player_id) SELECT ?,? WHERE ${guard}`,eventId,playerId,eventId,operationId):q(`DELETE FROM tournament_scorekeepers WHERE tournament_id=? AND player_id=? AND ${guard}`,eventId,playerId,eventId,operationId));
 }else if(action==='schedule_tournament'){
  if(!isAdmin)bad(403,'Only organizers can schedule matches.');if(event.status!=='active'||!before)bad(409,'Start the draw before scheduling it.');
  const tables=Number(body.tableCount),minutes=Number(body.matchMinutes),requested=optionalInstant(body.startsAt,'schedule start')??event.starts_at??new Date().toISOString(),start=new Date(Math.max(Date.parse(requested),Date.now())).toISOString();
  const existing=(await q('SELECT fixture_id,court,starts_at,ends_at,called_at FROM tournament_fixture_plans WHERE tournament_id=?',eventId).all<{fixture_id:string;court:string;starts_at:string|null;ends_at:string|null;called_at:string|null}>()).results;
  const scheduled=scheduleDraw(before!,tables,minutes,start,existing,new Date().toISOString());
  extra.push(q(`UPDATE tournaments SET table_count=?,estimated_match_minutes=?,estimated_ends_at=? WHERE id=? AND ${guard}`,tables,minutes,scheduled.endsAt,eventId,eventId,operationId));
  extra.push(q(`INSERT INTO tournament_fixture_plans(tournament_id,fixture_id,court,starts_at,ends_at,called_at) SELECT ?,json_extract(value,'$.fixture_id'),json_extract(value,'$.court'),json_extract(value,'$.starts_at'),json_extract(value,'$.ends_at'),json_extract(value,'$.called_at') FROM json_each(?) WHERE ${guard} ON CONFLICT(tournament_id,fixture_id) DO UPDATE SET court=excluded.court,starts_at=excluded.starts_at,ends_at=excluded.ends_at,called_at=excluded.called_at`,eventId,JSON.stringify(scheduled.plans),eventId,operationId));
 }else if(action==='claim_waitlist_place'){
  const playerId=validId(body.playerId??user.id);if(playerId!==user.id&&!isAdmin)bad(403,'Only an organizer can claim a place for another player.');if(registrationClosed(event))bad(409,'Registration is closed.');
  const offer=await q('SELECT 1 FROM eligible_tournament_waitlist WHERE tournament_id=? AND player_id=? AND claim_expires_at>?',eventId,playerId,new Date().toISOString()).first();if(!offer)bad(409,'This offer expired or is no longer available.');if(participants.length>=capacity)bad(409,'This tournament is full.');
  extra.push(q(`INSERT INTO entries(id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard}`,crypto.randomUUID(),eventId,playerId,new Date().toISOString(),eventId,operationId));
  extra.push(q(`DELETE FROM tournament_waitlist WHERE tournament_id=? AND player_id=? AND ${guard}`,eventId,playerId,eventId,operationId));
 }else if(action==='set_registration_policy'){
  if(!isAdmin)bad(403,'Only an organizer can change registration.');if(event.status!=='registration')bad(409,'Registration settings are locked after play starts.');if(typeof body.allowVisitors!=='boolean')bad(400,'Choose visiting-player registration.');
  extra.push(q(`UPDATE tournaments SET allow_visitors=? WHERE id=? AND ${guard}`,body.allowVisitors?1:0,eventId,eventId,operationId));
 }else if(action==='join_waitlist'||action==='leave_waitlist'){
  const playerId=validId(body.playerId);if(playerId!==user.id&&!isAdmin)bad(403,'Only an organizer can change another player’s waitlist entry.');if(event.status!=='registration')bad(409,'The draw is locked.');
  if(action==='join_waitlist'){
   if(registrationClosed(event))bad(409,'Registration is closed.');if(participants.includes(playerId))bad(409,'Already registered.');
   const host=await q("SELECT id FROM memberships WHERE club_id=? AND player_id=? AND status='active'",event.club_id,playerId).first();
   if(!host&&!event.allow_visitors)bad(403,'This event is for host-club members.');
   if(!await q('SELECT id FROM profiles WHERE id=? AND deleted_at IS NULL',playerId).first())bad(400,'Player unavailable.');
   if(participants.length<capacity&&!await q('SELECT id FROM tournament_waitlist WHERE tournament_id=?',eventId).first())bad(409,'A place is available. Register instead.');
   extra.push(q(`INSERT INTO tournament_waitlist(id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(tournament_id,player_id) DO NOTHING`,crypto.randomUUID(),eventId,playerId,new Date().toISOString(),eventId,operationId));
  }else extra.push(q(`DELETE FROM tournament_waitlist WHERE tournament_id=? AND player_id=? AND ${guard}`,eventId,playerId,eventId,operationId));
 }else if(action==='set_event_logistics'){

  if(!isAdmin)bad(403,'Only an organizer can edit event logistics.');if(event.status==='completed')bad(409,'This event is completed.');const values=eventLogistics(body);const claimMinutes=body.claimMinutes===undefined?event.claim_window_minutes:Number(body.claimMinutes);if(!Number.isInteger(claimMinutes)||claimMinutes<5||claimMinutes>1440)bad(400,'Choose a claim window of 5–1,440 minutes.');extra.push(q(`UPDATE tournaments SET claim_window_minutes=? WHERE id=? AND ${guard}`,claimMinutes,eventId,eventId,operationId));
  extra.push(q(`UPDATE tournaments SET registration_closes_at=?,starts_at=?,check_in_open=? WHERE id=? AND ${guard}`,values.registration_closes_at,values.starts_at,values.check_in_open,eventId,eventId,operationId));
 }else if(action==='set_check_in'){
  const playerId=validId(body.playerId);if(!isAdmin&&playerId!==user.id)bad(403,'Only an organizer can check in another player.');if(event.status==='completed'||!event.check_in_open)bad(409,'Check-in is closed.');if(!participants.includes(playerId))bad(400,'Register before checking in.');if(typeof body.checkedIn!=='boolean')bad(400,'Choose a check-in status.');
  extra.push(q(`UPDATE entries SET checked_in_at=? WHERE tournament_id=? AND player_id=? AND ${guard}`,body.checkedIn?new Date().toISOString():null,eventId,playerId,eventId,operationId));
 }else if(action==='set_fixture_plan'){
  if(!isAdmin)bad(403,'Only an organizer can schedule matches.');const fixtureId=validId(body.fixtureId);if(event.status!=='active'||!before?.fixtures.some(f=>f.id===fixtureId&&(f.status==='ready'||f.status==='waiting')))bad(409,'Schedule an upcoming match in an active draw.');if(body.called!==undefined&&typeof body.called!=='boolean')bad(400,'Choose whether to call this match.');
  const court=optionalText(body.court,'Court',60),startsAt=body.called?new Date().toISOString():optionalInstant(body.startsAt,'match time');
  if(body.called){const fixture=before!.fixtures.find(f=>f.id===fixtureId)!;if(fixture.status!=='ready'||!court)bad(409,'Choose a table for a ready match.');
   const called=(await q('SELECT fixture_id,court FROM tournament_fixture_plans WHERE tournament_id=? AND called_at IS NOT NULL',eventId).all<{fixture_id:string;court:string}>()).results;
   if(called.some(p=>p.fixture_id===fixtureId))bad(409,'This match is already called. Record its result or change its assignment first.');
   if(called.some(p=>{const f=before!.fixtures.find(f=>f.id===p.fixture_id);return f?.status==='ready'&&(p.court.trim().toLowerCase()===court.toLowerCase()||[f.a,f.b].some(id=>id&&[fixture.a,fixture.b].includes(id)));}))bad(409,'That table or player already has a called match. Record its result first.');
  }
  extra.push(q(`INSERT INTO tournament_fixture_plans(tournament_id,fixture_id,court,starts_at,ends_at,called_at) SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(tournament_id,fixture_id) DO UPDATE SET court=excluded.court,starts_at=excluded.starts_at,ends_at=excluded.ends_at,called_at=excluded.called_at`,eventId,fixtureId,court,startsAt,startsAt?new Date(Date.parse(startsAt)+event.estimated_match_minutes*60000).toISOString():null,body.called?startsAt:null,eventId,operationId));
 }else if(action==='set_capacity'){
  if(!isAdmin)bad(403,'Only an organizer can change the player limit.');
  if(event.status!=='registration')bad(409,'The player limit is locked after play starts.');
  if(!Number.isSafeInteger(body.capacity)||(body.capacity as number)<Math.max(2,participants.length))bad(400,'Enter a whole number of at least 2, not smaller than the current field.');
  const offers=(await q('SELECT count(*) n FROM eligible_tournament_waitlist WHERE tournament_id=? AND claim_expires_at>?',eventId,new Date().toISOString()).first<{n:number}>())?.n??0;if((body.capacity as number)<participants.length+offers)bad(400,'The limit must also cover places currently offered to waiting players.');capacity=body.capacity as number;
 }else if(action==='add_tournament_guest'){
  if(!isAdmin)bad(403,'Only an organizer can add a guest.');
  if(registrationClosed(event))bad(409,'Registration is closed.');
  if(participants.length>=capacity)bad(409,'This tournament is full. Increase its player limit first.');
  if(await q('SELECT id FROM tournament_waitlist WHERE tournament_id=?',eventId).first())bad(409,'Promote waiting players before adding a guest.');
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>60)bad(400,'Enter a guest name of 1–60 characters.');
  const playerId=crypto.randomUUID(),created=new Date().toISOString();
  extra.push(q(`INSERT INTO profiles (id,name,created_at) SELECT ?,?,? WHERE ${guard}`,playerId,(body.name as string).trim(),created,eventId,operationId));
  extra.push(q(`INSERT INTO memberships (id,club_id,player_id,role,status,created_at) SELECT ?,?,?,'guest','active',? WHERE ${guard}`,crypto.randomUUID(),event.club_id,playerId,created,eventId,operationId));
  extra.push(q(`INSERT INTO entries (id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard}`,crypto.randomUUID(),eventId,playerId,created,eventId,operationId));
 }else if(action==='enter_tournament'||action==='remove_entry'){
  if(event.status!=='registration')bad(409,'Registration is closed. The draw is locked.');
  const playerId=validId(body.playerId);if(!isAdmin&&playerId!==user.id)bad(403,'Only an organizer can change another player’s entry.');
  if(action==='enter_tournament'){
   if(registrationClosed(event))bad(409,'The registration deadline has passed.');
   if(!await q("SELECT id FROM memberships WHERE club_id=? AND player_id=? AND status='active'",event.club_id,playerId).first()&&!event.allow_visitors)bad(403,'This event is for host-club members.');
   if(!await q('SELECT id FROM profiles WHERE id=? AND deleted_at IS NULL',playerId).first())bad(400,'Player unavailable.');
   if(!participants.includes(playerId)&&await q('SELECT id FROM tournament_waitlist WHERE tournament_id=?',eventId).first())bad(409,'Players are waiting for a place. Join the waitlist.');
   if(!participants.includes(playerId)&&participants.length>=event.capacity)bad(409,'This tournament is full.');
   extra.push(q(`INSERT INTO entries (id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(tournament_id,player_id) DO NOTHING`,crypto.randomUUID(),eventId,playerId,new Date().toISOString(),eventId,operationId));
  }else extra.push(q(`DELETE FROM entries WHERE tournament_id=? AND player_id=? AND ${guard}`,eventId,playerId,eventId,operationId));
 }else{
  if(!isAdmin&&!(action==='score_fixture'&&canScore))bad(403,'Only an organizer can run this tournament; assigned scorekeepers can enter scores.');if(!isAdmin&&body.forfeitWinner!==undefined)bad(403,'Only organizers can record forfeits.');
  try{
   if(action==='start_tournament'){
    if(event.status!=='registration')bad(409,'This tournament has already started.');if(!registrationClosed(event)&&await q('SELECT 1 FROM eligible_tournament_waitlist WHERE tournament_id=? AND claim_expires_at>?',eventId,new Date().toISOString()).first())bad(409,'Resolve open waitlist offers or close registration before starting the draw.');
    const seeds=body.seeds??suggestSeeds(participants,(await q("SELECT m.*,t.rating_weight AS tournament_weight,pa.initial_rating a_initial_rating,pb.initial_rating b_initial_rating FROM matches m LEFT JOIN profiles pa ON pa.id=m.a LEFT JOIN profiles pb ON pb.id=m.b LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.status='confirmed' AND m.club_id=?",event.club_id).all<SeedMatch>()).results).map(s=>s.id);if(!Array.isArray(seeds)||seeds.length!==participants.length||new Set(seeds).size!==seeds.length||seeds.some(p=>typeof p!=='string'||!participants.includes(p)))bad(400,'The seed list must contain every registered player exactly once.');
    bestOf=Number(body.bestOf);const thirdPlace=body.thirdPlace===true;if(body.thirdPlace!==undefined&&typeof body.thirdPlace!=='boolean')bad(400,'Choose whether to include a third-place playoff.');after=createDraw(seeds as string[],event.format,bestOf,thirdPlace);
   }else{
    if(!before)bad(409,'Start the tournament first.');
    if(action==='score_fixture'){
     if(event.status!=='active')bad(409,'This tournament is completed. Reset a result before changing it.');
     after=recordFixture(before!,validId(body.fixtureId),body.games,body.forfeitWinner===undefined?undefined:validId(body.forfeitWinner));
    }else if(action==='reset_fixture'){if(typeof body.note!=='string'||!body.note.trim()||body.note.trim().length>500)bad(400,'Explain the reset in 1–500 characters.');after=resetFixture(before!,validId(body.fixtureId));}
    else if(action==='withdraw_player'){
     if(event.status!=='active')bad(409,'Only active tournaments accept withdrawals.');
     after=withdrawPlayer(before!,validId(body.playerId));
    }else bad(400,'Unknown tournament action.');
   }
  }catch(e){if(e instanceof AppError)throw e;bad(400,e instanceof Error?e.message:'Invalid tournament action.')}
  status=outcome(after!).status;
 }
 const now=new Date().toISOString(),afterJson=after?JSON.stringify(after):null;
 if(afterJson&&new TextEncoder().encode(afterJson).length>800000)bad(400,'This draw exceeds the current event storage limit. Split the field into smaller divisions.');
 const privileged=['set_scorekeeper','schedule_tournament','set_registration_policy','set_event_logistics','set_fixture_plan','set_capacity','add_tournament_guest','start_tournament','reset_fixture','withdraw_player'].includes(action)||(['set_check_in','enter_tournament','remove_entry','join_waitlist','leave_waitlist','claim_waitlist_place'].includes(action)&&body.playerId!==user.id);
 const statements=[q(`UPDATE tournaments SET state_json=?,status=?,best_of=?,capacity=?,rating_weight=CASE WHEN ? THEN (SELECT CASE WHEN count(DISTINCT e.player_id)>=2 AND count(DISTINCT m.club_id)>=2 THEN 3 ELSE 2 END FROM entries e JOIN memberships m ON m.player_id=e.player_id JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=e.player_id WHERE e.tournament_id=tournaments.id AND m.status='active' AND m.role!='guest' AND m.club_id!='unaffiliated' AND c.approval_status='approved' AND p.deleted_at IS NULL) ELSE rating_weight END,revision=revision+1,last_operation=? WHERE id=? AND revision=? AND deleted_at IS NULL AND (?=0 OR EXISTS (SELECT 1 FROM memberships WHERE club_id=tournaments.club_id AND player_id=? AND status='active' AND role IN ('owner','admin','board'))) AND (?=0 OR (registration_closes_at IS NULL OR registration_closes_at>?)) AND (?=0 OR (check_in_open=1 AND status!='completed' AND EXISTS (SELECT 1 FROM entries WHERE tournament_id=tournaments.id AND player_id=?))) AND (?=0 OR EXISTS(SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=tournaments.club_id AND m.player_id=? AND m.status='active' AND p.deleted_at IS NULL AND (m.role IN ('owner','admin','board') OR EXISTS(SELECT 1 FROM tournament_scorekeepers sk WHERE sk.tournament_id=tournaments.id AND sk.player_id=m.player_id)))) AND (?=0 OR EXISTS(SELECT 1 FROM eligible_tournament_waitlist w WHERE w.tournament_id=tournaments.id AND w.player_id=? AND w.claim_expires_at>max(?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) AND (SELECT count(*) FROM entries WHERE tournament_id=tournaments.id)<capacity)) AND (?=0 OR EXISTS(SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=tournaments.club_id AND m.player_id=? AND m.status='active' AND p.auth_id IS NOT NULL AND p.deleted_at IS NULL)) AND (?=0 OR ?>=(SELECT count(*) FROM entries WHERE tournament_id=tournaments.id)+(SELECT count(*) FROM eligible_tournament_waitlist WHERE tournament_id=tournaments.id AND claim_expires_at>?)) AND (?=0 OR EXISTS(SELECT 1 FROM profiles p WHERE p.id=? AND p.deleted_at IS NULL AND (allow_visitors=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=tournaments.club_id AND m.player_id=p.id AND m.status='active')))) AND (?=0 OR (registration_closes_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR NOT EXISTS(SELECT 1 FROM eligible_tournament_waitlist WHERE tournament_id=tournaments.id AND claim_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))) AND (?=0 OR (EXISTS(SELECT 1 FROM entries WHERE tournament_id=tournaments.id AND player_id=?) OR ((SELECT count(*) FROM entries WHERE tournament_id=tournaments.id)<capacity AND NOT EXISTS(SELECT 1 FROM tournament_waitlist WHERE tournament_id=tournaments.id))))`,afterJson,status,bestOf,capacity,action==='start_tournament'?1:0,operationId,eventId,event.revision,privileged?1:0,user.id,['enter_tournament','add_tournament_guest','join_waitlist'].includes(action)?1:0,now,action==='set_check_in'&&!isAdmin?1:0,user.id,action==='score_fixture'?1:0,user.id,action==='claim_waitlist_place'?1:0,body.playerId??user.id,now,action==='set_scorekeeper'&&body.enabled?1:0,body.playerId??user.id,action==='set_capacity'?1:0,capacity,now,['enter_tournament','join_waitlist'].includes(action)?1:0,body.playerId??user.id,action==='start_tournament'?1:0,['enter_tournament','add_tournament_guest'].includes(action)?1:0,body.playerId??''),...extra];
 if(action==='start_tournament')statements.push(q(`DELETE FROM tournament_waitlist WHERE tournament_id=? AND ${guard}`,eventId,eventId,operationId));
 // Every mutation after the compare-and-swap uses the same operation guard.
 // A stale writer therefore cannot partially update fixtures, standings or history.
 if(after){for(const fixture of after.fixtures){
  const old=before?.fixtures.find(f=>f.id===fixture.id);if(JSON.stringify(old)===JSON.stringify(fixture))continue;
  statements.push(q(`UPDATE tournament_fixture_plans SET called_at=NULL WHERE tournament_id=? AND fixture_id=? AND ${guard}`,eventId,fixture.id,eventId,operationId));
  const matchId=`t_${eventId}_${fixture.id}`;
  const original=await q('SELECT * FROM matches WHERE id=?',matchId).first<Record<string,unknown>>();
  const history=(snapshot:Record<string,unknown>,label:string)=>q(`INSERT INTO match_history(id,match_id,actor_id,action,note,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),matchId,user.id,label,typeof body.note==='string'?body.note.trim():label==='recorded'?'Official tournament result recorded.':'Updated through the tournament draw.',JSON.stringify(original??{games:'[]',status:'unrecorded'}),JSON.stringify(snapshot),now,eventId,operationId);
  if(fixture.status==='played'){
   statements.push(q(`INSERT INTO matches (id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,tournament_id,created_at) SELECT ?,?,?,?,?,?,?,'confirmed',?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET a=excluded.a,b=excluded.b,games=excluded.games,best_of=excluded.best_of,played_on=excluded.played_on,status='confirmed',revision=matches.revision+1,submitted_by=excluded.submitted_by,confirmed_by=excluded.confirmed_by`,matchId,event.club_id,fixture.a,fixture.b,JSON.stringify(fixture.games),bestOf,now.slice(0,10),user.id,user.id,eventId,now,eventId,operationId));
   statements.push(history({...original,a:fixture.a,b:fixture.b,games:JSON.stringify(fixture.games),status:'confirmed'},original?'replaced':'recorded'));
   statements.push(q(`INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),matchId,user.id,'tournament_result',now,eventId,operationId));
  }else if(old?.status==='played'){
   statements.push(q(`UPDATE matches SET status='voided',revision=revision+1 WHERE id=? AND tournament_id=? AND ${guard}`,matchId,eventId,eventId,operationId));
   statements.push(history({...original,status:'voided'},'reset'));
   statements.push(q(`INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),matchId,user.id,'tournament_reset',now,eventId,operationId));
  }
 }}
 statements.push(q(`INSERT INTO tournament_operations (id,tournament_id,actor_id,action,payload,before_state,after_state,revision,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`,operationId,eventId,user.id,action,payload,event.state_json,afterJson,event.revision+1,now,eventId,operationId));
 const results=await db.batch(statements);if(results[0].meta.changes!==1)bad(409,'Another organizer changed this tournament. Refresh and try again.');return {ok:true,id:eventId,status};
}
