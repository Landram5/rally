import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','rally-service','tournament-service','tournament-engine','match-rules','rally-errors','seeding','public-rally']){
 const compiled=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, "from './$1.mjs'");
 writeFileSync(`.test-runtime/${name}.mjs`,compiled);
}
const {makeService,scoreError}=await import('../.test-runtime/rally-service.mjs');
const {getPublicPlayer,getPublicTournament,getPublicDirectory}=await import('../.test-runtime/public-rally.mjs');
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
assert.equal((await getPublicDirectory(db,'tournaments')).tournaments.length,0,'pending tournaments excluded from public home');
assert.equal((await getPublicDirectory(db,'players')).players.length,0,'pending club members and unattached accounts excluded');
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
for(const kind of ['photo','banner']){
 await assert.rejects(act('member-auth',{action:'set_club_media',clubId:'club-one',kind,image:photo}),e=>e.status===403);
 await act('owner-auth',{action:'set_club_media',clubId:'club-one',kind,image:photo});
 assert.equal(sql.prepare('SELECT image_data FROM club_media WHERE club_id=? AND kind=?').get('club-one',kind).image_data,photo);
 assert.ok((await service.read('member-auth')).clubs.find(c=>c.id==='club-one')[kind+'_url']);
 await act('owner-auth',{action:'set_club_media',clubId:'club-one',kind,image:null});
 assert.equal(sql.prepare('SELECT count(*) AS n FROM club_media WHERE club_id=? AND kind=?').get('club-one',kind).n,0);
}
await assert.rejects(act('owner-auth',{action:'set_club_media',clubId:'club-two',kind:'photo',image:photo}),e=>e.status===403);
await assert.rejects(act('owner-auth',{action:'set_club_media',clubId:'club-one',kind:'photo',image:'data:image/svg+xml;base64,PHN2Zz4='}),e=>e.status===400);
const feedback={action:'submit_feedback',id:'feedback-test',type:'bug',title:'Score button',description:'Tap did not add a point.',page:'/'};
await act('member-auth',feedback);await act('member-auth',feedback);
assert.equal((await service.read('member-auth')).feedback.length,1,'feedback retries are idempotent');
assert.equal((await service.read('opponent-auth')).feedback.length,0,'feedback stays private');
assert.equal((await service.read('owner-auth',{isSiteAdmin:true})).feedback.length,1);
await assert.rejects(act('member-auth',{action:'set_feedback_status',id:feedback.id,status:'planned'}),e=>e.status===403);
await adminAct('owner-auth',{action:'set_feedback_status',id:feedback.id,status:'planned'});
assert.equal((await service.read('member-auth')).feedback[0].status,'planned');
await assert.rejects(act('member-auth',{...feedback,id:'bad-feedback',page:'https://example.com/private?token=123'}),e=>e.status===400);
for(let i=1;i<5;i++)await act('member-auth',{...feedback,id:'rate-'+i});
await assert.rejects(act('member-auth',{...feedback,id:'rate-over'}),e=>e.status===429);
console.log('Passed: club media permissions, validation, replacement and removal; feedback privacy, status authorization, idempotency and rate limits.');

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
await go('reset_fixture',{note:'Correcting a score',fixtureId:t.state.fixtures[0].id});
assert.equal((await service.read('owner-auth')).matches.filter(m=>m.tournament_id==='event-one'&&m.status==='confirmed').length,0);
for(;;){t=(await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one');const f=t.state.fixtures.find(f=>f.status==='ready');if(!f)break;await go('score_fixture',{fixtureId:f.id,games:[[11,7],[11,8]]})}
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='event-one').status,'completed');
const publicPlayer=await getPublicPlayer(db,owner);assert.equal(publicPlayer.name,'Owner');assert.ok(publicPlayer.matches.every(m=>m.opponentId&&m.clubName));
const publicEvent=await getPublicTournament(db,'event-one');assert.equal(publicEvent.name,'Club Open');assert.equal(publicEvent.entrants.length,4);assert.ok(publicEvent.state);
await go('reset_fixture',{note:'Correcting a score',fixtureId:t.state.fixtures[0].id});
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
await go('reset_fixture',{note:'Correcting a score',fixtureId:'r1m2'},'owner-auth','knockout');
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
await go('reset_fixture',{note:'Correcting a score',fixtureId:'w1m1'},'owner-auth','double');
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
await act('owner-auth',{action:'create_tournament',id:'cross-rating',clubId:'club-one',name:'Cross Club Rating Test',date:'2026-10-01',format:'Single elimination',capacity:4});
for(const playerId of [owner,member])await go('enter_tournament',{playerId},'owner-auth','cross-rating');
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='cross-rating').rating_weight,2);
sql.prepare("INSERT OR IGNORE INTO memberships (id,club_id,player_id,role,status,created_at) VALUES ('cross-membership','club-two',?,'member','active','2026-10-01')").run(member);
assert.equal((await service.read('owner-auth')).tournaments.find(t=>t.id==='cross-rating').rating_weight,3,'registration previews mixed affiliations');
await go('start_tournament',{seeds:[owner,member],bestOf:3},'owner-auth','cross-rating');
assert.equal(sql.prepare("SELECT rating_weight FROM tournaments WHERE id='cross-rating'").get().rating_weight,3);
sql.prepare("UPDATE memberships SET status='pending' WHERE club_id='club-two' AND player_id=?").run(member);
let cross=(await service.read('owner-auth')).tournaments.find(t=>t.id==='cross-rating');
assert.equal(cross.rating_weight,3,'locked weight survives membership changes');
await go('score_fixture',{fixtureId:cross.state.fixtures.find(f=>f.status==='ready').id,games:[[11,7],[11,8]]},'owner-auth','cross-rating');
assert.equal((await service.read('owner-auth')).matches.find(m=>m.tournament_id==='cross-rating').tournament_weight,3,'official results carry persisted multiplier');
cross=(await service.read('owner-auth')).tournaments.find(t=>t.id==='cross-rating');
await go('reset_fixture',{note:'Correcting a score',fixtureId:cross.state.fixtures.find(f=>f.status==='played').id},'owner-auth','cross-rating');
assert.equal(sql.prepare("SELECT rating_weight FROM tournaments WHERE id='cross-rating'").get().rating_weight,3,'reset cannot reclassify a draw');
console.log('Passed: cross-club registration preview, atomic weight snapshot, membership-change stability, weighted official results and reset stability.');

// Deletion requires the actual creator, explicit confirmation and a current revision.
assert.equal(sql.prepare("SELECT created_by FROM tournaments WHERE id='bronze'").get().created_by,owner);
const bronzeBefore=(await service.read('owner-auth')).tournaments.find(t=>t.id==='bronze');
assert.equal(bronzeBefore.canDelete,true);
assert.equal((await service.read('member-auth')).tournaments.find(t=>t.id==='bronze').canDelete,false);
const removal={action:'delete_tournament',id:'bronze',revision:bronzeBefore.revision,confirmation:'DELETE',operationId:crypto.randomUUID()};
await assert.rejects(act('member-auth',removal),e=>e.status===403);
await assert.rejects(act('owner-auth',{...removal,confirmation:undefined}),e=>e.status===400);
await assert.rejects(act('owner-auth',{...removal,revision:undefined}),e=>e.status===400);
await assert.rejects(act('owner-auth',{...removal,revision:removal.revision-1}),e=>e.status===409);
const regularBefore=sql.prepare('SELECT id,status FROM matches WHERE tournament_id IS NULL ORDER BY id').all();
const bronzeMatches=sql.prepare("SELECT id FROM matches WHERE tournament_id='bronze' AND status='confirmed'").all();
assert.equal(bronzeMatches.length,4);
await act('owner-auth',removal);
assert.ok(sql.prepare("SELECT deleted_at FROM tournaments WHERE id='bronze'").get().deleted_at);
assert.equal((await service.read('owner-auth')).tournaments.some(t=>t.id==='bronze'),false);
assert.equal((await service.read('owner-auth')).matches.some(m=>m.tournament_id==='bronze'),false);
assert.equal(await getPublicTournament(db,'bronze'),null);
assert.equal((await getPublicDirectory(db,'tournaments')).tournaments.some(t=>t.id==='bronze'),false);
assert.equal((await getPublicDirectory(db,'matches')).matches.some(m=>m.tournament_id==='bronze'),false);
assert.equal(sql.prepare("SELECT count(*) n FROM matches WHERE tournament_id='bronze' AND status='voided'").get().n,4);
assert.equal(sql.prepare("SELECT count(*) n FROM audit WHERE action='tournament_deleted'").get().n,4);
assert.deepEqual(sql.prepare('SELECT id,status FROM matches WHERE tournament_id IS NULL ORDER BY id').all(),regularBefore);
await act('owner-auth',removal); // An identical network retry is safe.
assert.equal(sql.prepare("SELECT count(*) n FROM audit WHERE action='tournament_deleted'").get().n,4);
await assert.rejects(act('owner-auth',{...removal,operationId:crypto.randomUUID(),revision:removal.revision+1}),e=>e.status===404);
await assert.rejects(act('owner-auth',{action:'reset_fixture',note:'Correcting a recorded score',id:'bronze',fixtureId:'r1m1',operationId:crypto.randomUUID()}),e=>e.status===404);
// A creator keeps deletion rights after demotion, but must still be an active member.
sql.prepare("UPDATE memberships SET role='admin' WHERE club_id='club-one' AND player_id=?").run(member);
await act('member-auth',{action:'create_tournament',id:'creator-event',clubId:'club-one',name:'Creator event',date:'2026-10-06',format:'Single elimination',capacity:4,created_by:owner});
assert.equal(sql.prepare("SELECT created_by FROM tournaments WHERE id='creator-event'").get().created_by,member,'creator cannot be forged');
await assert.rejects(go('delete_tournament',{confirmation:'DELETE'},'owner-auth','creator-event'),e=>e.status===403);
sql.prepare("UPDATE memberships SET role='member',status='pending' WHERE club_id='club-one' AND player_id=?").run(member);
await assert.rejects(go('delete_tournament',{confirmation:'DELETE'},'member-auth','creator-event'),e=>e.status===403);
sql.prepare("UPDATE memberships SET status='active' WHERE club_id='club-one' AND player_id=?").run(member);
await go('delete_tournament',{confirmation:'DELETE'},'member-auth','creator-event');
assert.equal((await service.read('member-auth')).tournaments.some(t=>t.id==='creator-event'),false);
// Old events have no recorded creator, so only their current club owner can delete them.
await act('owner-auth',{action:'create_tournament',id:'legacy-delete',clubId:'club-one',name:'Legacy',date:'2026-10-06',format:'Round robin',capacity:4});
sql.prepare("UPDATE tournaments SET created_by=NULL WHERE id='legacy-delete'").run();
await assert.rejects(go('delete_tournament',{confirmation:'DELETE'},'member-auth','legacy-delete'),e=>e.status===403);
await go('delete_tournament',{confirmation:'DELETE'},'owner-auth','legacy-delete');
// Account deletion clears creator identity without deleting the shared tournament.
await act('opponent-auth',{action:'save_profile',name:'Opponent'});
sql.prepare("UPDATE tournaments SET created_by=? WHERE id='custom-field'").run(opponent);
sql.prepare("UPDATE profiles SET deleted_at='2026-10-06',name='Deleted player',auth_id=NULL WHERE id=?").run(opponent);
assert.equal(sql.prepare("SELECT created_by FROM tournaments WHERE id='custom-field'").get().created_by,null);
assert.equal(sql.prepare("SELECT deleted_at FROM tournaments WHERE id='custom-field'").get().deleted_at,null);
console.log('Passed: creator-only deletion, active membership, legacy owner fallback, confirmation/revision checks, official result cleanup, public hiding, retry safety and creator account deletion.');


await assert.rejects(act('member-auth',{action:'update_club',clubId:'club-one',name:'Hijacked',location:'Somewhere',bio:'Unauthorized'}),e=>e.status===403);
await assert.rejects(act('owner-auth',{action:'update_club',clubId:'club-two',name:'Hijacked',location:'Somewhere',bio:'Unauthorized'}),e=>e.status===403);
await assert.rejects(act('owner-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:'x'.repeat(1201)}),e=>e.status===400);
await act('owner-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:' Weekly play and tournaments. '});
assert.equal((await service.read(null)).clubs.find(c=>c.id==='club-one').bio,'Weekly play and tournaments.');
assert.equal((await service.read(null)).clubs.find(c=>c.id==='club-one').canAssignRoles,false);
assert.equal((await service.read(null)).clubs.find(c=>c.id==='club-one').canManage,false);
assert.ok((await service.read(null)).memberships.every(m=>m.status==='active'),'public club pages must not reveal membership requests');
sql.prepare("UPDATE memberships SET status='pending' WHERE club_id='club-one' AND player_id=?").run(owner);
await assert.rejects(act('owner-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:'Blocked'}),e=>e.status===403);
sql.prepare("UPDATE memberships SET status='active' WHERE club_id='club-one' AND player_id=?").run(owner);
console.log('Passed: club bio persistence, validation, owner-only edits, revoked access and public membership privacy.');

await act('owner-auth',{action:'create_tournament',id:'notification-event',clubId:'club-one',name:'Notification Test',date:'2099-10-10',format:'Single elimination',capacity:4});
const noticeId='register-notification-event';
assert.ok((await service.read('owner-auth')).notifications.some(n=>n.id===noticeId&&!n.read));
await assert.rejects(act('outsider-auth',{action:'mark_notification_read',id:noticeId}),e=>e.status===404);
await act('member-auth',{action:'mark_notification_read',id:noticeId,playerId:owner});
assert.equal((await service.read('member-auth')).notifications.find(n=>n.id===noticeId).read,true);
assert.equal((await service.read('owner-auth')).notifications.find(n=>n.id===noticeId).read,false,'read state belongs to the acting player');
await act('member-auth',{action:'mark_notification_read',id:noticeId});
assert.equal(sql.prepare('SELECT count(*) n FROM notification_reads WHERE player_id=? AND notification_id=?').get(member,noticeId).n,1,'read retries are idempotent');
await act('owner-auth',{action:'mark_notifications_read'});
assert.ok((await service.read('owner-auth')).notifications.every(n=>n.read));
assert.deepEqual((await service.read(null)).notifications,[],'anonymous reads must not expose an inbox');
sql.close();open();assert.equal((await service.read('member-auth')).notifications.find(n=>n.id===noticeId).read,true,'read state persists across reopen');
await go('delete_tournament',{confirmation:'DELETE'},'owner-auth','notification-event');
assert.equal((await service.read('member-auth')).notifications.some(n=>n.id===noticeId),false,'deleted events disappear from the inbox');
console.log('Passed: notification eligibility, self-only read receipts, idempotency, persistence, mark-all, anonymous privacy and deleted event cleanup.');
const publicEvents=await getPublicDirectory(db,'tournaments');
assert.ok(publicEvents.tournaments.length>0);
assert.equal((await getPublicDirectory(db,'tournaments',"' OR 1=1 --")).tournaments.length,0,'public search is parameterized');
assert.equal((await getPublicDirectory(db,'players','%')).players.length,0,'search treats wildcards literally');
for(const m of (await getPublicDirectory(db,'matches')).matches){
 assert.equal(sql.prepare('SELECT status FROM matches WHERE id=?').get(m.id).status,'confirmed','only verified public results');
 assert.equal(sql.prepare('SELECT c.approval_status FROM clubs c JOIN matches m ON m.club_id=c.id WHERE m.id=?').get(m.id).approval_status,'approved');
 assert.ok(Array.isArray(m.games));
}
for(let n=0;n<26;n++){
 sql.prepare('INSERT INTO profiles (id,name,created_at) VALUES (?,?,?)').run('directory-'+n,'Directory '+String(n).padStart(2,'0'),'2026-10-06');
 sql.prepare("INSERT INTO memberships (id,club_id,player_id,role,status,created_at) VALUES (?,?,?,'member','active',?)").run('directory-membership-'+n,'club-one','directory-'+n,'2026-10-06');
}
const firstPage=await getPublicDirectory(db,'players','Directory',1),secondPage=await getPublicDirectory(db,'players','Directory',2);
assert.equal(firstPage.players.length,24);assert.equal(firstPage.hasMore,true);assert.equal(secondPage.players.length,2);assert.equal(secondPage.hasMore,false);
assert.equal(new Set([...firstPage.players,...secondPage.players].map(p=>p.id)).size,26,'stable pages do not repeat players');
sql.prepare("UPDATE profiles SET deleted_at='2026-10-06',name='Deleted player' WHERE id='directory-0'").run();
assert.equal((await getPublicDirectory(db,'players','Deleted player')).players.length,0,'deleted identities excluded');
console.log('Passed: public discovery hides pending clubs and unverified results, parameterized literal search, pagination and deleted profiles.');

// Practical club fields and event operations must survive storage, respect roles and deadlines.
await act('owner-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:'Club bio',venue:'Community hall',meeting_schedule:'Tuesdays 6 PM',contact:'club@example.test',joining_info:'Request membership first.'});
assert.equal((await service.read(null)).clubs.find(c=>c.id==='club-one').venue,'Community hall');
await act('owner-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:'Revised bio'});
assert.equal((await service.read(null)).clubs.find(c=>c.id==='club-one').venue,'Community hall','older clients preserve optional fields');
await assert.rejects(act('member-auth',{action:'update_club',clubId:'club-one',name:'Club One',location:'Baltimore',bio:'',venue:'Wrong'}),e=>e.status===403);
await act('owner-auth',{action:'create_tournament',id:'logistics-event',clubId:'club-one',name:'Scheduled Event',date:'2099-10-10',format:'Single elimination',capacity:8});
await assert.rejects(go('set_event_logistics',{startsAt:'2099-02-30T10:00:00Z'},'owner-auth','logistics-event'),e=>e.status===400);
await assert.rejects(go('set_event_logistics',{startsAt:'2099-10-10T10:00:00Z',registrationClosesAt:'2099-10-10T12:00:00Z'},'owner-auth','logistics-event'),e=>e.status===400);
await assert.rejects(go('set_event_logistics',{checkInOpen:true},'member-auth','logistics-event'),e=>e.status===403);
await go('set_event_logistics',{registrationClosesAt:'2000-01-01T12:00:00Z',startsAt:'2099-10-10T18:00:00Z',checkInOpen:true},'owner-auth','logistics-event');
await assert.rejects(go('enter_tournament',{playerId:member},'member-auth','logistics-event'),e=>e.status===409);
await assert.rejects(go('add_tournament_guest',{name:'Late guest'},'owner-auth','logistics-event'),e=>e.status===409);
await go('set_event_logistics',{registrationClosesAt:'2099-10-10T16:00:00Z',startsAt:'2099-10-10T18:00:00Z',checkInOpen:true},'owner-auth','logistics-event');
await go('enter_tournament',{playerId:member},'member-auth','logistics-event');await go('enter_tournament',{playerId:owner},'owner-auth','logistics-event');
await assert.rejects(go('set_check_in',{playerId:owner,checkedIn:true},'member-auth','logistics-event'),e=>e.status===403);
await go('set_check_in',{playerId:member,checkedIn:true},'member-auth','logistics-event');
assert.ok((await service.read('member-auth')).tournaments.find(t=>t.id==='logistics-event').checkedIn.includes(member));
await go('set_check_in',{playerId:member,checkedIn:false},'member-auth','logistics-event');assert.equal(sql.prepare('SELECT checked_in_at FROM entries WHERE tournament_id=? AND player_id=?').get('logistics-event',member).checked_in_at,null);
await go('start_tournament',{seeds:[member,owner],bestOf:3},'owner-auth','logistics-event');
const logisticsDraw=JSON.parse(sql.prepare('SELECT state_json FROM tournaments WHERE id=?').get('logistics-event').state_json),ready=logisticsDraw.fixtures.find(f=>f.status==='ready');
await assert.rejects(go('set_fixture_plan',{fixtureId:ready.id,court:'Table 1'},'member-auth','logistics-event'),e=>e.status===403);
await go('set_fixture_plan',{fixtureId:ready.id,court:'Table 1',startsAt:'2099-10-10T18:30:00Z'},'owner-auth','logistics-event');
assert.equal((await getPublicTournament(db,'logistics-event')).fixturePlans[0].court,'Table 1');
assert.equal((await getPublicTournament(db,'logistics-event')).startsAt,'2099-10-10T18:00:00.000Z');
await assert.rejects(go('set_fixture_plan',{fixtureId:'missing',court:'Table 2'},'owner-auth','logistics-event'),e=>e.status===409);
const staleLogisticsRevision=sql.prepare('SELECT revision FROM tournaments WHERE id=?').get('logistics-event').revision;
await go('set_event_logistics',{checkInOpen:false},'owner-auth','logistics-event');await assert.rejects(go('set_check_in',{playerId:member,checkedIn:true},'member-auth','logistics-event'),e=>e.status===409);
await assert.rejects(act('owner-auth',{action:'set_fixture_plan',id:'logistics-event',revision:staleLogisticsRevision,operationId:crypto.randomUUID(),fixtureId:ready.id,court:'Stale'}),e=>e.status===409);
console.log('Passed club details, preserved fields, event deadline validation/enforcement, check-in identity, scheduling permissions, public plans and stale writers.');
const {readActivityPage}=await import('../.test-runtime/activity-pages.mjs');
const roster1=await readActivityPage(db,null,{view:'members',club:'club-one',page:1}),roster2=await readActivityPage(db,null,{view:'members',club:'club-one',page:2});assert.equal(roster1.items.length,20);assert.ok(roster1.hasMore);assert.equal(new Set([...roster1.items,...roster2.items].map(p=>p.id)).size,roster1.items.length+roster2.items.length);
assert.equal((await readActivityPage(db,null,{view:'members',club:'club-one',search:'%'})).items.length,0);
assert.equal((await readActivityPage(db,null,{view:'members',club:'club-one',role:'owner'})).items.length,1);
await assert.rejects(readActivityPage(db,null,{view:'matches'}),e=>e.status===401);
const full=await service.read('owner-auth'),compact=await service.read('owner-auth',{compact:true});assert.ok(compact.matches.length<=20);assert.equal(compact.summaries.all.confirmed,full.matches.filter(m=>m.status==='confirmed').length);assert.equal(compact.summaries['club-one'].confirmed,full.matches.filter(m=>m.club_id==='club-one'&&m.status==='confirmed').length);assert.ok(compact.tournaments.every(t=>t.state===null));assert.deepEqual(compact.dashboards,full.dashboards,'compact dashboards preserve all actionable events and matches');assert.doesNotThrow(()=>JSON.stringify(compact.dashboards));assert.deepEqual(compact.notifications,full.notifications,'compact reads preserve ready-match notifications');const {stats}=await import('../.test-runtime/rally.mjs');const converted=full.matches.map(m=>({id:m.id,a:m.a,b:m.b,games:m.games,date:m.played_on,club:m.club_id,status:m.status,kind:m.tournament_id?'Tournament':'Club play'}));for(const p of full.players)if(compact.summaries.all.stats[p.id])assert.deepEqual(compact.summaries.all.stats[p.id],stats(p.id,converted));
const pageMatch=full.matches.find(m=>m.status==='pending');if(pageMatch){const focused=await readActivityPage(db,'owner-auth',{view:'matches',match:pageMatch.id});assert.equal(focused.items.length,1);assert.equal(focused.items[0].id,pageMatch.id);}
const pagedEvents=await readActivityPage(db,null,{view:'tournaments',club:'club-one',status:'upcoming'});assert.ok(pagedEvents.items.every(t=>t.status!=='completed'));assert.ok(pagedEvents.items.every(t=>!('state_json' in t)));
const scoped=await service.read(null,{clubId:'club-one',compact:true});assert.ok(scoped.clubs.every(c=>c.id==='club-one'));assert.equal(scoped.memberships.length,0);assert.equal(scoped.summaries['club-one'].confirmed,compact.summaries['club-one'].confirmed);
// Public club props cross the Server Component boundary: null-prototype maps
// aggregate safely but must become plain objects before React serializes them.
assert.equal(Object.getPrototypeOf(scoped.summaries),Object.prototype);
for(const summary of Object.values(scoped.summaries)){
 assert.equal(Object.getPrototypeOf(summary.stats),Object.prototype);
 assert.equal(Object.getPrototypeOf(summary.opponents),Object.prototype);
 for(const opponents of Object.values(summary.opponents))assert.equal(Object.getPrototypeOf(opponents),Object.prototype);
}
await act('page-private-auth',{action:'save_profile',name:'Private organizer'});await act('page-private-auth',{action:'create_club',id:'page-private-club',name:'Private club',location:'Baltimore'});await act('page-private-auth',{action:'create_tournament',id:'page-private-event',clubId:'page-private-club',name:'Private event',date:'2099-10-10',format:'Round robin',capacity:4});
assert.equal((await readActivityPage(db,null,{view:'members',club:'page-private-club'})).total,0);assert.equal((await readActivityPage(db,'member-auth',{view:'members',club:'page-private-club'})).total,0);assert.equal((await readActivityPage(db,'page-private-auth',{view:'members',club:'page-private-club'})).total,1);assert.equal((await readActivityPage(db,null,{view:'tournaments',club:'page-private-club'})).total,0);assert.equal((await readActivityPage(db,'page-private-auth',{view:'tournaments',club:'page-private-club'})).total,1);assert.equal((await service.read(null,{clubId:'page-private-club',compact:true})).clubs.length,0);
console.log('Passed server-side member/event/result pagination, literal search, anonymous visibility, focused results, scoped club reads and full-history compact summaries.');
sql.close();console.log('Passed: arbitrary integer capacity, capacity edits, atomic no-account guest registration, guest permissions, statistic-based auto seeds, post-start registration lock.');

{
 const old=new DatabaseSync(':memory:');old.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&f<'0007').sort())old.exec(readFileSync('drizzle/'+f,'utf8'));
 old.exec("INSERT INTO profiles (id,name,created_at) VALUES ('old-one','Old One','2026-10-01'),('old-two','Old Two','2026-10-01');INSERT INTO profiles (id,name,created_at,deleted_at) VALUES ('old-deleted','Deleted player','2026-10-01','2026-10-02')");
 old.exec(readFileSync('drizzle/0007_player_details_and_roles.sql','utf8'));
 const existing=old.prepare('SELECT rally_id FROM profiles WHERE deleted_at IS NULL').all();
 assert.equal(new Set(existing.map(p=>p.rally_id)).size,2);assert.ok(existing.every(p=>/^RLY-[A-F0-9]{12}$/.test(p.rally_id)));
 assert.equal(old.prepare("SELECT rally_id FROM profiles WHERE id='old-deleted'").get().rally_id,null);old.close();
}
console.log('Passed: existing player migration assigns unique Rally IDs without restoring deleted identities.');
