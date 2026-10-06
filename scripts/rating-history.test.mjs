import assert from 'node:assert/strict';
import {calculateRatings,ratingHistory} from '../lib/seeding.ts';
const match=(id,date,extra={})=>({id,a:'a',b:'b',games:[[11,4],[11,5]],status:'confirmed',played_on:date,...extra});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const regular=match('regular','2026-10-01'),single=match('single','2026-10-01',{tournament_id:'t',tournament_weight:2}),cross=match('cross','2026-10-01',{tournament_id:'t',tournament_weight:3});
for(const [m,delta] of [[regular,16],[single,32],[cross,48]]){
 const a=ratingHistory([m],'a','2026-10-06'),b=ratingHistory([m],'b','2026-10-06');
 close(a.changes[0].delta,delta);close(b.changes[0].delta,-delta);close(a.rating,1000+delta);close(a.changes[0].expected,.5);assert.equal(a.changes[0].won,true);assert.equal(b.changes[0].won,false);
}
const mixed=[match('expired','2023-10-01'),match('half','2025-01-01'),regular,match('upset','2026-10-02',{a:'b',b:'a'}),match('pending','2026-10-03',{status:'pending'}),match('voided','2026-10-03',{status:'voided'}),match('future','2027-10-03')];
const snapshot=JSON.stringify(mixed),ratings=calculateRatings(mixed,'2026-10-06');
for(const id of ['a','b']){const h=ratingHistory(mixed,id,'2026-10-06');close(h.rating,ratings.get(id).rating);close(h.rating,1000+h.changes.reduce((sum,c)=>sum+c.currentContribution,0));assert.equal(h.played,3);assert.equal(h.changes.length,4);assert.equal(h.changes.at(-1).ageWeight,0);assert.equal(h.changes.find(c=>c.matchId==='half').ageWeight,.5);assert.equal(h.changes[0].matchId,'upset');}
const upset=ratingHistory(mixed,'b','2026-10-06').changes[0];assert.ok(upset.expected<.5);assert.ok(upset.delta>16);
assert.equal(JSON.stringify(mixed),snapshot);assert.deepEqual(ratingHistory([...mixed].reverse(),'a','2026-10-06'),ratingHistory(mixed,'a','2026-10-06'));assert.equal(ratingHistory(mixed,'unknown','2026-10-06').rating,1000);
console.log('Passed rating replay consistency, upset strength, event weights, aging, symmetry, ordering, exclusions and input isolation.');
