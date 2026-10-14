import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['rooms','messages','chat','rally-errors','account-deletion','seeding','account-write-guard','record-ownership','match-rules','doubles-rating','doubles','club-seasons','logistics']){try{writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));}catch{}}
const rooms=await import('../.test-runtime/rooms.mjs'),dm=await import('../.test-runtime/messages.mjs'),{beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['ana','bo','cy','dee','member','pending'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p[0].toUpperCase()+p.slice(1)+' Leader','2026-10-01');
for(const [c,o] of [['c1','ana'],['c2','bo'],['c3','cy']])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,c.toUpperCase(),'City',o);
run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('c4','C4','City','dee','2026-10-01','pending')");
for(const [p,c,role,status] of [['ana','c1','owner','active'],['bo','c2','owner','active'],['cy','c3','owner','active'],['dee','c4','owner','active'],['member','c1','member','active'],['pending','c1','board','pending']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,?,'2026-10-01')",p+c,c,p,role,status);
run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('bo-board','c1','bo','board','active','2026-10-01')");
const fail=async(p,status)=>assert.rejects(p,e=>e.status===status,`expected ${status}`);
const t=n=>`2026-10-08T10:00:${String(n).padStart(2,'0')}.000Z`;
// Only leaders of approved clubs.
assert.equal(await rooms.isLeader(db,'ana'),true);assert.equal(await rooms.isLeader(db,'member'),false);assert.equal(await rooms.isLeader(db,'pending'),false,'a pending board role is not leadership');assert.equal(await rooms.isLeader(db,'dee'),false,'a club awaiting approval does not count');
await fail(rooms.createRoom(db,'member',{name:'Nope'}),403);await fail(rooms.createRoom(db,'ana',{name:'   '}),400);await fail(rooms.createRoom(db,'ana',{name:'x'.repeat(81)}),400);
const {roomId}=await rooms.createRoom(db,'ana',{name:'Regional leaders',description:'Scheduling'},t(1));
assert.equal((await rooms.listRooms(db,'ana')).rooms.length,1);assert.equal((await rooms.listRooms(db,'member')).leader,false);assert.deepEqual((await rooms.listRooms(db,'member')).rooms,[]);
await fail(rooms.readRoom(db,'bo',roomId),404,'not a member yet');await fail(rooms.postRoomMessage(db,'member',roomId,{text:'hi',clientId:'a'}),404);
// Invitations: owner only, leaders only, never across a block.
assert.deepEqual((await rooms.lookupLeaders(db,'ana',roomId,'Leader')).people.map(p=>p.id).sort(),['bo','cy']);assert.deepEqual((await rooms.lookupLeaders(db,'ana',roomId,'x')).people,[]);
await fail(rooms.invite(db,'bo',roomId,'cy'),404);await fail(rooms.invite(db,'ana',roomId,'member'),400,'a non-leader cannot be invited');await fail(rooms.invite(db,'ana',roomId,'dee'),400);
await dm.setBlock(db,'cy','ana',true);await fail(rooms.invite(db,'ana',roomId,'cy'),403,'blocks stop invitations');assert.deepEqual((await rooms.lookupLeaders(db,'ana',roomId,'Cy')).people,[]);await dm.setBlock(db,'cy','ana',false);
await rooms.invite(db,'ana',roomId,'bo',t(2));await rooms.invite(db,'ana',roomId,'cy',t(2));
let mine=await rooms.listRooms(db,'bo');assert.equal(mine.rooms.length,0);assert.equal(mine.invitations.length,1);assert.equal(mine.invitations[0].invitedBy,'Ana Leader');
await fail(rooms.readRoom(db,'bo',roomId),404,'an invitation is not membership');
await rooms.respondToInvite(db,'bo',roomId,true,t(3));await rooms.respondToInvite(db,'cy',roomId,false);await fail(rooms.respondToInvite(db,'cy',roomId,true),404);
assert.equal((await rooms.listRooms(db,'bo')).rooms.length,1);assert.equal((await rooms.listRooms(db,'cy')).rooms.length,0);
// Messages: text, attachments, retries, limits, paging.
const first=await rooms.postRoomMessage(db,'ana',roomId,{text:' hello leaders ',clientId:'c1'},t(4));assert.equal(first.message.body,'hello leaders');assert.equal(first.created,true);
assert.equal((await rooms.postRoomMessage(db,'ana',roomId,{text:'again',clientId:'c1'},t(5))).created,false);
await fail(rooms.postRoomMessage(db,'ana',roomId,{text:'  ',clientId:'c2'},t(5)),400);await fail(rooms.postRoomMessage(db,'ana',roomId,{text:'x'.repeat(2001),clientId:'c2'},t(5)),400);
run("INSERT INTO room_media(id,room_id,uploader_id,kind,content_type,bytes,r2_key,created_at) VALUES('rm1',?,'bo','image','image/jpeg',1000,'room/x/rm1','2026-10-08T10:00:00.000Z')",roomId);
await fail(rooms.postRoomMessage(db,'ana',roomId,{mediaId:'rm1',clientId:'c3'},t(6)),400,'only your own upload');
const pic=await rooms.postRoomMessage(db,'bo',roomId,{mediaId:'rm1',text:'agenda',clientId:'b1'},t(7));assert.equal(pic.message.media.kind,'image');await fail(rooms.postRoomMessage(db,'bo',roomId,{mediaId:'rm1',clientId:'b2'},t(8)),400);
const view=await rooms.readRoom(db,'bo',roomId);assert.equal(view.messages.length,2);assert.equal(view.members.length,2,'invited-but-declined people are gone');assert.ok(view.members.every(m=>m.status==='active'));assert.deepEqual(view.members.find(m=>m.id==='bo').clubs.sort(),['C1','C2']);assert.equal(view.room.owner,false);assert.equal((await rooms.readRoom(db,'ana',roomId)).room.owner,true);
for(let i=0;i<19;i++)await rooms.postRoomMessage(db,'bo',roomId,{text:'m'+i,clientId:'r'+i},t(20+i));await fail(rooms.postRoomMessage(db,'bo',roomId,{text:'fast',clientId:'rate'},t(40)),429);
// Unread, notifications.
assert.ok((await rooms.listRooms(db,'ana')).rooms[0].unread>=20);assert.ok(await rooms.unreadRoomCount(db,'ana')>=20);await rooms.markRoomRead(db,'ana',roomId,'2999-01-01T00:00:00.000Z');assert.equal(await rooms.unreadRoomCount(db,'ana'),0);
await rooms.setRoomNotify(db,'bo',roomId,true);assert.equal((await rooms.readRoom(db,'bo',roomId)).room.notify,true);await fail(rooms.setRoomNotify(db,'bo',roomId,'yes'),400);
// Blocks hide a person's room messages from the blocker only.
await dm.setBlock(db,'ana','bo',true);assert.ok(!(await rooms.readRoom(db,'ana',roomId)).messages.some(m=>m.authorId==='bo'));assert.ok((await rooms.readRoom(db,'bo',roomId)).messages.some(m=>m.authorId==='bo'));assert.equal(await rooms.unreadRoomCount(db,'ana'),0);await dm.setBlock(db,'ana','bo',false);
// Delete: author or owner. Reports go to site administrators with context.
await fail(rooms.deleteRoomMessage(db,'bo',first.message.id),403);const gone=await rooms.deleteRoomMessage(db,'bo',pic.message.id);assert.equal(gone.r2Key,'room/x/rm1');await rooms.deleteRoomMessage(db,'ana',first.message.id);
const target=(await rooms.readRoom(db,'ana',roomId)).messages.find(m=>m.body==='m5');await fail(rooms.reportRoomMessage(db,'bo',target.id,'x'),400);await rooms.reportRoomMessage(db,'ana',target.id,'off topic');
const reports=(await dm.listSafetyReports(db,true)).reports;assert.equal(reports.length,1);assert.equal(reports[0].kind,'room');assert.equal(reports[0].context.at(-1).body,'m5');
// Owner controls.
await fail(rooms.updateRoom(db,'bo',roomId,{name:'Mine now'}),403);await rooms.updateRoom(db,'ana',roomId,{name:'Leaders',description:''});await fail(rooms.removeMember(db,'bo',roomId,'ana'),403);await fail(rooms.removeMember(db,'ana',roomId,'ana'),400);
// Losing leadership ends access.
run("UPDATE memberships SET role='member' WHERE player_id='bo'");await fail(rooms.readRoom(db,'bo',roomId),403);assert.deepEqual((await rooms.listRooms(db,'bo')).rooms,[]);run("UPDATE memberships SET role='owner' WHERE player_id='bo' AND club_id='c2'");run("UPDATE memberships SET role='board' WHERE player_id='bo' AND club_id='c1'");
// Archiving stops new messages and hides the room; removal kicks people out.
await rooms.invite(db,'ana',roomId,'cy',t(50));await rooms.respondToInvite(db,'cy',roomId,true);await rooms.removeMember(db,'ana',roomId,'cy');await fail(rooms.readRoom(db,'cy',roomId),404);
// The owner leaving hands the room to the longest-standing member.
await rooms.leaveRoom(db,'ana',roomId);assert.equal((await rooms.readRoom(db,'bo',roomId)).room.owner,true,'bo is the owner now');await fail(rooms.readRoom(db,'ana',roomId),404);
await rooms.updateRoom(db,'bo',roomId,{archived:true},t(51));await fail(rooms.postRoomMessage(db,'bo',roomId,{text:'late',clientId:'late'},t(52)),409);assert.deepEqual((await rooms.listRooms(db,'bo')).rooms,[]);
// Rooms without members left are archived when the last person leaves; account deletion keeps everyone else's rooms intact.
const second=(await rooms.createRoom(db,'ana',{name:'Second'},t(53))).roomId;await rooms.invite(db,'ana',second,'bo',t(54));await rooms.respondToInvite(db,'bo',second,true,t(55));await rooms.postRoomMessage(db,'ana',second,{text:'from ana',clientId:'s1'},t(56));
run("UPDATE memberships SET role='member' WHERE player_id='member' AND club_id='c1'");run("UPDATE memberships SET role='owner' WHERE player_id='member' AND club_id='c1'");run("UPDATE memberships SET role='admin' WHERE player_id='ana' AND club_id='c1'");run("UPDATE clubs SET owner_id='member' WHERE id='c1'");
await beginDeletion(db,'ana-auth','remove_history');
const after=await rooms.readRoom(db,'bo',second);assert.equal(after.room.owner,true,'ownership passed on');const kept=after.messages.find(m=>m.body==='from ana');assert.equal(kept.authorName,'Deleted User (Ana Leader)');assert.equal(kept.authorId,null);
assert.equal(one("SELECT count(*) n FROM room_members WHERE player_id='ana'").n,0);
const third=(await rooms.createRoom(db,'cy',{name:'Solo'},t(57))).roomId;run("UPDATE clubs SET owner_id='pending' WHERE id='c3'");run("UPDATE memberships SET role='admin' WHERE player_id='cy'");
await beginDeletion(db,'cy-auth','keep_results');assert.ok(one('SELECT archived_at FROM leader_rooms WHERE id=?',third).archived_at,'an emptied room is archived');
assert.equal(one('PRAGMA foreign_key_check'),undefined);
console.log('Leader room checks passed: who can create and join, invitations, messages and attachments, unread, blocks, moderation, reports, ownership, lost leadership, archiving and account deletion.');
