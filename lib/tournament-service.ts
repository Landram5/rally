import {suggestSeeds,type SeedMatch} from './seeding';
import {AppError} from './rally-errors';
import {createDraw,recordFixture,resetFixture,withdrawPlayer,outcome,type Draw} from './tournament-engine';
type Tournament={id:string;name:string;club_id:string;date:string;format:string;capacity:number;status:string;best_of:number;state_json:string|null;revision:number;last_operation:string|null};
const bad=(status:number,message:string):never=>{throw new AppError(status,message)};
const validId=(v:unknown)=>{if(typeof v!=='string'||!v||v.length>80||!/^[a-zA-Z0-9_-]+$/.test(v))bad(400,'Invalid identifier.');return v as string};
export async function tournamentAction(db:D1Database,user:{id:string},body:Record<string,unknown>){
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args),eventId=validId(body.id),action=body.action as string;
 const t=await q('SELECT * FROM tournaments WHERE id=?',eventId).first<Tournament>();if(!t)bad(404,'Tournament not found.');const event=t!;
 const operationId=body.operationId===undefined?crypto.randomUUID():validId(body.operationId),payload=JSON.stringify(body);
 const previous=await q('SELECT actor_id,tournament_id,payload FROM tournament_operations WHERE id=?',operationId).first<{actor_id:string;tournament_id:string;payload:string}>();
 if(previous){if(previous.actor_id!==user.id||previous.tournament_id!==eventId||previous.payload!==payload)bad(409,'This action ID was already used.');return {ok:true,id:eventId}}
 if(body.revision!==undefined&&body.revision!==event.revision)bad(409,'The tournament changed. Refresh it before trying again.');
 const membership=await q("SELECT role FROM memberships WHERE club_id=? AND player_id=? AND status='active'",event.club_id,user.id).first<{role:string}>(),isAdmin=!!membership&&['owner','admin','board'].includes(membership.role);
 const participants=(await q('SELECT player_id FROM entries WHERE tournament_id=? ORDER BY created_at,id',eventId).all<{player_id:string}>()).results.map(e=>e.player_id);
 const before:Draw|null=event.state_json?JSON.parse(event.state_json):null;let after=before,status=event.status,bestOf=event.best_of,capacity=event.capacity;const extra:D1PreparedStatement[]=[];
 const guard='EXISTS (SELECT 1 FROM tournaments WHERE id=? AND last_operation=?)';
 if(action==='set_capacity'){
  if(!isAdmin)bad(403,'Only an organizer can change the player limit.');
  if(event.status!=='registration')bad(409,'The player limit is locked after play starts.');
  if(!Number.isSafeInteger(body.capacity)||(body.capacity as number)<Math.max(2,participants.length))bad(400,'Enter a whole number of at least 2, not smaller than the current field.');
  capacity=body.capacity as number;
 }else if(action==='add_tournament_guest'){
  if(!isAdmin)bad(403,'Only an organizer can add a guest.');
  if(event.status!=='registration')bad(409,'Registration is closed.');
  if(participants.length>=capacity)bad(409,'This tournament is full. Increase its player limit first.');
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>60)bad(400,'Enter a guest name of 1–60 characters.');
  const playerId=crypto.randomUUID(),created=new Date().toISOString();
  extra.push(q(`INSERT INTO profiles (id,name,created_at) SELECT ?,?,? WHERE ${guard}`,playerId,(body.name as string).trim(),created,eventId,operationId));
  extra.push(q(`INSERT INTO memberships (id,club_id,player_id,role,status,created_at) SELECT ?,?,?,'guest','active',? WHERE ${guard}`,crypto.randomUUID(),event.club_id,playerId,created,eventId,operationId));
  extra.push(q(`INSERT INTO entries (id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard}`,crypto.randomUUID(),eventId,playerId,created,eventId,operationId));
 }else if(action==='enter_tournament'||action==='remove_entry'){
  if(event.status!=='registration')bad(409,'Registration is closed. The draw is locked.');
  const playerId=validId(body.playerId);if(!isAdmin&&playerId!==user.id)bad(403,'Only an organizer can change another player’s entry.');
  if(action==='enter_tournament'){
   if(!await q("SELECT id FROM memberships WHERE club_id=? AND player_id=? AND status='active'",event.club_id,playerId).first())bad(403,'The player must be an active member of the host club.');
   if(!participants.includes(playerId)&&participants.length>=event.capacity)bad(409,'This tournament is full.');
   extra.push(q(`INSERT INTO entries (id,tournament_id,player_id,created_at) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(tournament_id,player_id) DO NOTHING`,crypto.randomUUID(),eventId,playerId,new Date().toISOString(),eventId,operationId));
  }else extra.push(q(`DELETE FROM entries WHERE tournament_id=? AND player_id=? AND ${guard}`,eventId,playerId,eventId,operationId));
 }else{
  if(!isAdmin)bad(403,'Only a club administrator can run this tournament.');
  try{
   if(action==='start_tournament'){
    if(event.status!=='registration')bad(409,'This tournament has already started.');
    const seeds=body.seeds??suggestSeeds(participants,(await q("SELECT m.*,t.rating_weight AS tournament_weight FROM matches m LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.status='confirmed' AND m.club_id=?",event.club_id).all<SeedMatch>()).results).map(s=>s.id);if(!Array.isArray(seeds)||seeds.length!==participants.length||new Set(seeds).size!==seeds.length||seeds.some(p=>typeof p!=='string'||!participants.includes(p)))bad(400,'The seed list must contain every registered player exactly once.');
    bestOf=Number(body.bestOf);const thirdPlace=body.thirdPlace===true;if(body.thirdPlace!==undefined&&typeof body.thirdPlace!=='boolean')bad(400,'Choose whether to include a third-place playoff.');after=createDraw(seeds as string[],event.format,bestOf,thirdPlace);
   }else{
    if(!before)bad(409,'Start the tournament first.');
    if(action==='score_fixture'){
     if(event.status!=='active')bad(409,'This tournament is completed. Reset a result before changing it.');
     after=recordFixture(before!,validId(body.fixtureId),body.games,body.forfeitWinner===undefined?undefined:validId(body.forfeitWinner));
    }else if(action==='reset_fixture')after=resetFixture(before!,validId(body.fixtureId));
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
 const statements=[q(`UPDATE tournaments SET state_json=?,status=?,best_of=?,capacity=?,rating_weight=CASE WHEN ? THEN (SELECT CASE WHEN count(DISTINCT e.player_id)>=2 AND count(DISTINCT m.club_id)>=2 THEN 3 ELSE 2 END FROM entries e JOIN memberships m ON m.player_id=e.player_id JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=e.player_id WHERE e.tournament_id=tournaments.id AND m.status='active' AND m.role!='guest' AND c.approval_status='approved' AND p.deleted_at IS NULL) ELSE rating_weight END,revision=revision+1,last_operation=? WHERE id=? AND revision=?`,afterJson,status,bestOf,capacity,action==='start_tournament'?1:0,operationId,eventId,event.revision),...extra];
 // Every mutation after the compare-and-swap uses the same operation guard.
 // A stale writer therefore cannot partially update fixtures, standings or history.
 if(after){for(const fixture of after.fixtures){
  const old=before?.fixtures.find(f=>f.id===fixture.id);if(JSON.stringify(old)===JSON.stringify(fixture))continue;
  const matchId=`t_${eventId}_${fixture.id}`;
  if(fixture.status==='played'){
   statements.push(q(`INSERT INTO matches (id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,tournament_id,created_at) SELECT ?,?,?,?,?,?,?,'confirmed',?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET a=excluded.a,b=excluded.b,games=excluded.games,best_of=excluded.best_of,played_on=excluded.played_on,status='confirmed',submitted_by=excluded.submitted_by,confirmed_by=excluded.confirmed_by`,matchId,event.club_id,fixture.a,fixture.b,JSON.stringify(fixture.games),bestOf,now.slice(0,10),user.id,user.id,eventId,now,eventId,operationId));
   statements.push(q(`INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),matchId,user.id,'tournament_result',now,eventId,operationId));
  }else if(old?.status==='played'){
   statements.push(q(`UPDATE matches SET status='voided' WHERE id=? AND tournament_id=? AND ${guard}`,matchId,eventId,eventId,operationId));
   statements.push(q(`INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),matchId,user.id,'tournament_reset',now,eventId,operationId));
  }
 }}
 statements.push(q(`INSERT INTO tournament_operations (id,tournament_id,actor_id,action,payload,before_state,after_state,revision,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`,operationId,eventId,user.id,action,payload,event.state_json,afterJson,event.revision+1,now,eventId,operationId));
 const results=await db.batch(statements);if(results[0].meta.changes!==1)bad(409,'Another organizer changed this tournament. Refresh and try again.');return {ok:true,id:eventId,status};
}
