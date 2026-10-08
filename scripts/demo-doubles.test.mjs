import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['demo-state','demo-doubles','doubles-view','doubles-rating','doubles','seeding','logistics','notification-preferences','club-seasons','notifications','match-rules','tournament-engine','rally']){writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));}
const {createDemoData,applyDemoAction}=await import('../.test-runtime/demo-state.mjs');
const {demoDoublesFeed,demoDoublesStandings,demoDoublesProfile}=await import('../.test-runtime/demo-doubles.mjs');
let d=createDemoData();
assert.ok(d.doublesMatches.length>=6&&d.tournaments.some(t=>t.team_size===2),'the sample includes doubles');
assert.ok(d.matches.every(m=>!String(m.a).startsWith('demo-team')),'doubles never enter the singles matches');
const board=demoDoublesStandings(d,'metro');assert.ok(board.players.length>=4&&board.players[0].rating>=board.players.at(-1).rating);assert.ok(board.pairs.length>0);
assert.deepEqual(demoDoublesStandings(d,'harbor').players.map(p=>p.playerId),['alex'],'a club lists only its own members');
const mine=demoDoublesProfile(d,'alex');assert.ok(mine.played>=4&&mine.history.length>=4&&mine.partners.length>0);
assert.ok(demoDoublesFeed(d,'all').some(m=>m.status==='pending'&&m.canConfirm),'a pending result can be confirmed');
const singles=d.matches.length;
d=applyDemoAction(d,{action:'confirm_doubles_match',id:'demo-doubles-7'});assert.equal(d.doublesMatches.find(m=>m.id==='demo-doubles-7').status,'confirmed');assert.equal(d.matches.length,singles);
d=applyDemoAction(d,{action:'record_doubles_match',id:'new',clubId:'metro',a1:'alex',a2:'jamie',b1:'casey',b2:'taylor',games:[[11,5],[11,6]],bestOf:3,date:'2026-10-08'});assert.ok(d.doublesMatches.some(m=>m.id==='new'));
assert.throws(()=>applyDemoAction(d,{action:'record_doubles_match',clubId:'metro',a1:'alex',a2:'alex',b1:'casey',b2:'taylor',games:[[11,5]],date:'2026-10-08'}),/four different/);
assert.throws(()=>applyDemoAction(d,{action:'record_doubles_match',clubId:'metro',a1:'alex',a2:'riley',b1:'casey',b2:'taylor',games:[[11,5]],date:'2026-10-08'}),/club members/);
// A doubles event: register, wait, promote when a team leaves, start, play to the end.
const ev=()=>d.tournaments.find(x=>x.id==='metro-doubles'),go=(action,p)=>{d=applyDemoAction(d,{id:'metro-doubles',revision:ev().revision,action,...p})};
go('enter_team',{playerId:'alex',partnerId:'morgan'});assert.equal(d.teams.length,2);
assert.throws(()=>go('enter_team',{playerId:'alex',partnerId:'jamie'}),/one team/);
ev().allow_visitors=1;assert.throws(()=>go('join_team_waitlist',{playerId:'jamie',partnerId:'sam'}),/place is available/);
go('set_capacity',{capacity:2});
assert.throws(()=>go('enter_team',{playerId:'jamie',partnerId:'sam'}),/full/);
go('join_team_waitlist',{playerId:'jamie',partnerId:'sam'});assert.equal(ev().team_waitlist.length,1);
go('remove_team',{teamId:'demo-team-1'});assert.equal(d.teams.length,2);assert.equal(ev().team_waitlist.length,0,'the waiting team took the place');
ev().check_in_open=1;const ids=d.entries.filter(e=>e.tournament_id==='metro-doubles').map(e=>e.player_id);go('set_team_check_in',{teamId:ids[0],checkedIn:true});assert.deepEqual(ev().checkedIn,[ids[0]]);
go('start_tournament',{seeds:ids,bestOf:3,thirdPlace:false});assert.equal(ev().state.seeds.length,2);
const fixture=ev().state.fixtures.find(f=>f.status==='ready');go('score_fixture',{fixtureId:fixture.id,games:[[11,5],[11,7]]});
assert.ok(d.doublesMatches.some(m=>m.tournament_id==='metro-doubles'&&m.status==='confirmed'),'the result is a doubles match');
assert.equal(d.matches.filter(m=>m.tournament_id==='metro-doubles').length,0,'and never a singles match');
go('reset_fixture',{fixtureId:fixture.id});assert.ok(!d.doublesMatches.some(m=>m.tournament_id==='metro-doubles'),'resetting removes the doubles result');
// Deleting the event removes its teams.
d=applyDemoAction(d,{action:'delete_tournament',id:'metro-doubles',confirmation:'DELETE'});assert.equal(d.teams.length,0);
console.log('Sample doubles: results, standings, profile, team registration, waitlist, check-in and tournament play passed.');