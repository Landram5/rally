import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/club-setup.mjs',ts.transpileModule(readFileSync('lib/club-setup.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {setupSteps,setupProgress}=await import('../.test-runtime/club-setup.mjs');
const state=(club,members)=>Object.fromEntries(setupSteps(club,members).map(s=>[s.id,s.done]));
// A brand new club: only nothing is done, and every step has words to show.
assert.deepEqual(state({},1),{logo:false,about:false,where:false,join:false,address:false,members:false});
assert.ok(setupSteps({},1).every(s=>s.title&&s.detail));
let p=setupProgress(setupSteps({},1));assert.deepEqual(p,{done:0,total:6,complete:false});
// Each step reacts to its own field only.
assert.equal(state({photo_url:'/x.jpg'},1).logo,true);assert.equal(state({bio:'We play Tuesdays.'},1).about,true);
assert.equal(state({venue:'Gym'},1).where,false,'a venue without times is not enough');assert.equal(state({venue:'Gym',meeting_schedule:'Tue 6pm'},1).where,true);
assert.equal(state({contact:'a@b.c'},1).join,true,'contact details count');assert.equal(state({joining_info:'Bring a paddle'},1).join,true);
assert.equal(state({slug:'umbc'},1).address,true);
// Blank or whitespace-only text does not count.
assert.deepEqual(state({bio:'   ',venue:'\n',meeting_schedule:' ',contact:'',joining_info:' \t',slug:'',photo_url:null},1),{logo:false,about:false,where:false,join:false,address:false,members:false});
// Members: the owner alone is not a team.
assert.equal(state({},1).members,false);assert.equal(state({},2).members,true);assert.equal(state({},0).members,false);
// Complete when everything is done.
const full={photo_url:'/x',bio:'b',venue:'v',meeting_schedule:'m',contact:'c',joining_info:'j',slug:'s'};
p=setupProgress(setupSteps(full,5));assert.deepEqual(p,{done:6,total:6,complete:true});
p=setupProgress(setupSteps({...full,photo_url:null},5));assert.deepEqual(p,{done:5,total:6,complete:false});
console.log('club setup tests passed');
