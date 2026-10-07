import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['notification-preferences','club-seasons','feedback-progress','rally-errors','logistics','notifications','demo-state','rally','match-rules','tournament-engine','seeding']){
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
event=data.tournaments.find(t=>t.id==='test-event');data=applyDemoAction(data,{action:'reset_fixture',note:'Correcting a recorded score',id:event.id,revision:event.revision,fixtureId:fixture.id});assert.equal(data.matches.filter(m=>m.tournament_id===event.id).length,0);
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

assert.ok(seed.notifications.length>0);
const firstNotice=seed.notifications[0];
const readDemo=applyDemoAction(seed,{action:'mark_notification_read',id:firstNotice.id});
assert.equal(readDemo.notifications.find(n=>n.id===firstNotice.id).read,true);
assert.equal(seed.notifications.find(n=>n.id===firstNotice.id).read,false);
assert.ok(applyDemoAction(seed,{action:'mark_notifications_read'}).notifications.every(n=>n.read));
console.log('Demo inbox read state, mark-all and isolation passed.');

let logistics=applyDemoAction(seed,{action:'set_event_logistics',id:'autumn',registrationClosesAt:'2099-10-10T16:00:00Z',startsAt:'2099-10-10T18:00:00Z',checkInOpen:true});
logistics=applyDemoAction(logistics,{action:'set_check_in',id:'autumn',playerId:'alex',checkedIn:true});assert.ok(logistics.tournaments.find(t=>t.id==='autumn').checkedIn.includes('alex'));assert.equal(seed.tournaments.find(t=>t.id==='autumn').checkedIn.includes('alex'),false);
const liveFixture=logistics.tournaments.find(t=>t.id==='live').state.fixtures.find(f=>f.status==='ready');logistics=applyDemoAction(logistics,{action:'set_fixture_plan',id:'live',fixtureId:liveFixture.id,court:'Table 2',startsAt:'2099-10-10T18:30:00Z'});assert.equal(logistics.tournaments.find(t=>t.id==='live').fixturePlans[0].court,'Table 2');
logistics=applyDemoAction(logistics,{action:'set_event_logistics',id:'autumn',registrationClosesAt:'2000-01-01T00:00:00Z',checkInOpen:false});assert.throws(()=>applyDemoAction(logistics,{action:'enter_tournament',id:'autumn',playerId:'riley'}),/closed/);assert.throws(()=>applyDemoAction(logistics,{action:'set_check_in',id:'autumn',playerId:'alex',checkedIn:true}),/closed/);
console.log('Demo event details, deadlines, check-in, fixture plans and isolation passed.');

{
 let data=createDemoData(),t=data.tournaments.find(t=>t.id==='visitors');
 data=applyDemoAction(data,{action:'join_waitlist',id:t.id,playerId:'alex',revision:t.revision});assert.equal(data.tournaments.find(t=>t.id==='visitors').waitlist.find(w=>w.player_id==='alex').position,3);
 t=data.tournaments.find(t=>t.id==='visitors');data=applyDemoAction(data,{action:'remove_entry',id:t.id,playerId:'jordan',revision:t.revision});assert.ok(data.entries.some(e=>e.tournament_id==='visitors'&&e.player_id==='casey'));
 data=applyDemoAction(data,{action:'review_guest_claim',id:'sample-claim',status:'approved',confirmation:'MERGE'});assert.equal(data.ownership.claims[0].status,'approved');assert.equal(data.players.some(p=>p.id==='visiting-guest'),false);
 const m=data.matches.find(m=>m.id==='pending-sample');data=applyDemoAction(data,{action:'correct_match',matchId:m.id,revision:0,note:'Checked with both players.',games:[[8,11],[9,11]]});assert.equal(data.matchHistory[0].action,'corrected');
 data=applyDemoAction(data,{action:'resolve_match_review',id:'sample-review',matchId:m.id,status:'resolved',note:'Scores corrected.'});assert.equal(data.ownership.reviews[0].status,'resolved');assert.equal(createDemoData().ownership.reviews[0].status,'pending','sample changes remain isolated');
}
console.log('Demo visiting-player queue, promotions, guest claims and audited match corrections passed.');

const {notificationsFor}=await import('../.test-runtime/notifications.mjs');
const source={...createDemoData(),matches:[{id:'needs-verification',a:'alex',b:'jordan',canConfirm:true}],announcements:[{id:'club-note',club_id:'harbor',title:'Practice',body:'Tonight',created_at:'2026-10-06T12:00:00Z',clubName:'Harbor'}]};
const notices=notificationsFor(source,[],true,'2026-10-06');
assert.equal(notices.find(n=>n.id==='match-needs-verification').actionNeeded,true);
assert.equal(notices.find(n=>n.id==='announcement-club-note').href,'/clubs/harbor?section=announcements');
assert.equal(notices.find(n=>n.id==='announcement-club-note').date,'2026-10-06T12:00:00Z');
const readNotices=notificationsFor(source,['match-needs-verification'],true,'2026-10-06');
assert.equal(readNotices.find(n=>n.id==='match-needs-verification').read,true);
assert.equal(readNotices.find(n=>n.id==='match-needs-verification').actionNeeded,true);
assert.ok(!notificationsFor({...source,matches:[]},[],true,'2026-10-06').some(n=>n.id==='match-needs-verification'));
assert.ok(notices.filter(n=>n.id.startsWith('entry-')||n.id.startsWith('completed-')).every(n=>!n.actionNeeded));
assert.ok(notices.filter(n=>n.id.startsWith('checkin-')||n.id.startsWith('fixture-')).every(n=>n.actionNeeded));
console.log('Inbox tasks retain action status after reading, disappear after resolution, and distinguish informational updates.');
