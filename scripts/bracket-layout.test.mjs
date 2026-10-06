import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['bracket-layout','tournament-engine','match-rules'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {doubleBracketLayout}=await import('../.test-runtime/bracket-layout.mjs');
const {createDraw,recordFixture,outcome}=await import('../.test-runtime/tournament-engine.mjs');
function check(draw){
 const layout=doubleBracketLayout(draw),positions=new Map(layout.nodes.map(n=>[n.id,n]));
 assert.equal(layout.nodes.length,draw.fixtures.length);
 assert.equal(positions.size,draw.fixtures.length);
 for(const n of layout.nodes){assert.ok(n.x>=0&&n.y>=0,`${n.id} outside top/left`);assert.ok(n.x+260<=layout.width&&n.y+198<=layout.height,`${n.id} outside canvas`);for(const other of layout.nodes.filter(p=>p.id!==n.id))assert.ok(n.x+260<=other.x||other.x+260<=n.x||n.y+198<=other.y||other.y+198<=n.y,`${n.id} overlaps ${other.id}`);}
 for(const f of draw.fixtures){const n=positions.get(f.id);if(f.bracket==='losers')assert.ok(n.y>=layout.loserTop);for(const src of [f.sourceA,f.sourceB].filter(Boolean)){assert.ok(positions.has(src.fixtureId));if(src.result==='winner')assert.ok(positions.get(src.fixtureId).x+260<n.x,'Advancement should flow to the right');}}
 return layout;
}
for(const count of [2,3,4,5,8,13,16,31,32,64]){
 const draw=createDraw(Array.from({length:count},(_,i)=>`p${i}`),'Double elimination',3);
 const initial=check(draw);let current=draw,steps=0;
 // Always award the grand final to its second player to exercise the reset.
 while(outcome(current).status!=='completed'){
  const f=current.fixtures.find(f=>f.status==='ready');assert.ok(f);assert.ok(++steps<2*count+2);
  current=recordFixture(current,f.id,f.id==='gf1'?[[0,11],[0,11]]:[[11,0],[11,0]]);
  assert.deepEqual(check(current),initial,'Recording scores must not shift bracket geometry');
 }
 assert.equal(current.fixtures.find(f=>f.id==='gf2').status,'played');
 assert.equal(outcome(current).winners.length,1);
}
console.log('Double-elimination tree layout: byes, 2–64 players, non-overlap, advancement paths, and reset finals passed.');

