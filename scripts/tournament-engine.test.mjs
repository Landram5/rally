// Run rally-service.test.mjs first to compile the same production engine.
import assert from 'node:assert/strict';
import {createDraw,recordFixture,resetFixture,withdrawPlayer,outcome,standings} from '../.test-runtime/tournament-engine.mjs';
for(let n=2;n<=65;n++){
 const seeds=Array.from({length:n},(_,i)=>`p${i+1}`);let draw=createDraw(seeds,'Single elimination',3),played=0;
 assert.equal(draw.fixtures.filter(f=>f.status==='bye').length,2**Math.ceil(Math.log2(n))-n);
 while(draw.fixtures.some(f=>f.status==='ready')){const f=draw.fixtures.find(f=>f.status==='ready');draw=recordFixture(draw,f.id,[[11,7],[11,8]]);played++;assert.ok(played<=n-1)}
 assert.equal(played,n-1,`size ${n}`);assert.equal(outcome(draw).status,'completed');assert.equal(outcome(draw).winners.length,1);
 assert.equal(outcome(draw).winners[0],'p1');
}
for(let n=2;n<=33;n++){
 const seeds=Array.from({length:n},(_,i)=>`d${i+1}`);let draw=createDraw(seeds,'Double elimination',3),played=0;
 while(draw.fixtures.some(f=>f.status==='ready')){const f=draw.fixtures.find(f=>f.status==='ready');draw=recordFixture(draw,f.id,[[11,7],[11,8]]);played++;assert.ok(played<=2*n-1,`double elimination stalled for size ${n}`)}
 assert.equal(played,2*n-2,`undefeated champion match count for size ${n}`);
 assert.equal(outcome(draw).status,'completed');assert.deepEqual(outcome(draw).winners,['d1']);
}
let resetFinal=createDraw(['a','b','c','d'],'Double elimination',3);
while(resetFinal.fixtures.some(f=>f.status==='ready'&&f.id!=='gf1')){const f=resetFinal.fixtures.find(f=>f.status==='ready'&&f.id!=='gf1');resetFinal=recordFixture(resetFinal,f.id,[[11,7],[11,8]])}
const firstFinal=resetFinal.fixtures.find(f=>f.id==='gf1');resetFinal=recordFixture(resetFinal,'gf1',[[7,11],[8,11]]);
assert.equal(resetFinal.fixtures.find(f=>f.id==='gf2').status,'ready','losers-bracket winner should force a reset final');
resetFinal=recordFixture(resetFinal,'gf2',[[7,11],[8,11]]);assert.deepEqual(outcome(resetFinal).winners,[firstFinal.b]);
resetFinal=resetFixture(resetFinal,'w1m1');assert.equal(outcome(resetFinal).status,'active');assert.equal(resetFinal.fixtures.find(f=>f.id==='gf1').status,'waiting');
let bronze=createDraw(['a','b','c','d','e','f','g','h'],'Single elimination',3,true);
assert.equal(bronze.fixtures.length,8);assert.equal(bronze.thirdPlace,true);
while(bronze.fixtures.some(f=>f.status==='ready')){const f=bronze.fixtures.find(f=>f.status==='ready');bronze=recordFixture(bronze,f.id,[[11,7],[11,8]])}
assert.equal(outcome(bronze).status,'completed');assert.equal(outcome(bronze).winners[0],'a');assert.ok(outcome(bronze).thirdPlaceWinner);
bronze=resetFixture(bronze,'r2m1');assert.equal(bronze.fixtures.find(f=>f.id==='third').status,'waiting');assert.equal(outcome(bronze).status,'active');
assert.throws(()=>createDraw(['a','b','c'],'Single elimination',3,true),/at least four/);
assert.throws(()=>createDraw(['a','b','c','d'],'Round robin',3,true),/single-elimination/);
let rr=createDraw(['a','b','c'],'Round robin',3);
for(const f of rr.fixtures){const winner=f.a==='a'&&f.b==='c'?'c':f.a;rr=recordFixture(rr,f.id,winner===f.a?[[11,9],[11,9]]:[[9,11],[9,11]])}
assert.deepEqual(standings(rr).map(r=>r.rank),[1,1,1]);assert.equal(outcome(rr).winners.length,3);
let ko=createDraw(['a','b','c','d'],'Single elimination',3);
ko=withdrawPlayer(ko,'a');assert.equal(ko.fixtures[0].winner,'d');assert.equal(ko.fixtures[0].games.length,0);
ko=withdrawPlayer(ko,'d');assert.equal(ko.fixtures[0].status,'empty');
ko=recordFixture(ko,ko.fixtures.find(f=>f.status==='ready').id,[[11,9],[11,9]]);
assert.equal(outcome(ko).status,'completed');assert.equal(outcome(ko).winners[0],'b');
let rr2=createDraw(['a','b','c'],'Round robin',3);rr2=recordFixture(rr2,rr2.fixtures[0].id,[[11,6],[11,7]]);rr2=withdrawPlayer(rr2,'a');assert.equal(rr2.fixtures[0].status,'played');assert.equal(standings(rr2).find(r=>r.id==='a').rank,null);
let two=createDraw(['a','b'],'Single elimination',5);two=recordFixture(two,two.fixtures[0].id,undefined,'b');assert.equal(outcome(two).winners[0],'b');two=resetFixture(two,two.fixtures[0].id);assert.equal(two.fixtures[0].status,'ready');
assert.throws(()=>createDraw(['a','a'],'Single elimination',3));
assert.throws(()=>recordFixture(two,'r1m1',[[11,5],[11,5]]));
console.log('Passed: single and double elimination fields; high-seed byes; reset final; dependent reset; round-robin shared ties; withdrawals; forfeit reset; score validation.');

for(const n of [99,128,257]){const d=createDraw(Array.from({length:n},(_,i)=>`p${i}`),'Single elimination',3);assert.equal(d.fixtures.length,2**Math.ceil(Math.log2(n))-1);assert.equal(d.fixtures.filter(f=>f.status==='bye').length,2**Math.ceil(Math.log2(n))-n);}
const {suggestSeeds}=await import('../.test-runtime/seeding.mjs');
const history=[{id:'one',a:'a',b:'b',games:[[11,5],[11,5]],status:'confirmed',played_on:'2026-09-20'},{id:'two',a:'b',b:'a',games:[[11,5],[11,5]],status:'pending',played_on:'2026-09-21'}];
assert.deepEqual(suggestSeeds(['guest','b','a'],history).map(s=>s.id),['a','b','guest']);
assert.deepEqual(suggestSeeds(['guest','b','a'],history.map(m=>({...m,status:'voided'}))).map(s=>s.id),['guest','b','a']);
assert.equal(suggestSeeds(['a','b'],history)[0].rating,1016);
console.log('Passed: uneven fields 99 and 257, field 128, byes, Elo seed order, unranked order, pending/voided exclusion.');
