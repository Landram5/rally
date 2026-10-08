import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['tournament-engine','match-rules'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
import {createDraw,recordFixture,resetFixture,withdrawPlayer,outcome,standings,groupStandings,affectedFixtures,defaultSwissRounds,defaultGroupCount} from '../.test-runtime/tournament-engine.mjs';
// Swiss: pairings avoid rematches, byes rotate, rounds appear as results arrive, and the event completes after the planned rounds.
{
 const playOut=(draw,rank)=>{let d=draw;for(let guard=0;guard<500;guard++){const f=d.fixtures.find(f=>f.status==='ready');if(!f)break;d=recordFixture(d,f.id,rank.indexOf(f.a)<rank.indexOf(f.b)?[[11,5],[11,7]]:[[5,11],[7,11]]);}return d;};
 for(const n of [4,5,6,7,8,9,12,15,16,33]){
  const ids=Array.from({length:n},(_,i)=>`p${i+1}`),first=createDraw(ids,'Swiss',3);
  assert.equal(first.swissRounds,defaultSwissRounds(n));assert.equal(Math.max(...first.fixtures.map(f=>f.round)),1,'only the first round exists at the start');assert.equal(outcome(first).status,'active');
  const done=playOut(first,ids),pairs=done.fixtures.filter(f=>f.a&&f.b).map(f=>[f.a,f.b].sort().join('|'));
  assert.equal(Math.max(...done.fixtures.map(f=>f.round)),done.swissRounds,`n=${n}: all rounds are generated`);assert.equal(pairs.length,new Set(pairs).size,`n=${n}: no rematches`);assert.equal(outcome(done).status,'completed');assert.equal(outcome(done).winners.length,1);assert.equal(outcome(done).winners[0],'p1','the unbeaten player wins');
  const byes=done.fixtures.filter(f=>!f.b).map(f=>f.a);assert.equal(new Set(byes).size,byes.length,`n=${n}: nobody sits out twice`);assert.equal(byes.length,n%2?done.swissRounds:0);
  const rows=standings(done);assert.equal(rows.reduce((s,r)=>s+r.played,0),done.fixtures.reduce((s,f)=>s+(f.b?2:1),0),'every game and bye is counted once per player');
 }
 const ids=Array.from({length:8},(_,i)=>`p${i+1}`);let d=createDraw(ids,'Swiss',3);
 assert.deepEqual(d.fixtures.map(f=>[f.a,f.b]),[['p1','p5'],['p2','p6'],['p3','p7'],['p4','p8']],'round one pairs the top half with the bottom half');
 for(const f of d.fixtures.slice(0,3))d=recordFixture(d,f.id,[[11,5],[11,7]]);assert.equal(Math.max(...d.fixtures.map(f=>f.round)),1,'the next round waits for every match');
 d=recordFixture(d,d.fixtures[3].id,[[11,5],[11,7]]);assert.equal(Math.max(...d.fixtures.map(f=>f.round)),2,'the next round appears when the last match is recorded');
 const round2=d.fixtures.filter(f=>f.round===2);assert.ok(round2.every(f=>{const a=d.fixtures.find(x=>x.round===1&&(x.a===f.a||x.b===f.a)).winner,b=d.fixtures.find(x=>x.round===1&&(x.a===f.b||x.b===f.b)).winner;return (a===f.a)===(b===f.b);}),'round two pairs winners with winners and losers with losers');
 // Resetting an earlier round removes unplayed later rounds but refuses once later rounds have results.
 const first1=d.fixtures.find(f=>f.id==='s1m1');const back=resetFixture(d,first1.id);assert.equal(Math.max(...back.fixtures.map(f=>f.round)),1,'later unplayed rounds are dropped');assert.equal(back.fixtures.find(f=>f.id==='s1m1').status,'ready');
 assert.deepEqual(affectedFixtures(d,first1.id).sort(),d.fixtures.map(f=>f.id).sort(),'a reset reports every later fixture as affected');
 const r2=d.fixtures.find(f=>f.round===2&&f.status==='ready');d=recordFixture(d,r2.id,[[11,3],[11,4]]);assert.throws(()=>resetFixture(d,first1.id),/later Swiss rounds/,'results in later rounds block an earlier reset');
 // Withdrawal: the player drops out of later pairings and forfeits the current match.
 let w=createDraw(ids,'Swiss',3);w=withdrawPlayer(w,'p5');assert.equal(w.fixtures.find(f=>f.a==='p1'||f.b==='p1').winner,'p1','the opponent of a withdrawn player wins by forfeit');
 w=playOut(w,ids);assert.ok(!w.fixtures.filter(f=>f.round>1).some(f=>f.a==='p5'||f.b==='p5'),'withdrawn players are not paired again');assert.equal(outcome(w).status,'completed');
 // Invalid options.
 assert.throws(()=>createDraw(ids.slice(0,3),'Swiss',3),/at least four/);assert.throws(()=>createDraw(ids,'Swiss',3,false,{swissRounds:1}),/between 2 rounds/);assert.throws(()=>createDraw(ids,'Swiss',3,false,{swissRounds:8}),/between 2 rounds/);assert.equal(createDraw(ids,'Swiss',3,false,{swissRounds:5}).swissRounds,5);assert.throws(()=>createDraw(ids,'Swiss',3,true),/third-place/);
}
// Rating-balanced round-robin groups.
{
 for(const n of [6,7,8,10,12,13,16,20,32]){
  const ids=Array.from({length:n},(_,i)=>`p${i+1}`),draw=createDraw(ids,'Round robin groups',3),sizes=draw.groups.map(g=>g.length);
  assert.equal(draw.groups.length,defaultGroupCount(n));assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,`n=${n}: group sizes differ by at most one`);assert.deepEqual(draw.groups.flat().sort(),[...ids].sort(),'everyone is in exactly one group');
  const strength=draw.groups.map(g=>g.reduce((s,id)=>s+ (n-ids.indexOf(id)),0)/g.length);assert.ok(Math.max(...strength)-Math.min(...strength)<=n/2,`n=${n}: groups are balanced by seed strength`);
  assert.ok(draw.fixtures.every(f=>draw.groups[f.group].includes(f.a)&&draw.groups[f.group].includes(f.b)),'players only meet inside their group');assert.equal(draw.fixtures.length,draw.groups.reduce((s,g)=>s+g.length*(g.length-1)/2,0));
 }
 const ids=Array.from({length:10},(_,i)=>`p${i+1}`);let d=createDraw(ids,'Round robin groups',3);
 assert.deepEqual(d.groups,[['p1','p4','p5','p8','p9'],['p2','p3','p6','p7','p10']],'strongest seeds are dealt back and forth across groups');
 assert.deepEqual(createDraw(ids,'Round robin groups',3,false,{groupCount:3}).groups.map(g=>g.length),[3,3,4]);
 for(let guard=0;guard<100;guard++){const f=d.fixtures.find(f=>f.status==='ready');if(!f)break;d=recordFixture(d,f.id,ids.indexOf(f.a)<ids.indexOf(f.b)?[[11,5],[11,7]]:[[5,11],[7,11]]);}
 assert.equal(outcome(d).status,'completed');assert.deepEqual(outcome(d).groupWinners,['p1','p2']);assert.deepEqual(outcome(d).winners,[],'there is no single champion without a final stage');
 const tables=groupStandings(d);assert.equal(tables.length,2);assert.deepEqual(tables.map(t=>t.label),['A','B']);assert.deepEqual(tables[0].rows.map(r=>r.id),['p1','p4','p5','p8','p9']);assert.equal(standings(d).length,10,'the flat standings include every player once');
 assert.throws(()=>createDraw(ids.slice(0,5),'Round robin groups',3),/at least six/);assert.throws(()=>createDraw(ids,'Round robin groups',3,false,{groupCount:1}),/at least two groups/);assert.throws(()=>createDraw(ids,'Round robin groups',3,false,{groupCount:4}),/at least two groups/);
 const w=withdrawPlayer(createDraw(ids,'Round robin groups',3),'p4');assert.equal(groupStandings(w)[0].rows.find(r=>r.id==='p4').withdrawn,true);
}console.log('Passed: Swiss pairings, byes, automatic rounds, resets, withdrawals and completion; rating-balanced groups, standings and group winners.');
