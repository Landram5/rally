import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['messages','chat','rally-errors','account-deletion','seeding','account-write-guard','record-ownership','match-rules','doubles-rating','doubles','club-seasons','logistics']){try{writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));}catch{}}
const dm=await import('../.test-runtime/messages.mjs'),chat=await import('../.test-runtime/chat.mjs'),{beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['lead','amy','ben','cara','pend','stranger','guest'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p==='guest'?null:p+'-auth',p==='lead'?'Lena Lead':p[0].toUpperCase()+p.slice(1)+' Person','2026-10-01');
for(const [c,o] of [['club','lead'],['other','stranger']])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,c,'City',o);
for(const [p,c,role,status] of [['lead','club','owner','active'],['amy','club','member','active'],['ben','club','member','active'],['cara','other','member','active'],['stranger','other','owner','active'],['pend','club','member','pending'],['guest','club','guest','active']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,?,'2026-10-01')",p+c,c,p,role,status);
const fail=async(p,status)=>assert.rejects(p,e=>e.status===status,`expected ${status}`);
const t=n=>`2026-10-08T10:00:${String(n).padStart(2,'0')}.000Z`;
// Who can message whom: people who share a club, and leaders with applicants. Nobody else.
assert.equal(await dm.canMessage(db,'amy','ben'),true);assert.equal(await dm.canMessage(db,'amy','cara'),false,'no shared club');assert.equal(await dm.canMessage(db,'amy','amy'),false);
assert.equal(await dm.canMessage(db,'pend','amy'),false,'an applicant cannot message ordinary members');assert.equal(await dm.canMessage(db,'pend','lead'),true,'but can message the club leader');assert.equal(await dm.canMessage(db,'lead','pend'),true);
assert.equal(await dm.canMessage(db,'amy','guest'),false,'guest records have no account');
await fail(dm.startThread(db,'amy','cara'),403);
// Lookup only finds people you could message.
assert.deepEqual((await dm.lookupPeople(db,'amy','per')).people.map(p=>p.id).sort(),['ben'].concat([]).sort().concat([]).filter(()=>true).length?['ben']:[]);
assert.deepEqual((await dm.lookupPeople(db,'amy','Le')).people.map(p=>p.id),['lead']);assert.deepEqual((await dm.lookupPeople(db,'amy','x')).people,[],'two letters minimum');
// A conversation: start, send, idempotent retry, unread, read.
const {threadId}=await dm.startThread(db,'amy','ben');assert.equal((await dm.startThread(db,'ben','amy')).threadId,threadId,'one thread per pair');
assert.equal((await dm.listThreads(db,'amy')).threads.length,0,'empty threads are not listed');
const first=await dm.sendDm(db,'amy',threadId,{text:' hi Ben ',clientId:'c1'},t(1));assert.equal(first.message.body,'hi Ben');assert.equal(first.other,'ben');
assert.equal((await dm.sendDm(db,'amy',threadId,{text:'again',clientId:'c1'},t(2))).created,false);
await fail(dm.sendDm(db,'amy',threadId,{text:'  ',clientId:'c2'}),400);await fail(dm.sendDm(db,'amy',threadId,{text:'x'.repeat(2001),clientId:'c2'}),400);
await fail(dm.sendDm(db,'cara',threadId,{text:'sneaky',clientId:'c3'}),404);await fail(dm.readThread(db,'cara',threadId),404);
assert.equal((await dm.listThreads(db,'ben')).threads[0].unread,1);assert.equal(await dm.unreadDmCount(db,'ben'),1);assert.equal(await dm.unreadDmCount(db,'amy'),0,'your own messages are not unread');
await dm.sendDm(db,'ben',threadId,{text:'hey Amy',clientId:'b1'},t(3));
const view=await dm.readThread(db,'ben',threadId);assert.deepEqual(view.messages.map(m=>m.body),['hi Ben','hey Amy']);assert.equal(view.messages[1].mine,true);assert.equal(view.other.name,'Amy Person');
await dm.markThreadRead(db,'ben',threadId,t(9));assert.equal(await dm.unreadDmCount(db,'ben'),0);
for(let i=0;i<19;i++)await dm.sendDm(db,'amy',threadId,{text:'m'+i,clientId:'r'+i},t(10+i));
await fail(dm.sendDm(db,'amy',threadId,{text:'too fast',clientId:'rate'},t(29)),429);
// Delete: only your own.
await fail(dm.deleteDm(db,'ben',first.message.id),404);await dm.deleteDm(db,'amy',first.message.id);assert.ok(!(await dm.readThread(db,'ben',threadId)).messages.some(m=>m.id===first.message.id));
// Reports snapshot the context for administrators and nobody else.
const reported=(await dm.readThread(db,'ben',threadId)).messages.find(m=>m.body==='m3');
await fail(dm.reportDm(db,'amy',reported.id,'x'),400);await dm.reportDm(db,'ben',reported.id,'rude');
await fail(dm.listSafetyReports(db,false),403);const reports=(await dm.listSafetyReports(db,true)).reports;assert.equal(reports.length,1);assert.equal(reports[0].context.at(-1).body,'m3');assert.ok(reports[0].context.length>=4);assert.equal(reports[0].target,'Amy Person');
await dm.reportUser(db,'ben','cara','spam profile');assert.equal((await dm.listSafetyReports(db,true)).reports.length,2);
await fail(dm.resolveSafetyReport(db,false,'lead',reports[0].id),403);await dm.resolveSafetyReport(db,true,'lead',reports[0].id);assert.equal((await dm.listSafetyReports(db,true)).reports.length,1);
// Blocking: one way, always wins, hides the thread and their club chat messages.
run("INSERT INTO chat_messages(id,club_id,author_id,author_name,body,client_id,created_at) VALUES('cm1','club','amy','Amy Person','club hello','cm1','2026-10-08T09:00:00.000Z')");
assert.ok((await chat.readMessages(db,'ben','club')).messages.some(m=>m.id==='cm1'));assert.ok((await chat.unreadCounts(db,'ben')).club>=1);
await dm.setBlock(db,'ben','amy',true);
assert.equal(await dm.canMessage(db,'amy','ben'),false);assert.equal(await dm.canMessage(db,'ben','amy'),false);
await fail(dm.sendDm(db,'amy',threadId,{text:'blocked',clientId:'x9'},t(40)),403);await fail(dm.sendDm(db,'ben',threadId,{text:'me too',clientId:'x10'},t(40)),403);
await fail(dm.startThread(db,'cara','amy'),403);assert.deepEqual((await dm.lookupPeople(db,'amy','Ben')).people,[],'a blocker disappears from the blocked person\'s lookup');
assert.equal((await dm.listThreads(db,'ben')).threads.length,0,'the blocker no longer sees the thread');assert.equal((await dm.listThreads(db,'amy')).threads.length,1,'the blocked person keeps their copy');
await fail(dm.readThread(db,'ben',threadId),403);assert.equal(await dm.unreadDmCount(db,'ben'),0);
assert.ok(!(await chat.readMessages(db,'ben','club')).messages.some(m=>m.authorId==='amy'),'blocked authors disappear from club chat');assert.ok((await chat.readMessages(db,'lead','club')).messages.some(m=>m.authorId==='amy'),'but not for everyone else');
assert.deepEqual((await dm.listBlocks(db,'ben')).blocked.map(b=>b.id),['amy']);assert.deepEqual(await dm.blockedIds(db,'ben'),['amy']);
await fail(dm.setBlock(db,'ben','ben',true),400);
await dm.setBlock(db,'ben','amy',false);assert.equal(await dm.canMessage(db,'amy','ben'),true);
// Settings.
assert.equal(await dm.dmNotifyEnabled(db,'amy'),true);await dm.setDmNotify(db,'amy',false);assert.equal(await dm.dmNotifyEnabled(db,'amy'),false);
// Leaving every shared club keeps the history readable but stops new messages.
run("DELETE FROM memberships WHERE player_id='ben'");const after=await dm.readThread(db,'amy',threadId);assert.equal(after.canSend,false);assert.ok(after.messages.length>0);await fail(dm.sendDm(db,'amy',threadId,{text:'gone',clientId:'z1'},t(50)),403);
// Account deletion removes the person's conversations, blocks and reports without breaking anything.
await dm.setBlock(db,'cara','stranger',true);
await beginDeletion(db,'amy-auth','remove_history');
assert.equal(one("SELECT count(*) n FROM dm_threads").n,0);assert.equal(one("SELECT count(*) n FROM safety_reports WHERE target_id='amy' OR reporter_id='amy'").n,0);
assert.equal(one("SELECT count(*) n FROM blocks WHERE blocker_id='cara'").n,1,'other people\'s blocks stay');
assert.equal(one('PRAGMA foreign_key_check'),undefined);
console.log('Direct message checks passed: who can message whom, lookup, threads, retries, unread, limits, delete, reports for administrators, blocking, settings and account deletion.');
