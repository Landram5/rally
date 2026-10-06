import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['profile-photo','account-write-guard','account-deletion','rally-service','tournament-service','tournament-engine','match-rules','rally-errors','seeding','public-rally']){
 const compiled=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, "from './$1.mjs'");
 writeFileSync(`.test-runtime/${name}.mjs`,compiled);
}
const {makeService,scoreError}=await import('../.test-runtime/rally-service.mjs');
const {getPublicPlayer,getPublicTournament}=await import('../.test-runtime/public-rally.mjs');
const path='.test-runtime/test-data.sqlite';rmSync(path,{force:true});let sql;
function open(){sql=new DatabaseSync(path);sql.exec('PRAGMA foreign_keys=ON');}
open();for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function stmt(query,args=[]){return {bind(...a){return stmt(query,a)},async first(){return sql.prepare(query).get(...args)??null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {success:true,meta:sql.prepare(query).run(...args)}},execute(){return {success:true,meta:sql.prepare(query).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const results=stmts.map(s=>s.execute());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const service=makeService(db),act=(who,body)=>service.act(who,body),adminAct=(who,body)=>service.act(who,body,{isSiteAdmin:true,reviewerId:who});
await act('owner-auth',{action:'save_profile',name:'Owner'});
await act('member-auth',{action:'save_profile',name:'Member'});
await act('opponent-auth',{action:'save_profile',name:'Opponent'});
await act('outsider-auth',{action:'save_profile',name:'Outsider'});
const uid=async auth=>(await service.read(auth)).me.id;
const owner=await uid('owner-auth'),member=await uid('member-auth'),opponent=await uid('opponent-auth');
const photo='data:image/jpeg;base64,'+readFileSync('scripts/fixtures/profile-photo.jpg').toString('base64');
await act('member-auth',{action:'save_profile',name:'Member',photo,playerId:owner});
assert.equal(sql.prepare('SELECT image_data FROM profile_photos WHERE player_id=?').get(member).image_data,photo);
assert.equal(sql.prepare('SELECT count(*) AS n FROM profile_photos WHERE player_id=?').get(owner).n,0,'cannot upload for someone else');
assert.match((await service.read('member-auth')).players.find(p=>p.id===member).photo_url,/^\/api\/players\/.*\/photo\?v=/);
assert.ok((await getPublicPlayer(db,member)).photoUrl,'photo visible on public profile');
await act('member-auth',{action:'save_profile',name:'Member'});
assert.equal(sql.prepare('SELECT count(*) AS n FROM profile_photos WHERE player_id=?').get(member).n,1,'editing name preserves photo');
for(const invalid of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,AAAA',false,'data:image/jpeg;base64,'+'A'.repeat(240024)]){
 await assert.rejects(act('member-auth',{action:'save_profile',name:'Must not change',photo:invalid}),e=>e.status===400);
 assert.equal((await service.read('member-auth')).me.name,'Member','invalid photo does not partially save name');
}
await act('member-auth',{action:'save_profile',name:'Member',photo});
assert.equal(sql.prepare('SELECT count(*) AS n FROM profile_photos WHERE player_id=?').get(member).n,1,'replacement stays one photo');
await act('member-auth',{action:'save_profile',name:'Member',photo:null});
assert.equal((await getPublicPlayer(db,member)).photoUrl,null,'removal clears public photo');
assert.equal(sql.prepare('SELECT count(*) AS n FROM profile_photos WHERE player_id=?').get(member).n,0);
console.log('Passed: photo persistence, public URL, self-only writes, replacement, removal, validation and atomic rollback.');

await act('owner-auth',{action:'create_club',id:'club-one',name:'Club One',location:'Baltimore'});
assert.equal((await service.read('owner-auth')).clubs[0].approvalStatus,'pending');
assert.equal((await service.read('member-auth')).clubs.length,0,'pending club must be hidden from other accounts');
assert.equal((await getPublicPlayer(db,owner)).clubs.length,0,'pending club must be hidden from public profiles');
await assert.rejects(act('member-auth',{action:'request_join',clubId:'club-one'}),e=>e.status===403);
await act('owner-auth',{action:'create_tournament',id:'pending-event',clubId:'club-one',name:'Pending Event',date:'2026-10-01',format:'Round robin',capacity:4});
assert.equal(await getPublicTournament(db,'pending-event'),null,'pending club tournament must not be public');
await assert.rejects(act('member-auth',{action:'approve_club',clubId:'club-one'}),e=>e.status===403);
await adminAct('owner-auth',{action:'approve_club',clubId:'club-one'});
await assert.rejects(act('owner-auth',{action:'create_club',id:'club-extra',name:'Extra Club',location:'Baltimore'}),e=>e.status===403);
await act('outsider-auth',{action:'create_club',id:'club-two',name:'Club Two',location:'Columbia'});
await adminAct('owner-auth',{action:'approve_club',clubId:'club-two'});
await assert.rejects(act('member-auth',{action:'add_guest',id:'forged',clubId:'club-one',name:'Guest'}),e=>e.status===403);
for(const auth of ['member-auth','opponent-auth']){
 await act(auth,{action:'request_join',clubId:'club-one'});
 await assert.rejects(act(auth,{action:'approve_member',clubId:'club-one',playerId:await uid(auth)}),e=>e.status===403);
 await act('owner-auth',{action:'approve_member',clubId:'club-one',playerId:await uid(auth)});
}
await act('owner-auth',{action:'add_guest',id:'guest-one',clubId:'club-one',name:'Guest'});
const originalRallyId=(await service.read('member-auth')).players.find(p=>p.id===member).rally_id;
assert.match(originalRallyId,/^RLY-[A-F0-9]{12}$/);
await act('member-auth',{action:'save_profile',name:'Renamed Member',bio:'I play table tennis.',rally_id:'RLY-FORGED'});
assert.equal((await getPublicPlayer(db,member)).bio,'I play table tennis.');
assert.equal((await service.read('member-auth')).players.find(p=>p.id===member).rally_id,originalRallyId);
await act('member-auth',{action:'save_profile',name:'Member'});
assert.equal((await getPublicPlayer(db,member)).bio,'I play table tennis.','name-only edit preserves bio');
await assert.rejects(act('member-auth',{action:'save_profile',name:'Changed',bio:'X'.repeat(501)}),e=>e.status===400);
assert.equal((await getPublicPlayer(db,member)).name,'Member');
assert.throws(()=>sql.prepare('UPDATE profiles SET rally_id=? WHERE id=?').run('RLY-FORGED',member),/cannot be changed/);
const role=(who,playerId,value)=>act(who,{action:'set_member_role',clubId:'club-one',playerId,role:value});
await assert.rejects(role('member-auth',member,'admin'),e=>e.status===403);
await assert.rejects(role('outsider-auth',member,'admin'),e=>e.status===403);
await assert.rejects(role('owner-auth',owner,'member'),e=>e.status===403);
await assert.rejects(role('owner-auth','guest-one','admin'),e=>e.status===400);
await assert.rejects(role('owner-auth',member,'owner'),e=>e.status===400);
await assert.rejects(role('owner-auth',member,['admin']),e=>e.status===400);
for(const leaderRole of ['admin','board']){
 await role('owner-auth',member,leaderRole);
 assert.equal((await service.read('member-auth')).clubs.find(c=>c.id==='club-one').canManage,true);
 assert.equal((await service.read('member-auth')).clubs.find(c=>c.id==='club-one').canAssignRoles,false);
 await assert.rejects(role('member-auth',opponent,'admin'),e=>e.status===403,'leaders cannot appoint leaders');
 await act('member-auth',{action:'create_tournament',id:'leader-event-'+leaderRole,clubId:'club-one',name:'Leader event',date:'2026-10-11',format:'Single elimination',capacity:4});
 await act('member-auth',{action:'set_capacity',id:'leader-event-'+leaderRole,capacity:5,revision:0});
 await act('opponent-auth',{action:'record_match',id:'leader-result-'+leaderRole,clubId:'club-one',a:opponent,b:'guest-one',games:[[11,7],[11,8]],bestOf:3,date:'2026-10-06'});
 await act('member-auth',{action:'confirm_match',id:'leader-result-'+leaderRole});
 assert.equal((await service.read('member-auth')).matches.find(m=>m.id==='leader-result-'+leaderRole).status,'confirmed');
 await role('owner-auth',member,'member');
 await assert.rejects(act('member-auth',{action:'create_tournament',id:'revoked-'+leaderRole,clubId:'club-one',name:'Revoked',date:'2026-10-11',format:'Single elimination',capacity:4}),e=>e.status===403);
 await assert.rejects(act('member-auth',{action:'set_capacity',id:'leader-event-'+leaderRole,capacity:6,revision:1}),e=>e.status===403);
}
// Leave the shared fixture unchanged for the existing match/statistics checks.
for(const id of ['leader-result-admin','leader-result-board']){sql.prepare('DELETE FROM audit WHERE match_id=?').run(id);sql.prepare('DELETE FROM matches WHERE id=?').run(id);}
console.log('Passed: stable Rally IDs, bio validation and persistence; owner-only appointments; both leader roles create and manage tournaments and verify games; demotion revokes access.');

const result={action:'record_match',id:'match-one',clubId:'club-one',a:member,b:opponent,games:[[11,8],[11,9]],bestOf:3,date:'2026-09-28'};
await assert.rejects(act('outsider-auth',result),e=>e.status===403);
await assert.rejects(act('member-auth',{...result,a:owner,b:'guest-one'}),e=>e.status===403);
await assert.rejects(act('member-auth',{...result,games:[[11,10],[11,8]]}),e=>e.status===400);
await act('member-auth',result);await act('member-auth',result);
assert.equal((await service.read('owner-auth')).matches.length,1,'retry must not duplicate');
assert.equal((await service.read('member-auth')).matches[0].status,'pending');
await assert.rejects(act('member-auth',{action:'confirm_match',id:'match-one'}),e=>e.status===403);
await assert.rejects(act('outsider-auth',{action:'confirm_match',id:'match-one'}),e=>e.status===403);
await act('opponent-auth',{action:'confirm_match',id:'match-one'});
assert.equal((await service.read('member-auth')).matches[0].status,'confirmed');
await assert.rejects(act('member-auth',{action:'void_match',id:'match-one'}),e=>e.status===403);
await act('owner-auth',{action:'void_match',id:'match-one'});
assert.equal((await service.read('owner-auth')).matches[0].status,'voided');
assert.equal(sql.prepare('SELECT count(*) AS n FROM audit WHERE match_id=?').get('match-one').n,3);
await act('owner-auth',{...result,id:'verified-match',a:owner,b:'guest-one'});
assert.equal((await service.read('owner-auth')).matches.find(m=>m.id==='verified-match').status,'confirmed');
await assert.rejects(act('outsider-auth',{action:'create_tournament',id:'forbidden',clubId:'club-one',name:'Wrong',date:'2026-10-10',format:'Round robin',capacity:4}),e=>e.status===403);
await act('owner-auth',{action:'create_tournament',id:'event-one',clubId:'club-one',name:'Club Open',date:'2026-10-10',format:'Round robin',capacity:4});
for(const playerId of [owner,member,opponent,'guest-one'])await act('owner-auth',{action:'enter_tournament',id:'event-one',playerId});
await act('owner-auth',{action:'add_guest',id:'guest-two',clubId:'club-one',name:'Another Guest'});
await assert.rejects(act('owner-auth',{action:'enter_tournament',id:'event-one',playerId:'guest-two'}),e=>e.status===409);
await act('member-auth',{action:'enter_tournament',id:'event-one',playerId:member});
assert.equal((await service.read('owner-auth')).entries.length,4);
await act('outsider-auth',{action:'request_join',clubId:'club-one'});
const anon=await service.read(null);assert.equal(anon.me,null);assert.ok(!JSON.stringify(anon).includes('owner-auth'));assert.ok(!anon.memberships.some(m=>m.status==='pending'));assert.ok(!anon.matches.some(m=>m.status!=='confirmed'||m.canConfirm||m.canVoid));
sql.close();open();const afterRestart=await makeService(db).read('owner-auth');assert.equal(afterRestart.matches.length,2);assert.equal(afterRestart.entries.length,4);assert.equal(afterRestart.clubs.length,2);
assert.equal(scoreError('a','b',[[12,10],[11,5]],3),null);assert.match(scoreError('a','b',[[11,5],[11,5],[11,4]],3),/after/);
console.log('Passed: real SQLite migrations and persistence; profile identity; club isolation; join approval; guest permissions; score validation; duplicate retries; opponent confirmation; voiding/audit; event authorization/capacity; public data filtering.');

const tournament=(await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one');
const go=async(action,extra={},who='owner-auth',eventId='event-one')=>{
 const t=(await service.read(who)).tournaments.find(t=>t.id===eventId);
 return act(who,{action,id:eventId,revision:t.revision,operationId:crypto.randomUUID(),...extra});
};
await assert.rejects(go('start_tournament',{seeds:[owner,member,opponent,'guest-one'],bestOf:3},'outsider-auth'),e=>e.status===403);
await assert.rejects(go('start_tournament',{seeds:[owner,member,opponent],bestOf:3}),e=>e.status===400);
await go('start_tournament',{seeds:[owner,member,opponent,'guest-one'],bestOf:3});
await assert.rejects(go('enter_tournament',{playerId:'guest-two'}),e=>e.status===409);
let t=(await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one');
assert.equal(t.state.fixtures.length,6);
const payload={action:'score_fixture',id:'event-one',revision:t.revision,operationId:crypto.randomUUID(),fixtureId:t.state.fixtures[0].id,games:[[11,5],[11,6]]};
await act('owner-auth',payload);await act('owner-auth',payload);
assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='event-one'&&m.status==='confirmed').length,1);
await assert.rejects(act('owner-auth',{...payload,operationId:crypto.randomUUID()}),e=>e.status===409);
await assert.rejects(act('owner-auth',{action:'void_match',id:`t_event-one_${t.state.fixtures[0].id}`}),e=>e.status===409);
await go('reset_fixture',{fixtureId:t.state.fixtures[0].id});
assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='event-one'&&m.status==='confirmed').length,0);
for(;;){t=(await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one');const f=t.state.fixtures.find(f=>f.status==='ready');if(!f)break;await go('score_fixture',{fixtureId:f.id,games:[[11,7],[11,8]]})}
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one').status,'completed');
const publicPlayer=await getPublicPlayer(db,owner);assert.equal(publicPlayer.name,'Owner');assert.ok(publicPlayer.matches.every(m=>m.opponentId&&m.clubName));
const publicEvent=await getPublicTournament(db,'event-one');assert.equal(publicEvent.name,'Club Open');assert.equal(publicEvent.entrants.length,4);assert.ok(publicEvent.state);
await go('reset_fixture',{fixtureId:t.state.fixtures[0].id});
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one').status,'active');
// Two stale writers must not commit conflicting results or duplicate statistics.
t=(await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one');
const base={action:'score_fixture',id:t.id,revision:t.revision,fixtureId:t.state.fixtures[0].id,games:[[11,7],[11,8]]};
const racing=await Promise.allSettled([act('owner-auth',{...base,operationId:crypto.randomUUID()}),act('owner-auth',{...base,operationId:crypto.randomUUID()})]);
assert.equal(racing.filter(r=>r.status==='fulfilled').length,1);
assert.equal(racing.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
// Full knockout run, downstream correction, then withdrawal.
await act('owner-auth',{action:'create_tournament',id:'knockout',clubId:'club-one',name:'Knockout',date:'2026-09-29',format:'Single elimination',capacity:8});
for(const p of [owner,member,opponent,'guest-one','guest-two'])await go('enter_tournament',{playerId:p},'owner-auth','knockout');
await go('start_tournament',{seeds:[owner,member,opponent,'guest-one','guest-two'],bestOf:3},'owner-auth','knockout');
let k;for(;;){k=(await service.read('owner-auth')).tournaments.find(t=>t.id==='knockout');const f=k.state.fixtures.find(f=>f.status==='ready');if(!f)break;await go('score_fixture',{fixtureId:f.id,games:[[11,7],[11,8]]},'owner-auth','knockout')}
assert.equal(k.status,'completed');assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='knockout'&&m.status==='confirmed').length,4);
await go('reset_fixture',{fixtureId:'r1m2'},'owner-auth','knockout');
k=(await service.read('owner-auth')).tournaments.find(t=>t.id==='knockout');
assert.equal(k.status,'active');assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='knockout'&&m.status==='confirmed').length,1);
await go('withdraw_player',{playerId:'guest-one'},'owner-auth','knockout');
await assert.rejects(go('score_fixture',{fixtureId:'r1m2',games:[[11,7],[11,8]]},'member-auth','knockout'),e=>e.status===403);
await act('owner-auth',{action:'create_tournament',id:'double',clubId:'club-one',name:'Double Knockout',date:'2026-09-30',format:'Double elimination',capacity:4});
for(const p of [owner,member,opponent,'guest-one'])await go('enter_tournament',{playerId:p},'owner-auth','double');
await go('start_tournament',{seeds:[owner,member,opponent,'guest-one'],bestOf:3},'owner-auth','double');
let d;for(;;){d=(await service.read('owner-auth')).tournaments.find(t=>t.id==='double');const f=d.state.fixtures.find(f=>f.status==='ready');if(!f)break;await go('score_fixture',{fixtureId:f.id,games:[[11,7],[11,8]]},'owner-auth','double')}
assert.equal(d.status,'completed');assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='double'&&m.status==='confirmed').length,6);
assert.equal(d.state.fixtures.find(f=>f.id==='gf2').status,'bye');
await go('reset_fixture',{fixtureId:'w1m1'},'owner-auth','double');
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='double').status,'active');
await act('owner-auth',{action:'create_tournament',id:'bronze',clubId:'club-one',name:'Bronze Match',date:'2026-10-01',format:'Single elimination',capacity:4});
for(const p of [owner,member,opponent,'guest-one'])await go('enter_tournament',{playerId:p},'owner-auth','bronze');
await go('start_tournament',{seeds:[owner,member,opponent,'guest-one'],bestOf:3,thirdPlace:true},'owner-auth','bronze');
let bronze;for(;;){bronze=(await service.read('owner-auth')).tournaments.find(t=>t.id==='bronze');const f=bronze.state.fixtures.find(f=>f.status==='ready');if(!f)break;await go('score_fixture',{fixtureId:f.id,games:[[11,7],[11,8]]},'owner-auth','bronze')}
assert.equal(bronze.status,'completed');assert.equal(bronze.state.thirdPlace,true);assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='bronze'&&m.status==='confirmed').length,4);
sql.close();open();assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='knockout').state.withdrawn[0],'guest-one');sql.close();
console.log('Passed: locked draws; official scoring; idempotent retry; concurrent stale writers; full round robin; single and double knockout; downstream reset and statistics cleanup; withdrawal; migration/persistence across reopen.');

open();
await act('owner-auth',{action:'create_tournament',id:'custom-field',clubId:'club-one',name:'Custom field',date:'2026-10-10',format:'Single elimination',capacity:37});
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='custom-field').capacity,37);
await assert.rejects(act('owner-auth',{action:'create_tournament',id:'bad-field',clubId:'club-one',name:'Invalid',date:'2026-10-10',format:'Single elimination',capacity:3.5}),e=>e.status===400);
await go('set_capacity',{capacity:99},'owner-auth','custom-field');
await go('add_tournament_guest',{name:'Walk-in player'},'owner-auth','custom-field');
let custom=(await service.read('owner-auth')).tournaments.find(t=>t.id==='custom-field');
const guest=(await service.read('owner-auth')).players.find(p=>p.name==='Walk-in player');assert.equal(guest.is_guest,1);
assert.ok((await service.read('owner-auth')).entries.some(e=>e.player_id===guest.id&&e.tournament_id==='custom-field'));
await assert.rejects(go('add_tournament_guest',{name:'Unauthorized'},'member-auth','custom-field'),e=>e.status===403);
await go('enter_tournament',{playerId:owner},'owner-auth','custom-field');
await go('enter_tournament',{playerId:member},'owner-auth','custom-field');
await assert.rejects(go('set_capacity',{capacity:2},'owner-auth','custom-field'),e=>e.status===400);
custom=(await service.read('owner-auth')).tournaments.find(t=>t.id==='custom-field');
assert.equal(custom.seedStats.at(-1).id,guest.id,'guest with no matches comes after rated players');
const expectedSeeds=custom.seedStats.map(s=>s.id);
await go('start_tournament',{bestOf:3},'owner-auth','custom-field');
assert.deepEqual((await service.read('owner-auth')).tournaments.find(t=>t.id==='custom-field').state.seeds,expectedSeeds);
await assert.rejects(go('set_capacity',{capacity:55},'owner-auth','custom-field'),e=>e.status===409);
await assert.rejects(go('add_tournament_guest',{name:'Late guest'},'owner-auth','custom-field'),e=>e.status===409);
sql.close();console.log('Passed: arbitrary integer capacity, capacity edits, atomic no-account guest registration, guest permissions, statistic-based auto seeds, post-start registration lock.');

{
 const old=new DatabaseSync(':memory:');old.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0007')).sort())old.exec(readFileSync('drizzle/'+f,'utf8'));
 old.exec("INSERT INTO profiles (id,name,created_at) VALUES ('old-one','Old One','2026-10-01'),('old-two','Old Two','2026-10-01');INSERT INTO profiles (id,name,created_at,deleted_at) VALUES ('old-deleted','Deleted player','2026-10-01','2026-10-02')");
 old.exec(readFileSync('drizzle/0007_player_details_and_roles.sql','utf8'));
 const existing=old.prepare('SELECT rally_id FROM profiles WHERE deleted_at IS NULL').all();
 assert.equal(new Set(existing.map(p=>p.rally_id)).size,2);assert.ok(existing.every(p=>/^RLY-[A-F0-9]{12}$/.test(p.rally_id)));
 assert.equal(old.prepare("SELECT rally_id FROM profiles WHERE id='old-deleted'").get().rally_id,null);old.close();
}
console.log('Passed: existing player migration assigns unique Rally IDs without restoring deleted identities.');
