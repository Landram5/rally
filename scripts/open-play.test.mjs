import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['open-play','rally-errors','profile-photo','match-changes','seeding'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {readOpenPlay,openPlayAction}=await import('../.test-runtime/open-play.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...args)=>sql.prepare(q).run(...args);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:run(q,...args)}}}}const db={prepare:stmt,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
for(const id of ['owner','owner2','one','two','outsider','pending','other'])run('INSERT INTO profiles(id,name,created_at) VALUES(?,?,?)',id,id.toUpperCase(),'2026-10-06');
run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('club','Club','City','owner','2026-10-06','approved'),('other-club','Other','City','other','2026-10-06','approved'),('unapproved','Draft','City','owner2','2026-10-06','pending')");
for(const [club,id,status] of [['club','owner','active'],['club','one','active'],['club','two','active'],['club','pending','pending'],['other-club','other','active'],['unapproved','owner2','active']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,'member',?,'2026-10-06')",club+id,club,id,status);
const now='2026-10-08T18:00:00.000Z',later=new Date(Date.parse(now)+3*3600000).toISOString();
// Check in, list, and visibility to members only.
await openPlayAction(db,'one',{action:'check_in',clubId:'club',note:'  Best of 3, any level  ',minutes:90},now);
let list=await readOpenPlay(db,'two','club',now);assert.equal(list.length,1);assert.equal(list[0].playerId,'one');assert.equal(list[0].note,'Best of 3, any level','note is trimmed');assert.equal(list[0].isMe,false);assert.equal(list[0].expiresAt,new Date(Date.parse(now)+90*60000).toISOString());
assert.equal((await readOpenPlay(db,'one','club',now))[0].isMe,true,'the viewer sees their own entry flagged');
assert.deepEqual(await readOpenPlay(db,'outsider','club',now),[],'non-members see nothing');assert.deepEqual(await readOpenPlay(db,'pending','club',now),[],'pending members see nothing');assert.deepEqual(await readOpenPlay(db,'other','club',now),[],'members of another club see nothing');
// Permissions and validation.
await assert.rejects(openPlayAction(db,'outsider',{action:'check_in',clubId:'club'},now),e=>e.status===403);await assert.rejects(openPlayAction(db,'pending',{action:'check_in',clubId:'club'},now),e=>e.status===403);await assert.rejects(openPlayAction(db,'owner2',{action:'check_in',clubId:'unapproved'},now),e=>e.status===403,'unapproved clubs are excluded');
await assert.rejects(openPlayAction(db,'two',{action:'check_in',clubId:'club',minutes:5},now),e=>e.status===400);await assert.rejects(openPlayAction(db,'two',{action:'check_in',clubId:'club',minutes:361},now),e=>e.status===400);await assert.rejects(openPlayAction(db,'two',{action:'check_in',clubId:'club',minutes:90.5},now),e=>e.status===400);await assert.rejects(openPlayAction(db,'two',{action:'check_in',clubId:'club',note:'x'.repeat(121)},now),e=>e.status===400);
await assert.rejects(openPlayAction(db,'two',{action:'delete_everything',clubId:'club'},now),e=>e.status===400);await assert.rejects(openPlayAction(db,'two',{action:'check_in',clubId:"club' OR '1'='1"},now),e=>e.status===400,'malformed club ids are rejected');
// One active entry per player; re-checking in replaces it.
await openPlayAction(db,'one',{action:'check_in',clubId:'club',note:'Now doubles practice',minutes:120},now);
assert.equal(sql.prepare("SELECT count(*) n FROM open_play WHERE player_id='one' AND ended_at IS NULL").get().n,1,'only one active entry per player');list=await readOpenPlay(db,'two','club',now);assert.equal(list.length,1);assert.equal(list[0].note,'Now doubles practice');
// Expiry and check-out.
await openPlayAction(db,'two',{action:'check_in',clubId:'club',minutes:30},now);assert.equal((await readOpenPlay(db,'one','club',now)).length,2);
assert.equal((await readOpenPlay(db,'one','club',new Date(Date.parse(now)+100*60000).toISOString())).map(p=>p.playerId).join(),'one','a 30-minute entry has expired while a 2-hour entry is still listed');
assert.equal((await readOpenPlay(db,'one','club',later)).length,0,'entries expire on their own');
await openPlayAction(db,'two',{action:'check_out',clubId:'club'},now);assert.deepEqual((await readOpenPlay(db,'one','club',now)).map(p=>p.playerId),['one'],'check-out removes the entry');
await openPlayAction(db,'two',{action:'check_out',clubId:'club'},now);
// Membership changes and account removal hide or delete entries.
run("UPDATE memberships SET status='declined' WHERE player_id='one'");assert.equal((await readOpenPlay(db,'two','club',now)).length,0,'a removed member disappears from the board');run("UPDATE memberships SET status='active' WHERE player_id='one'");
run("UPDATE profiles SET deleted_at='2026-10-08',auth_id=NULL,name='Deleted player' WHERE id='one'");assert.equal((await readOpenPlay(db,'two','club',now)).length,0,'hidden profiles are not listed');await openPlayAction(db,'two',{action:'check_in',clubId:'club'},now);
assert.equal(sql.prepare('SELECT count(*) n FROM open_play').get().n>0,true);run("DELETE FROM memberships WHERE player_id IN ('one','two')");run("DELETE FROM profiles WHERE id='two'");run("DELETE FROM profiles WHERE id='one'");assert.equal(sql.prepare('SELECT count(*) n FROM open_play').get().n,0,'deleting an account removes its open play rows');
console.log('Open play passed: member-only visibility, permissions, validation, one active entry per player, expiry, check-out, membership changes and account deletion.');
