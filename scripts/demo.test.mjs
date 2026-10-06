import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['demo-state','rally','match-rules','tournament-engine','seeding']){
 const code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");
 writeFileSync(`.test-runtime/${name}.mjs`,code);
}
const {createDemoData,applyDemoAction}=await import('../.test-runtime/demo-state.mjs');
const {outcome}=await import('../.test-runtime/tournament-engine.mjs');
const seed=createDemoData();
assert.equal(seed.tournaments.filter(t=>t.status==='completed').length,4);
for(const t of seed.tournaments.filter(t=>t.status==='completed'))assert.equal(outcome(t.state).status,'completed');
const third=seed.tournaments.find(t=>t.id==='summer');assert.ok(third.state.thirdPlace);assert.ok(seed.matches.some(m=>m.tournament_id===third.id));
const pending=seed.matches.find(m=>m.status==='pending');assert.ok(pending);
const confirmed=applyDemoAction(seed,{action:'confirm_match',id:pending.id});assert.equal(confirmed.matches.find(m=>m.id===pending.id).status,'confirmed');assert.equal(pending.status,'pending');
let data=applyDemoAction(seed,{action:'create_tournament',id:'test-event',clubId:'harbor',name:'Test field',date:'2026-10-11',format:'Single elimination',capacity:8});
for(const playerId of ['alex','jordan','sam','riley'])data=applyDemoAction(data,{action:'enter_tournament',id:'test-event',playerId});
data=applyDemoAction(data,{action:'start_tournament',id:'test-event',seeds:['alex','jordan','sam','riley'],bestOf:3,thirdPlace:true});
let event=data.tournaments.find(t=>t.id==='test-event'),fixture=event.state.fixtures.find(f=>f.status==='ready');
data=applyDemoAction(data,{action:'score_fixture',id:event.id,revision:event.revision,fixtureId:fixture.id,games:[[11,7],[11,8]]});
assert.equal(data.matches.filter(m=>m.tournament_id===event.id).length,1);
assert.throws(()=>applyDemoAction(data,{action:'score_fixture',id:event.id,revision:event.revision,fixtureId:fixture.id,games:[[11,7],[11,8]]}),/draw changed/);
event=data.tournaments.find(t=>t.id==='test-event');data=applyDemoAction(data,{action:'reset_fixture',id:event.id,revision:event.revision,fixtureId:fixture.id});assert.equal(data.matches.filter(m=>m.tournament_id===event.id).length,0);
assert.equal(seed.tournaments.some(t=>t.id==='test-event'),false);
assert.throws(()=>applyDemoAction(seed,{action:'record_match',id:'invalid',clubId:'harbor',a:'alex',b:'jordan',bestOf:3,games:[[11,10],[11,7]],date:'2026-10-05'}),/win by two/);
assert.throws(()=>applyDemoAction(seed,{action:'record_match',clubId:'harbor',a:'alex',b:'jamie',bestOf:3,games:[[11,7],[11,8]],date:'2026-10-05'}),/active club players/);
const nonOwner=structuredClone(seed);nonOwner.memberships.find(m=>m.player_id==='alex'&&m.role==='owner').role='admin';
data=applyDemoAction(nonOwner,{action:'create_club',id:'new-club',name:'New sample',location:'Baltimore'});assert.throws(()=>applyDemoAction(data,{action:'create_club',id:'second',name:'Second',location:'Baltimore'}),/already own/);
console.log('Demo tournament history, progression, reset, validation and isolation checks passed.');

const photoDemo=createDemoData();
const withPhoto=applyDemoAction(photoDemo,{action:'save_profile',name:photoDemo.me.name,photo:'data:image/jpeg;base64,sample'});
assert.equal(withPhoto.players.find(p=>p.id===withPhoto.me.id).photo_url,'data:image/jpeg;base64,sample');
assert.equal(applyDemoAction(withPhoto,{action:'save_profile',name:withPhoto.me.name,photo:null}).players.find(p=>p.id===withPhoto.me.id).photo_url,null);
console.log('Demo profile photo upload and removal checks passed.');

const details=applyDemoAction(seed,{action:'save_profile',name:'Alex Updated',bio:'Sample bio'});
assert.equal(details.players.find(p=>p.id==='alex').bio,'Sample bio');
assert.equal(details.players.find(p=>p.id==='alex').rally_id,seed.players.find(p=>p.id==='alex').rally_id);
const leaders=applyDemoAction(seed,{action:'set_member_role',clubId:'harbor',playerId:'jordan',role:'board'});
assert.equal(leaders.memberships.find(m=>m.club_id==='harbor'&&m.player_id==='jordan').role,'board');
assert.throws(()=>applyDemoAction(seed,{action:'set_member_role',clubId:'harbor',playerId:'alex',role:'member'}),/active member/);
console.log('Demo bio, username, Rally ID and club role checks passed.');

let feedbackDemo=applyDemoAction(seed,{action:'submit_feedback',id:'sample-report',type:'feature',title:'Requested feature',description:'Sample details',page:'/'});
feedbackDemo=applyDemoAction(feedbackDemo,{action:'set_feedback_status',id:'sample-report',status:'planned'});
assert.equal(feedbackDemo.feedback[0].status,'planned');
assert.throws(()=>applyDemoAction(seed,{action:'submit_feedback',id:'bad-page',type:'bug',title:'Bug',description:'Details',page:'https://private.test?token=secret'}),/page path/);
const imageDemo=applyDemoAction(seed,{action:'set_club_media',clubId:'harbor',kind:'banner',image:'data:image/jpeg;base64,sample'});
assert.equal(imageDemo.clubs.find(c=>c.id==='harbor').banner_url,'data:image/jpeg;base64,sample');
assert.equal(applyDemoAction(imageDemo,{action:'set_club_media',clubId:'harbor',kind:'banner',image:null}).clubs.find(c=>c.id==='harbor').banner_url,null);
console.log('Demo feedback, review status and club image checks passed.');

const deletedDemo=applyDemoAction(seed,{action:'delete_tournament',id:'summer',revision:third.revision,confirmation:'DELETE'});
assert.equal(deletedDemo.tournaments.some(t=>t.id==='summer'),false);
assert.equal(deletedDemo.matches.some(m=>m.tournament_id==='summer'),false);
assert.equal(deletedDemo.entries.some(e=>e.tournament_id==='summer'),false);
assert.deepEqual(deletedDemo.matches.filter(m=>!m.tournament_id),seed.matches.filter(m=>!m.tournament_id));
assert.ok(seed.tournaments.some(t=>t.id==='summer'),'sample deletion must not mutate its input');
assert.throws(()=>applyDemoAction(seed,{action:'delete_tournament',id:'summer'}),/Confirm/);
const otherCreator=structuredClone(seed);otherCreator.tournaments.find(t=>t.id==='summer').created_by='jordan';
assert.throws(()=>applyDemoAction(otherCreator,{action:'delete_tournament',id:'summer',confirmation:'DELETE'}),/creator/);
console.log('Demo tournament deletion, confirmation, creator permissions and regular match preservation passed.');

const bioDemo=applyDemoAction(seed,{action:'update_club',clubId:'harbor',name:'Harbor Table Tennis',location:'Baltimore, MD',bio:'New club bio'});
assert.equal(bioDemo.clubs.find(c=>c.id==='harbor').bio,'New club bio');
assert.notEqual(seed.clubs.find(c=>c.id==='harbor').bio,'New club bio');
assert.throws(()=>applyDemoAction(seed,{action:'update_club',clubId:'metro',name:'Metro',location:'Columbia',bio:'Unauthorized'}),/owner/);
console.log('Demo club information persistence and owner permissions passed.');
