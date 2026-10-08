import {AppError} from './rally-errors';
import {scoreError} from './match-rules';
const fail=(status:number,message:string):never=>{throw new AppError(status,message)};
const id=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value))fail(400,'Invalid identifier.');return value as string;};
const note=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>500)fail(400,'Explain your request in 1–500 characters.');return (value as string).trim();};
type Row={id:string;club_id:string;a:string;b:string;games:string;best_of:number;played_on:string;status:string;revision:number;tournament_id:string|null};
export type Ownership={claims:{id:string;guest_id:string;claimant_id:string;club_id:string;guestName:string;claimantName:string;evidence:string;status:string;canReview:boolean}[];reviews:{requested_by?:string;id:string;match_id:string;note:string;proposed_games:string|null;status:string;resolution:string;requesterName:string;canReview:boolean}[]};
export async function readOwnership(db:D1Database,me:string):Promise<Ownership>{
 const leader="EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=c.club_id AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board'))";
 const claims=(await db.prepare(`SELECT c.*,COALESCE(NULLIF(c.guest_name,''),g.name) guestName,p.name claimantName,${leader} canReview FROM guest_claims c JOIN profiles g ON g.id=c.guest_id JOIN profiles p ON p.id=c.claimant_id WHERE c.claimant_id=? OR ${leader} ORDER BY (c.status='pending') DESC,c.created_at DESC LIMIT 100`).bind(me,me,me).all<Ownership['claims'][number]>()).results.map(c=>({...c,canReview:!!c.canReview}));
 const reviewers="EXISTS(SELECT 1 FROM memberships leader WHERE leader.club_id=m.club_id AND leader.player_id=? AND leader.status='active' AND leader.role IN ('owner','admin','board'))";
 const reviews=(await db.prepare(`SELECT r.*,p.name requesterName,${reviewers} canReview FROM match_reviews r JOIN matches m ON m.id=r.match_id JOIN profiles p ON p.id=r.requested_by WHERE r.requested_by=? OR m.a=? OR m.b=? OR ${reviewers} ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100`).bind(me,me,me,me,me).all<Ownership['reviews'][number]>()).results.map(r=>({...r,canReview:!!r.canReview}));
 return {claims,reviews};
}
export async function matchRecord(db:D1Database,me:string,matchId:string){
 const m=await db.prepare('SELECT * FROM matches WHERE id=?').bind(id(matchId)).first<Row>();if(!m)fail(404,'Match unavailable.');
 const admin=!!await db.prepare("SELECT 1 FROM memberships WHERE club_id=? AND player_id=? AND status='active' AND role IN ('owner','admin','board')").bind(m!.club_id,me).first();
 if(m!.a!==me&&m!.b!==me&&!admin)fail(403,'Only the players and club organizers can view this record history.');
 const history=(await db.prepare('SELECT h.*,p.name actorName FROM match_history h JOIN profiles p ON p.id=h.actor_id WHERE h.match_id=? ORDER BY h.created_at,h.id').bind(matchId).all()).results;
 const audit=(await db.prepare('SELECT a.action,a.created_at,p.name actorName FROM audit a JOIN profiles p ON p.id=a.actor_id WHERE a.match_id=? ORDER BY a.created_at,a.id').bind(matchId).all()).results;
 const names=(await db.prepare('SELECT id,name FROM profiles WHERE id IN (?,?)').bind(m!.a,m!.b).all<{id:string;name:string}>()).results;
 const reviews=(await db.prepare("SELECT r.*,p.name requesterName FROM match_reviews r JOIN profiles p ON p.id=r.requested_by WHERE r.match_id=? ORDER BY (r.status='pending') DESC,r.created_at DESC").bind(matchId).all<Ownership['reviews'][number]>()).results.map(r=>({...r,canReview:admin}));
 return {match:m,playerNames:[m!.a,m!.b].map(id=>names.find(p=>p.id===id)?.name??'Player'),canManage:admin,history,audit,reviews};
}
export async function ownershipAction(db:D1Database,user:{id:string},body:Record<string,unknown>){
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args),action=String(body.action),now=new Date().toISOString();
 const leader=async(club:string)=>!!await q("SELECT 1 FROM memberships WHERE club_id=? AND player_id=? AND status='active' AND role IN ('owner','admin','board')",club,user.id).first();
 if(action==='request_guest_claim'){
  const guest=id(body.guestId),club=id(body.clubId),evidence=note(body.note),request=id(body.id);
  if(!await q("SELECT 1 FROM profiles p JOIN memberships m ON m.player_id=p.id JOIN clubs c ON c.id=m.club_id WHERE p.id=? AND p.auth_id IS NULL AND p.deleted_at IS NULL AND m.club_id=? AND m.status='active' AND c.approval_status='approved'",guest,club).first())fail(400,'Choose an active guest in an approved club.');
  const duplicate=await q('SELECT * FROM guest_claims WHERE id=?',request).first<{claimant_id:string;guest_id:string;evidence:string;club_id:string}>();if(duplicate){if(duplicate.claimant_id!==user.id||duplicate.guest_id!==guest||duplicate.evidence!==evidence||duplicate.club_id!==club)fail(409,'Request ID already used.');return {ok:true};}
  if((await q("SELECT count(*) n FROM guest_claims WHERE claimant_id=? AND status='pending'",user.id).first<{n:number}>())!.n>=3)fail(429,'You may have three pending guest claims.');
  if(await q("SELECT 1 FROM guest_claims WHERE guest_id=? AND claimant_id=? AND status='pending'",guest,user.id).first())fail(409,'You already requested this guest record.');
  await q('INSERT INTO guest_claims(id,guest_id,claimant_id,club_id,evidence,created_at,guest_name) VALUES (?,?,?,?,?,?,(SELECT name FROM profiles WHERE id=?))',request,guest,user.id,club,evidence,now,guest).run();return {ok:true};
 }
 if(action==='preview_guest_merge'){
  const claim=await q('SELECT guest_id,claimant_id,club_id FROM guest_claims WHERE id=?',id(body.id)).first<{guest_id:string;claimant_id:string;club_id:string}>();if(!claim)fail(404,'Claim unavailable.');
  if(!await leader(claim!.club_id))fail(403,'Only a club organizer can review this claim.');
  const overlap=await sharedRecords(q,claim!.guest_id,claim!.claimant_id);
  return {ok:true,preview:{voidedMatches:overlap.matches.filter(m=>!m.tournament_id&&m.status!=='voided').map(m=>({id:m.id,playedOn:m.played_on})),voidedDoubles:overlap.doubles.filter(m=>m.status!=='voided').map(m=>({id:m.id,playedOn:m.played_on})),sharedEvents:overlap.events}};
 }
 if(action==='review_guest_claim'){
  const request=id(body.id),claim=await q('SELECT * FROM guest_claims WHERE id=?',request).first<{guest_id:string;claimant_id:string;club_id:string;status:string}>();if(!claim)fail(404,'Claim unavailable.');
  if(!await leader(claim!.club_id))fail(403,'Only a club organizer can review this claim.');if(claim!.claimant_id===user.id)fail(403,'Another organizer must review your own claim.');
  if(!['approved','rejected'].includes(String(body.status)))fail(400,'Choose approval or rejection.');if(claim!.status!=='pending')fail(409,'This claim has already been reviewed.');
  const guest=claim!.guest_id,target=claim!.claimant_id;
  if(body.status==='rejected'){const result=await q("UPDATE guest_claims SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM memberships WHERE club_id=guest_claims.club_id AND player_id=? AND status='active' AND role IN ('owner','admin','board'))",user.id,now,request,user.id).run();if(result.meta.changes!==1)fail(409,'The claim or your access changed. Refresh and try again.');return {ok:true};}
  if(body.confirmation!=='MERGE')fail(400,'Confirm merging the guest history into this account.');
  // Profiles that played each other, or share a tournament, are one person entered twice. With the organizer's explicit
  // repair confirmation, matches between them are voided and, in shared tournaments, the old identity stays as "Deleted player".
  const overlap=await sharedRecords(q,guest,target),repair=body.repair===true;
  if((overlap.matches.length||overlap.events.length||overlap.doubles.length)&&!repair)fail(409,'Both profiles appear in the same match or tournament. Review the repair summary and confirm to merge them.');
  const keep=overlap.events.map(e=>e.id),keepJson=JSON.stringify(keep),untouched='id NOT IN (SELECT id FROM matches WHERE (a=? AND b=?) OR (a=? AND b=?) OR tournament_id IN (SELECT value FROM json_each(?)))',untouchedArgs=[guest,target,target,guest,keepJson];
  const events=(await q('SELECT id,state_json,revision FROM tournaments WHERE id IN (SELECT tournament_id FROM entries WHERE player_id=?) OR instr(COALESCE(state_json,\'\'),?)>0',guest,JSON.stringify(guest)).all<{id:string;state_json:string|null;revision:number}>()).results.filter(t=>!keep.includes(t.id));
  const statements=[q("UPDATE guest_claims SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=guest_claims.club_id AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board')) AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=claimant_id AND p.auth_id IS NOT NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM account_deletions d WHERE d.auth_id=p.auth_id)) AND EXISTS(SELECT 1 FROM profiles g JOIN memberships gm ON gm.player_id=g.id WHERE g.id=guest_id AND g.auth_id IS NULL AND g.deleted_at IS NULL AND gm.club_id=guest_claims.club_id AND gm.status='active') AND NOT EXISTS(SELECT 1 FROM clubs WHERE owner_id=guest_id)"+(repair?'':" AND NOT EXISTS(SELECT 1 FROM matches WHERE (a=guest_id AND b=claimant_id) OR (a=claimant_id AND b=guest_id)) AND NOT EXISTS(SELECT 1 FROM entries g JOIN entries p ON p.tournament_id=g.tournament_id WHERE g.player_id=guest_id AND p.player_id=claimant_id) AND NOT EXISTS(SELECT 1 FROM doubles_matches d WHERE guest_id IN (d.a1,d.a2,d.b1,d.b2) AND claimant_id IN (d.a1,d.a2,d.b1,d.b2)) AND NOT EXISTS(SELECT 1 FROM doubles_teams g JOIN doubles_teams p ON p.tournament_id=g.tournament_id WHERE guest_id IN (g.p1,g.p2) AND claimant_id IN (p.p1,p.p2))"),user.id,now,request,user.id),q('INSERT INTO account_change_guards(changed) VALUES(changes())'),q('UPDATE profiles SET initial_rating=(SELECT initial_rating FROM profiles WHERE id=?),initial_rating_revision=initial_rating_revision+1 WHERE id=? AND initial_rating IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND initial_rating IS NOT NULL)',guest,target,guest),q("UPDATE profiles SET name='Deleted player',deleted_at=?,merged_into=? WHERE id=? AND auth_id IS NULL AND deleted_at IS NULL",now,target,guest),q('INSERT INTO account_change_guards(changed) VALUES(changes())')];
  for(const t of events){statements.push(q('INSERT INTO deletion_revision_guards(tournament_id,expected_revision) VALUES(?,?)',t.id,t.revision));statements.push(q('UPDATE tournaments SET state_json=?,revision=revision+1 WHERE id=?',t.state_json?JSON.stringify(replaceIdentity(JSON.parse(t.state_json),guest,target)):null,t.id));}
  // Repair: a person cannot play themselves, so club matches between the two profiles are voided (and audited) rather than merged.
  for(const m of overlap.matches)if(!m.tournament_id&&m.status!=='voided')statements.push(q("INSERT INTO audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'voided',? FROM matches WHERE id=? AND status!='voided'",crypto.randomUUID(),user.id,now,m.id),q("UPDATE matches SET status='voided',revision=revision+1 WHERE id=? AND status!='voided'",m.id));
  // Doubles matches the two profiles share (as partners or opponents) are voided and left as they were; all others follow the account.
  for(const m of overlap.doubles)if(m.status!=='voided')statements.push(q("INSERT INTO doubles_audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'voided',? FROM doubles_matches WHERE id=? AND status!='voided'",crypto.randomUUID(),user.id,now,m.id),q("UPDATE doubles_matches SET status='voided',revision=revision+1 WHERE id=? AND status!='voided'",m.id));
  for(const column of ['a1','a2','b1','b2','submitted_by','confirmed_by'])statements.push(q(`UPDATE doubles_matches SET ${column}=?,revision=revision+1 WHERE ${column}=? AND id NOT IN (SELECT id FROM doubles_matches d WHERE ? IN (d.a1,d.a2,d.b1,d.b2) AND ? IN (d.a1,d.a2,d.b1,d.b2))`,target,guest,guest,target),q('UPDATE doubles_audit SET actor_id=? WHERE actor_id=?',target,guest));
  // Doubles teams follow the account, except in tournaments both profiles are in (those keep the old identity as a placeholder).
  for(const column of ['p1','p2'])statements.push(q(`UPDATE doubles_teams SET ${column}=? WHERE ${column}=? AND tournament_id NOT IN (SELECT value FROM json_each(?))`,target,guest,keepJson));
  statements.push(q('UPDATE doubles_teams SET created_by=? WHERE created_by=?',target,guest));
  // One guest may belong to several clubs: each migrated membership needs its own key.
  statements.push(q("INSERT OR IGNORE INTO memberships(id,club_id,player_id,role,status,created_at) SELECT 'claim_'||id,club_id,?,'member',status,created_at FROM memberships WHERE player_id=?",target,guest));
  statements.push(q('INSERT OR IGNORE INTO season_players(season_id,player_id,status,created_at) SELECT season_id,?,status,created_at FROM season_players WHERE player_id=?',target,guest),q('DELETE FROM season_players WHERE player_id=?',guest),q('DELETE FROM memberships WHERE player_id=?',guest),q('UPDATE entries SET player_id=? WHERE player_id=? AND tournament_id NOT IN (SELECT value FROM json_each(?))',target,guest,keepJson),q('INSERT OR IGNORE INTO tournament_waitlist(id,tournament_id,player_id,created_at) SELECT \'claim_\'||id,tournament_id,?,created_at FROM tournament_waitlist WHERE player_id=? AND tournament_id NOT IN (SELECT value FROM json_each(?))',target,guest,keepJson),q('DELETE FROM tournament_waitlist WHERE player_id=?',guest),q('DELETE FROM tournament_waitlist WHERE player_id=? AND tournament_id IN (SELECT tournament_id FROM entries WHERE player_id=?)',target,target));
  for(const column of ['a','b','submitted_by','confirmed_by'])statements.push(q(`UPDATE matches SET ${column}=?,revision=revision+1 WHERE ${column}=? AND ${untouched}`,target,guest,...untouchedArgs));
  statements.push(q('UPDATE audit SET actor_id=? WHERE actor_id=?',target,guest),q('UPDATE tournaments SET created_by=? WHERE created_by=?',target,guest),q('UPDATE tournament_operations SET actor_id=? WHERE actor_id=?',target,guest));
  const old=JSON.stringify(guest),replacement=JSON.stringify(target);
  statements.push(q('UPDATE tournament_operations SET payload=replace(payload,?,?),before_state=replace(before_state,?,?),after_state=replace(after_state,?,?) WHERE tournament_id NOT IN (SELECT value FROM json_each(?))',old,replacement,old,replacement,old,replacement,keepJson),q('UPDATE match_history SET actor_id=? WHERE actor_id=?',target,guest),q(`UPDATE match_history SET before_json=replace(before_json,?,?),after_json=replace(after_json,?,?) WHERE match_id ${untouched.replace('id NOT IN','NOT IN')}`,old,replacement,old,replacement,...untouchedArgs),q('DELETE FROM profile_photos WHERE player_id=?',guest),q("UPDATE guest_claims SET status='rejected',reviewed_by=?,reviewed_at=? WHERE guest_id=? AND status='pending'",user.id,now,guest));
  try{await db.batch(statements);}catch{fail(409,'The guest, account, or tournament changed. Refresh before reviewing again.');}return {ok:true};
 }
 const matchId=id(body.matchId),m=await q('SELECT * FROM matches WHERE id=?',matchId).first<Row>();if(!m)fail(404,'Match unavailable.');const admin=await leader(m!.club_id);
 if(action==='request_match_review'){
  if(m!.a!==user.id&&m!.b!==user.id&&!admin)fail(403,'Only a player or organizer may dispute this match.');if(m!.status==='voided')fail(409,'This result is already voided.');
  const message=note(body.note),request=id(body.id),proposed=body.games===undefined?null:JSON.stringify(body.games);
  if(proposed){const error=scoreError(m!.a,m!.b,body.games,m!.best_of);if(error)fail(400,error);}
  const existing=await q('SELECT requested_by,note,match_id,proposed_games FROM match_reviews WHERE id=?',request).first<{requested_by:string;note:string;match_id:string;proposed_games:string|null}>();if(existing){if(existing.requested_by!==user.id||existing.note!==message||existing.match_id!==matchId||existing.proposed_games!==proposed)fail(409,'Request ID already used.');return {ok:true};}
  if(await q("SELECT 1 FROM match_reviews WHERE match_id=? AND requested_by=? AND status='pending'",matchId,user.id).first())fail(409,'You already have an open review for this match.');
  await q('INSERT INTO match_reviews(id,match_id,requested_by,note,proposed_games,match_revision,original_games,created_at) VALUES (?,?,?,?,?,?,?,?)',request,matchId,user.id,message,proposed,m!.revision,m!.games,now).run();return {ok:true};
 }
 if(action!=='correct_match'&&action!=='resolve_match_review')fail(400,'Unknown record action.');
 if(!admin)fail(403,'Only a club organizer can resolve or correct results.');const message=note(body.note);
 if(action==='resolve_match_review'){
  const request=id(body.id),r=await q('SELECT * FROM match_reviews WHERE id=? AND match_id=?',request,matchId).first<{status:string;original_games:string;match_revision:number}>();if(!r||r.status!=='pending')fail(409,'Review already resolved or unavailable.');
  if(body.status!=='resolved'&&body.status!=='rejected')fail(400,'Choose resolved or rejected.');
  if(body.status==='resolved'&&m!.status!=='voided'&&m!.games===r!.original_games)fail(409,'Correct or reset the result before marking the review resolved. Use rejection if the original result is valid.');
  const result=await q("UPDATE match_reviews SET status=?,resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM memberships WHERE club_id=? AND player_id=? AND status='active' AND role IN ('owner','admin','board')) AND EXISTS(SELECT 1 FROM matches WHERE id=? AND revision=?)",body.status,message,user.id,now,request,m!.club_id,user.id,matchId,m!.revision).run();if(result.meta.changes!==1)fail(409,'The review or your access changed. Refresh and try again.');return {ok:true};
 }
 if(m!.tournament_id)fail(409,'Correct tournament results through the draw so later rounds update safely.');if(body.revision!==m!.revision)fail(409,'The result changed. Reopen its history.');if(m!.status==='voided')fail(409,'Record a new match to replace a voided result.');
 const error=scoreError(m!.a,m!.b,body.games,m!.best_of);if(error)fail(400,error);const games=JSON.stringify(body.games);if(games===m!.games)fail(400,'Enter corrected scores.');
 const before=JSON.stringify(m),after=JSON.stringify({...m,games,status:'confirmed',revision:m!.revision+1});
 try{await db.batch([q("UPDATE matches SET games=?,status='confirmed',confirmed_by=?,revision=revision+1 WHERE id=? AND revision=? AND status!='voided' AND EXISTS(SELECT 1 FROM memberships WHERE club_id=matches.club_id AND player_id=? AND status='active' AND role IN ('owner','admin','board'))",games,user.id,matchId,m!.revision,user.id),q('INSERT INTO account_change_guards(changed) VALUES(changes())'),q('INSERT INTO match_history(id,match_id,actor_id,action,note,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),matchId,user.id,'corrected',message,before,after,now),q('INSERT INTO audit(id,match_id,actor_id,action,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),matchId,user.id,'corrected',now)]);}catch{fail(409,'The result or your access changed. Reopen it before correcting.');}return {ok:true};
}
type Query=(sql:string,...args:unknown[])=>{all:<T>()=>Promise<{results:T[]}>};
// Where two profiles that turn out to be one person overlap: matches they played against each other, and tournaments they both entered.
async function sharedRecords(q:Query,guest:string,target:string){
 const matches=(await q('SELECT id,tournament_id,status,played_on FROM matches WHERE (a=? AND b=?) OR (a=? AND b=?) ORDER BY played_on,id',guest,target,target,guest).all<{id:string;tournament_id:string|null;status:string;played_on:string}>()).results;
 const events=(await q("SELECT id,name FROM tournaments WHERE id IN (SELECT g.tournament_id FROM entries g JOIN entries p ON p.tournament_id=g.tournament_id WHERE g.player_id=? AND p.player_id=?) OR id IN (SELECT tournament_id FROM matches WHERE ((a=? AND b=?) OR (a=? AND b=?)) AND tournament_id IS NOT NULL) OR id IN (SELECT g.tournament_id FROM doubles_teams g JOIN doubles_teams p ON p.tournament_id=g.tournament_id WHERE (g.p1=? OR g.p2=?) AND (p.p1=? OR p.p2=?)) ORDER BY date,id",guest,target,guest,target,target,guest,guest,guest,target,target).all<{id:string;name:string}>()).results;
 const doubles=(await q('SELECT id,status,played_on FROM doubles_matches WHERE ? IN (a1,a2,b1,b2) AND ? IN (a1,a2,b1,b2) ORDER BY played_on,id',guest,target).all<{id:string;status:string;played_on:string}>()).results;
 return {matches,events,doubles};
}
function replaceIdentity(value:unknown,old:string,next:string):unknown{
 if(value===old)return next;if(Array.isArray(value))return value.map(v=>replaceIdentity(v,old,next));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k===old?next:k,replaceIdentity(v,old,next)]));return value;
}
