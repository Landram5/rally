import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['chat','rally-errors','account-deletion','seeding','account-write-guard','record-ownership','match-rules','doubles-rating','doubles','club-seasons','logistics']){try{writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));}catch{}}
const chat=await import('../.test-runtime/chat.mjs'),{beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['owner','m1','m2','pending','outsider'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p.toUpperCase(),'2026-10-01');
for(const c of ['club','other'])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,c,'City',c==='club'?'owner':'outsider');
for(const [p,c,role,status] of [['owner','club','owner','active'],['m1','club','member','active'],['m2','club','member','active'],['pending','club','member','pending'],['outsider','other','owner','active']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,?,'2026-10-01')",p+c,c,p,role,status);
const t=n=>`2026-10-08T10:00:${String(n).padStart(2,'0')}.000Z`;
const media=(id,club,uploader,kind='image')=>run("INSERT INTO chat_media(id,club_id,uploader_id,kind,content_type,bytes,r2_key,created_at) VALUES(?,?,?,?,?,?,?,?)",id,club,uploader,kind,kind==='image'?'image/jpeg':'video/mp4',1000,`chat/${club}/${id}`,t(0));
const fail=async(p,status)=>assert.rejects(p,e=>e.status===status,`expected ${status}`);
// Only active members of the club can use the chat.
await fail(chat.readMessages(db,'pending','club'),403);await fail(chat.readMessages(db,'outsider','club'),403);await fail(chat.postMessage(db,'outsider','club',{text:'hi',clientId:'c0'}),403);
await fail(chat.postMessage(db,'m1','club',{text:'  ',clientId:'c1'}),400);await fail(chat.postMessage(db,'m1','club',{text:'x'.repeat(2001),clientId:'c1'}),400);await fail(chat.postMessage(db,'m1','club',{text:'hi'}),400);
const first=await chat.postMessage(db,'m1','club',{text:' hello ',clientId:'c1'},t(1));assert.equal(first.message.body,'hello');assert.equal(first.message.mine,true);assert.equal(first.created,true);
assert.equal((await chat.postMessage(db,'m1','club',{text:'hello again',clientId:'c1'},t(2))).created,false,'a retry with the same id does not duplicate');assert.equal(one('SELECT count(*) n FROM chat_messages').n,1);
// Attachments: only your own, only for this club, only once.
media('img1','club','m1');media('img2','club','m2');media('imgx','other','m1');
await fail(chat.postMessage(db,'m1','club',{mediaId:'img2',clientId:'c2'},t(3)),400);await fail(chat.postMessage(db,'m1','club',{mediaId:'imgx',clientId:'c2'},t(3)),400);
const withMedia=await chat.postMessage(db,'m1','club',{mediaId:'img1',clientId:'c2'},t(3));assert.equal(withMedia.message.media.kind,'image');assert.equal(withMedia.message.body,'');
await fail(chat.postMessage(db,'m1','club',{mediaId:'img1',clientId:'c3'},t(4)),400);
// Reading: newest page first, older pages by cursor, catch-up by "after".
for(let i=0;i<45;i++)run("INSERT INTO chat_messages(id,club_id,author_id,author_name,body,client_id,created_at) VALUES(?,?,?,?,?,?,?)",'bulk'+i,'club','m2','M2','m'+i,'bulk'+i,`2026-10-08T09:00:${String(i).padStart(2,'0')}.000Z`);
const page=await chat.readMessages(db,'m1','club');assert.equal(page.messages.length,40);assert.equal(page.hasMore,true);
const older=await chat.readMessages(db,'m1','club',{before:page.messages[0].id});assert.ok(older.messages.length>0&&older.messages.every(m=>!page.messages.some(p=>p.id===m.id)));
const lastSeen=page.messages[20].id,caught=await chat.readMessages(db,'m1','club',{after:lastSeen});assert.ok(caught.messages.length>=19);assert.equal(caught.hasMore,false);
await fail(chat.readMessages(db,'m1','club',{before:'nope'}),404);
// Rate limit.
for(let i=0;i<20;i++)await chat.postMessage(db,'m2','club',{text:'fast'+i,clientId:'fast'+i},t(30));
await fail(chat.postMessage(db,'m2','club',{text:'too fast',clientId:'rate'},t(30)),429);
// Delete: author or organizer, never a bystander. Media is reported for cleanup.
await fail(chat.deleteMessage(db,'m2',first.message.id),403);
const del=await chat.deleteMessage(db,'m1',withMedia.message.id,t(50));assert.equal(del.r2Key,'chat/club/img1');await fail(chat.deleteMessage(db,'m1',withMedia.message.id),404);
const byOwner=await chat.deleteMessage(db,'owner',first.message.id,t(51));assert.equal(byOwner.clubId,'club');
assert.ok(!(await chat.readMessages(db,'m2','club',{after:undefined})).messages.some(m=>m.id===first.message.id),'deleted messages disappear');
// Reports and mutes.
const target=(await chat.readMessages(db,'m1','club')).messages.find(m=>m.authorId==='m2');
await fail(chat.reportMessage(db,'m2',target.id),400);
await chat.reportMessage(db,'m1',target.id,'spam');await chat.reportMessage(db,'m1',target.id,'spam');assert.equal(one('SELECT count(*) n FROM chat_reports').n,1,'one report per person');
await fail(chat.listReports(db,'m1','club'),403);const reports=await chat.listReports(db,'owner','club');assert.equal(reports.reports.length,1);assert.equal(reports.reports[0].reporter,'M1');
await chat.resolveReport(db,'owner',reports.reports[0].id);assert.equal((await chat.listReports(db,'owner','club')).reports.length,0);
await fail(chat.setMute(db,'m1','club','m2',true),403);await fail(chat.setMute(db,'owner','club','owner',true),400);await fail(chat.setMute(db,'owner','club','outsider',true),404);
await chat.setMute(db,'owner','club','m2',true);await fail(chat.postMessage(db,'m2','club',{text:'muted',clientId:'mm'}),403);assert.equal((await chat.readMessages(db,'m2','club')).muted,true,'a muted member can still read');
await chat.setMute(db,'owner','club','m2',false);
// Unread counts and read marker.
run('DELETE FROM chat_members');
assert.ok((await chat.unreadCounts(db,'owner')).club>0);await chat.markRead(db,'owner','club','2999-01-01T00:00:00.000Z');assert.equal((await chat.unreadCounts(db,'owner')).club,undefined);
assert.deepEqual(await chat.unreadCounts(db,'outsider'),{},'other clubs do not leak');
await chat.setNotify(db,'m1','club',true);assert.equal((await chat.readMessages(db,'m1','club')).notify,true);await fail(chat.setNotify(db,'m1','club','yes'),400);
// A deleted account's messages stay, labelled with the name it had.
await chat.postMessage(db,'m1','club',{text:'last words',clientId:'bye'},t(59));
run("UPDATE profiles SET deleted_at='2026-10-09',auth_id=NULL,name='Deleted player' WHERE id='m1'");
const after=(await chat.readMessages(db,'owner','club')).messages.find(m=>m.body==='last words');assert.equal(after.authorName,'Deleted User (M1)');assert.equal(after.authorId,null);
await fail(chat.readMessages(db,'m1','club'),403);
// Deleting an account in "remove history" mode must not break chat: messages move to a placeholder and keep the name.
run("INSERT INTO chat_reports(id,message_id,club_id,reporter_id,reason,created_at) SELECT 'rep-m2',id,club_id,'m2','spam','2026-10-08T10:01:00.000Z' FROM chat_messages WHERE author_id='owner' LIMIT 1");
run("INSERT INTO chat_messages(id,club_id,author_id,author_name,body,client_id,created_at) VALUES('m2-last','club','m2','M2','from m2','m2-last','2026-10-08T10:02:00.000Z')");
await beginDeletion(db,'m2-auth','remove_history');
const kept=(await chat.readMessages(db,'owner','club')).messages.filter(m=>m.authorName==='Deleted User (M2)');assert.ok(kept.length>0,'messages stay');assert.ok(kept.every(m=>m.authorId===null));
assert.equal(one("SELECT count(*) n FROM chat_reports WHERE reporter_id='m2'").n,0);assert.equal(one("SELECT count(*) n FROM profiles WHERE id='m2'").n,0);
// A new club works before Rally verifies it; a rejected club does not.
for(const [id,owner,status] of [['unverified','uo','pending'],['rejected','ro','rejected']]){
 for(const p of [owner,owner+'m'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p.toUpperCase(),'2026-10-01');
 run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01',?)",id,id,'City',owner,status);
 for(const [p,role] of [[owner,'owner'],[owner+'m','member']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,'active','2026-10-01')",p+id,id,p,role);
}
const live=await chat.postMessage(db,'uom','unverified',{text:'hello before verification',clientId:'u1'},t(40));assert.equal(live.created,true,'members can chat in an unverified club');
assert.equal((await chat.readMessages(db,'uo','unverified')).messages.length,1);
await fail(chat.postMessage(db,'rom','rejected',{text:'nope',clientId:'r1'}),403);
assert.equal(one('PRAGMA foreign_key_check'),undefined);
console.log('Club chat checks passed: membership gate, idempotent posts, attachments, paging, rate limit, delete rights, reports, mutes, unread counts and deleted-user labels.');
