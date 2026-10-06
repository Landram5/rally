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
assert.equal(seed.tournaments.filter(t=>t.status==='completed').length,3);
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
data=applyDemoAction(seed,{action:'create_club',id:'new-club',name:'New sample',location:'Baltimore'});assert.throws(()=>applyDemoAction(data,{action:'create_club',id:'second',name:'Second',location:'Baltimore'}),/already own/);
console.log('Demo tournament history, progression, reset, validation and isolation checks passed.');
