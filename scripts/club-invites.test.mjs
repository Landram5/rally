import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-invites','rally-errors'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const inv=await import('../.test-runtime/club-invites.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['owner','board','member','joiner','asker','guest','ghost','o2'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p==='guest'?null:p+'-auth',p,'2026-10-01');
run("UPDATE profiles SET auth_id=NULL WHERE id='ghost'");
const club=(id,owner,status='approved')=>run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01',?)",id,'Club '+id,'City',owner,status);
club('c1','owner');club('c2','o2','pending');
const mem=(c,p,role,status='active')=>run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,?,'2026-10-01')",c+p,c,p,role,status);
mem('c1','owner','owner');mem('c1','board','board');mem('c1','member','member');mem('c1','asker','member','pending');mem('c2','o2','owner');
const fail=async(p,status,msg)=>assert.rejects(p,e=>e.status===status&&(!msg||msg.test(e.message)),`expected ${status}`);
const t0=new Date('2026-10-15T12:00:00.000Z'),at=(days)=>new Date(t0.getTime()+days*86400000);

// Only organizers manage the link.
await fail(inv.createInvite(db,'member','c1',7,t0),403);await fail(inv.createInvite(db,'joiner','c1',7,t0),403);await fail(inv.activeInvite(db,'member','c1',t0),403);await fail(inv.revokeInvites(db,'member','c1',t0),403);
await fail(inv.createInvite(db,'owner','c1',10,t0),400,/7 days, 30 days/);
assert.equal(await inv.activeInvite(db,'owner','c1',t0),null,'no link until one is made');
const a=await inv.createInvite(db,'board','c1',7,t0);assert.match(a.token,/^[A-Za-z0-9_-]{22}$/,'a 128-bit URL-safe token');assert.equal(a.expiresAt,at(7).toISOString());assert.equal(a.uses,0);
assert.equal((await inv.activeInvite(db,'owner','c1',t0)).token,a.token,'any organizer sees the working link');

// A new link turns off the old one.
const b=await inv.createInvite(db,'owner','c1',30,t0);assert.notEqual(b.token,a.token);
await fail(inv.previewInvite(db,a.token,t0),410,/turned off/);assert.equal((await inv.previewInvite(db,b.token,t0)).name,'Club c1');
assert.equal(one("SELECT count(*) n FROM club_invites WHERE club_id='c1' AND revoked_at IS NULL").n,1,'one working link at a time');

// What the join page can show.
const pv=await inv.previewInvite(db,b.token,t0);assert.deepEqual(pv,{clubId:'c1',name:'Club c1',location:'City',memberCount:3},'members counted without the pending request');
await fail(inv.previewInvite(db,'short',t0),404);await fail(inv.previewInvite(db,'x'.repeat(22),t0),404);await fail(inv.previewInvite(db,'../../etc/passwd/aaaaa',t0),404);
await fail(inv.previewInvite(db,b.token,at(31)),410,/expired/);assert.equal((await inv.previewInvite(db,b.token,at(29))).clubId,'c1','still working before it expires');

// Joining: immediate, member role, counted once.
const joined=await inv.acceptInvite(db,'joiner',b.token,t0);assert.deepEqual(joined,{clubId:'c1',joined:true});
assert.deepEqual({...one("SELECT role,status FROM memberships WHERE club_id='c1' AND player_id='joiner'")},{role:'member',status:'active'},'a regular active member, no approval step');
assert.equal((await inv.activeInvite(db,'owner','c1',t0)).uses,1);
assert.deepEqual(await inv.acceptInvite(db,'joiner',b.token,t0),{clubId:'c1',joined:false},'opening it again changes nothing');assert.equal((await inv.activeInvite(db,'owner','c1',t0)).uses,1,'and is not counted twice');
assert.deepEqual(await inv.acceptInvite(db,'owner',b.token,t0),{clubId:'c1',joined:false});assert.equal(one("SELECT role FROM memberships WHERE club_id='c1' AND player_id='owner'").role,'owner','an organizer opening it keeps their role');
// A pending request is approved by the link.
assert.deepEqual(await inv.acceptInvite(db,'asker',b.token,t0),{clubId:'c1',joined:true});assert.equal(one("SELECT status FROM memberships WHERE club_id='c1' AND player_id='asker'").status,'active');assert.equal(one("SELECT count(*) n FROM memberships WHERE club_id='c1' AND player_id='asker'").n,1);
assert.equal((await inv.activeInvite(db,'owner','c1',t0)).uses,2);
// Accounts without a player profile cannot join.
await fail(inv.acceptInvite(db,'ghost',b.token,t0),403,/profile/);await fail(inv.acceptInvite(db,'guest',b.token,t0),403);await fail(inv.acceptInvite(db,'nobody',b.token,t0),403);

// Turning it off and expiry stop joining.
await inv.revokeInvites(db,'owner','c1',t0);await fail(inv.acceptInvite(db,'guest',b.token,t0),410,/turned off/);assert.equal(await inv.activeInvite(db,'owner','c1',t0),null);
const c=await inv.createInvite(db,'owner','c1',7,t0);await fail(inv.acceptInvite(db,'member',c.token,at(8)),410,/expired/);assert.equal(await inv.activeInvite(db,'owner','c1',at(8)),null,'an expired link is no longer shown as working');
const forever=await inv.createInvite(db,'owner','c1',0,t0);assert.equal(forever.expiresAt,null);assert.equal((await inv.previewInvite(db,forever.token,at(5000))).clubId,'c1','no expiry means it keeps working until turned off');

// A club that is still waiting for verification works; a rejected one does not. Links are per club.
const p2=await inv.createInvite(db,'o2','c2',7,t0);assert.equal((await inv.acceptInvite(db,'joiner',p2.token,t0)).joined,true,'unverified clubs can use invite links');
await fail(inv.createInvite(db,'owner','c2',7,t0),403,/organizers/);
run("UPDATE clubs SET approval_status='rejected' WHERE id='c2'");await fail(inv.previewInvite(db,p2.token,t0),410,/not accepting/);await fail(inv.createInvite(db,'o2','c2',7,t0),403,/organizers/);
// Deleting a club removes its links.
run("DELETE FROM memberships WHERE club_id='c2'");run("DELETE FROM clubs WHERE id='c2'");assert.equal(one("SELECT count(*) n FROM club_invites WHERE club_id='c2'").n,0);
// Tokens do not repeat.
assert.equal(new Set(Array.from({length:500},()=>inv.newToken())).size,500);
console.log('club invite tests passed');
