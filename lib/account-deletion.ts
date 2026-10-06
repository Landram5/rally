import {AppError} from './rally-errors';

export type DeletionMode='keep_results'|'remove_history';
type Profile={id:string;name:string};
export type AccountPlan={pending:boolean;clubs:{id:string;name:string;successors:Profile[]}[]};

export async function deletionPending(db:D1Database,authId:string) {
 return !!await db.prepare('SELECT 1 FROM account_deletions WHERE auth_id=?').bind(authId).first();
}

export async function accountPlan(db:D1Database,authId:string):Promise<AccountPlan> {
 if(await deletionPending(db,authId))return {pending:true,clubs:[]};
 const clubs=(await db.prepare('SELECT c.id,c.name FROM clubs c JOIN profiles p ON p.id=c.owner_id WHERE p.auth_id=?').bind(authId).all<{id:string;name:string}>()).results;
 return {pending:false,clubs:await Promise.all(clubs.map(async club=>({...club,successors:(await db.prepare(`
  SELECT p.id,p.name FROM profiles p JOIN memberships m ON m.player_id=p.id
  WHERE m.club_id=? AND m.status='active' AND p.auth_id IS NOT NULL AND p.auth_id!=?
  AND p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM clubs WHERE owner_id=p.id)
  AND NOT EXISTS (SELECT 1 FROM account_deletions WHERE auth_id=p.auth_id) ORDER BY p.name
 `).bind(club.id,authId).all<Profile>()).results})))};
}

export async function transferOwnership(db:D1Database,authId:string,clubId:string,successorId:string) {
 if(await deletionPending(db,authId))throw new AppError(409,'Account deletion is already in progress.');
 const owner=await db.prepare('SELECT p.id FROM clubs c JOIN profiles p ON p.id=c.owner_id WHERE c.id=? AND p.auth_id=? AND p.deleted_at IS NULL').bind(clubId,authId).first<{id:string}>();
 if(!owner)throw new AppError(403,'Only the club owner can transfer ownership.');
 // D1 batches are transactions. Membership changes are conditional on the exact transfer.
 // Concurrent transfer attempts cannot demote a newly selected owner.
 try {
  await db.batch([
   db.prepare(`UPDATE clubs SET owner_id=? WHERE id=? AND owner_id=? AND EXISTS (
    SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=clubs.id
    AND m.player_id=? AND m.status='active' AND p.auth_id IS NOT NULL AND p.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM clubs other WHERE other.owner_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM account_deletions WHERE auth_id=p.auth_id))`).bind(successorId,clubId,owner.id,successorId),
   db.prepare('INSERT INTO account_change_guards (changed) VALUES (changes())'),
   db.prepare("UPDATE memberships SET role='admin' WHERE club_id=? AND player_id=? AND role='owner' ").bind(clubId,owner.id),
   db.prepare('INSERT INTO account_change_guards (changed) VALUES (changes())'),
   db.prepare("UPDATE memberships SET role='owner' WHERE club_id=? AND player_id=? ").bind(clubId,successorId),
   db.prepare('INSERT INTO account_change_guards (changed) VALUES (changes())'),
  ]);
 } catch(error) {
  if(error instanceof AppError)throw error;
  throw new AppError(409,'The club or member changed. Refresh before transferring ownership.');
 }
}

// Replaces exact identifiers in JSON values, never substring-matches arbitrary user text.
function replaceId(value:unknown,oldId:string,newId:string):unknown {
 if(value===oldId)return newId;
 if(Array.isArray(value))return value.map(v=>replaceId(v,oldId,newId));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k===oldId?newId:k,replaceId(v,oldId,newId)]));
 return value;
}

export async function beginDeletion(db:D1Database,authId:string,mode:DeletionMode) {
 if(mode!=='keep_results'&&mode!=='remove_history')throw new AppError(400,'Choose how to handle your player history.');
 if(await deletionPending(db,authId))return;
 const plan=await accountPlan(db,authId);
 if(plan.clubs.length)throw new AppError(409,'Transfer ownership of your clubs before deleting your account.');
 const profile=await db.prepare('SELECT id FROM profiles WHERE auth_id=?').bind(authId).first<{id:string}>();
 const now=new Date().toISOString();
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
 const statements=[q('INSERT INTO account_deletions (auth_id,requested_at) VALUES (?,?)',authId,now)];
 statements.push(q('INSERT INTO account_write_blocks (auth_id,expires_at) VALUES (?,?) ON CONFLICT(auth_id) DO NOTHING',authId,new Date(Date.now()+86400000).toISOString()));
 if(profile) {
  const id=profile.id;
  statements.push(q("UPDATE profiles SET name='Deleted player',auth_id=NULL,deleted_at=? WHERE id=?",now,id));
  statements.push(q('DELETE FROM memberships WHERE player_id=?',id));
  statements.push(q('DELETE FROM notification_preferences WHERE player_id=?',id));
  statements.push(q("UPDATE season_players SET status='withdrawn' WHERE player_id=?",id));
  statements.push(q('DELETE FROM tournament_waitlist WHERE player_id=?',id));
  // Requests contain personal explanations. Remove them when either identity goes.
  statements.push(q('DELETE FROM guest_claims WHERE guest_id=? OR claimant_id=?',id,id));
  statements.push(q('UPDATE guest_claims SET reviewed_by=NULL WHERE reviewed_by=?',id));
  statements.push(q('DELETE FROM match_reviews WHERE requested_by=?',id));
  statements.push(q('UPDATE match_reviews SET resolved_by=NULL WHERE resolved_by=?',id));
  statements.push(q('DELETE FROM match_history WHERE actor_id=?',id));
  statements.push(q('UPDATE profiles SET merged_into=NULL WHERE merged_into=?',id));
  statements.push(q("DELETE FROM entries WHERE player_id=? AND tournament_id IN (SELECT id FROM tournaments WHERE status='registration')",id));
  const openEntries=(await q("SELECT t.id,t.revision FROM tournaments t JOIN entries e ON e.tournament_id=t.id WHERE e.player_id=? AND t.status='registration' AND t.deleted_at IS NULL AND (t.registration_closes_at IS NULL OR t.registration_closes_at>?)",id,now).all<{id:string;revision:number}>()).results;
  for(const event of openEntries){
   const next=await q("SELECT w.id,w.player_id FROM tournament_waitlist w JOIN profiles p ON p.id=w.player_id WHERE w.tournament_id=? AND p.id!=? AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM account_deletions d WHERE d.auth_id=p.auth_id) ORDER BY w.created_at,w.rowid LIMIT 1",event.id,id).first<{id:string;player_id:string}>();
   if(next){
    statements.push(q('INSERT INTO deletion_revision_guards(tournament_id,expected_revision) VALUES(?,?)',event.id,event.revision));
    statements.push(q('UPDATE tournaments SET revision=revision+1 WHERE id=?',event.id));
    statements.push(q('INSERT INTO entries(id,tournament_id,player_id,created_at) VALUES(?,?,?,?)',crypto.randomUUID(),event.id,next.player_id,now));
    statements.push(q('DELETE FROM tournament_waitlist WHERE id=?',next.id));
   }
  }
  // Operation payloads accept arbitrary JSON from the client, so drop authored audit
  // payloads rather than risk retaining personal text submitted as an extra property.
  statements.push(q('DELETE FROM tournament_operations WHERE actor_id=?',id));
  if(mode==='remove_history') {
   statements.push(q('DELETE FROM audit WHERE actor_id=?',id));
   const quotedId=JSON.stringify(id);
   const events=(await q(`SELECT id,state_json,revision FROM tournaments WHERE
    (status!='registration' AND id IN (SELECT tournament_id FROM entries WHERE player_id=?))
    OR id IN (SELECT tournament_id FROM matches WHERE a=? OR b=? OR submitted_by=? OR confirmed_by=?)
    OR instr(COALESCE(state_json,''),?)>0
    OR id IN (SELECT tournament_id FROM tournament_operations WHERE actor_id!=? AND
     (instr(payload,?)>0 OR instr(COALESCE(before_state,''),?)>0 OR instr(COALESCE(after_state,''),?)>0))`,
    id,id,id,id,id,quotedId,id,quotedId,quotedId,quotedId).all<{id:string;state_json:string|null;revision:number}>()).results;
   const matches=(await q('SELECT id,tournament_id,club_id,played_on FROM matches WHERE a=? OR b=? OR submitted_by=? OR confirmed_by=?',id,id,id,id).all<{id:string;tournament_id:string|null;club_id:string;played_on:string}>()).results;
   const scopes=new Map<string,string>();
   const placeholder=(scope:string)=>{
    let pid=scopes.get(scope);
    if(!pid){pid=crypto.randomUUID();scopes.set(scope,pid);statements.push(q("INSERT INTO profiles (id,name,created_at,deleted_at) VALUES (?,'Deleted player',?,?)",pid,now,now));}
    return pid;
   };
   for(const event of events) {
    const pid=placeholder(`event:${event.id}`);
    const clean=(json:string|null)=>json===null?null:JSON.stringify(replaceId(JSON.parse(json),id,pid));
    // Revision conflict aborts the entire transaction via an optimistic guard trigger.
    statements.push(q('INSERT INTO deletion_revision_guards (tournament_id,expected_revision) VALUES (?,?)',event.id,event.revision));
    statements.push(q('UPDATE tournaments SET state_json=?,revision=revision+1 WHERE id=?',clean(event.state_json),event.id));
    statements.push(q('UPDATE entries SET player_id=? WHERE tournament_id=? AND player_id=?',pid,event.id,id));
    // IDs contain only identifier characters. Replacing the complete JSON string
    // token preserves all unrelated values and handles snapshots in one statement.
    const quotedReplacement=JSON.stringify(pid);
    statements.push(q('UPDATE tournament_operations SET payload=replace(payload,?,?),before_state=replace(before_state,?,?),after_state=replace(after_state,?,?) WHERE tournament_id=?',quotedId,quotedReplacement,quotedId,quotedReplacement,quotedId,quotedReplacement,event.id));
   }
   for(const match of matches) {
    const pid=placeholder(match.tournament_id?`event:${match.tournament_id}`:`match:${match.id}`);
    statements.push(q("INSERT OR IGNORE INTO season_players(season_id,player_id,status,created_at) SELECT sp.season_id,?,'withdrawn',sp.created_at FROM season_players sp JOIN club_seasons s ON s.id=sp.season_id WHERE sp.player_id=? AND s.club_id=? AND s.starts_on<=? AND s.ends_on>=?",pid,id,match.club_id,match.played_on,match.played_on));
    statements.push(q('UPDATE matches SET a=CASE WHEN a=? THEN ? ELSE a END,b=CASE WHEN b=? THEN ? ELSE b END,submitted_by=CASE WHEN submitted_by=? THEN ? ELSE submitted_by END,confirmed_by=CASE WHEN confirmed_by=? THEN ? ELSE confirmed_by END WHERE id=?',id,pid,id,pid,id,pid,id,pid,match.id));
    statements.push(q('UPDATE match_history SET before_json=replace(before_json,?,?),after_json=replace(after_json,?,?) WHERE match_id=?',quotedId,JSON.stringify(pid),quotedId,JSON.stringify(pid),match.id));
   }
   statements.push(q('DELETE FROM entries WHERE player_id=?',id));
   statements.push(q('DELETE FROM season_players WHERE player_id=?',id));
   statements.push(q('DELETE FROM profiles WHERE id=?',id));
  }
 }
 statements.push(q('UPDATE clubs SET reviewed_by=NULL WHERE reviewed_by=?',authId));
 try {await db.batch(statements)} catch {
  // A duplicate concurrent request may already have committed this deletion.
  if(await deletionPending(db,authId))return;
  console.error('Account deletion transaction failed');
  throw new AppError(409,'Your club or tournament records changed. Refresh and try again.');
 }
}

type AuthAdmin={deleteUser:(id:string,softDelete?:boolean)=>Promise<{error:{code?:string;status?:number}|null}>};
export async function finishDeletion(db:D1Database,admin:AuthAdmin,authId:string) {
 try {
  if(!await deletionPending(db,authId))return true;
  await db.prepare('UPDATE account_deletions SET attempts=attempts+1,last_attempt_at=? WHERE auth_id=?').bind(new Date().toISOString(),authId).run();
  const {error}=await admin.deleteUser(authId,false);
  if(error&&error.code!=='user_not_found')return false;
  await db.prepare('DELETE FROM account_deletions WHERE auth_id=?').bind(authId).run();
  return true;
 } catch {return false}
}

export async function retryDeletions(db:D1Database,admin:AuthAdmin) {
 await db.prepare('DELETE FROM account_write_blocks WHERE expires_at<? AND NOT EXISTS (SELECT 1 FROM account_deletions WHERE account_deletions.auth_id=account_write_blocks.auth_id)').bind(new Date().toISOString()).run();
 const rows=(await db.prepare('SELECT auth_id FROM account_deletions ORDER BY COALESCE(last_attempt_at,requested_at) LIMIT 25').all<{auth_id:string}>()).results;
 let pending=0;
 for(const row of rows)if(!await finishDeletion(db,admin,row.auth_id))pending++;
 if(pending)console.error(`Account deletion retries pending: ${pending}. Check server auth configuration and provider availability.`);
 return {processed:rows.length,pending};
}
