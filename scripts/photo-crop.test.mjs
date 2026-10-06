import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});writeFileSync('.test-runtime/photo-crop.mjs',ts.transpileModule(readFileSync('lib/photo-crop.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {photoCrop}=await import('../.test-runtime/photo-crop.mjs');
assert.deepEqual(photoCrop(1200,800),{x:200,y:0,side:800});
assert.deepEqual(photoCrop(800,1200),{x:0,y:200,side:800});
assert.deepEqual(photoCrop(800,800,2,100,0),{x:400,y:0,side:400});
for(const [w,h] of [[800,1200],[1200,800],[1,1],[200,10000]])for(const z of [1,1.5,3,0,10])for(const p of [-100,0,50,100,200]){const c=photoCrop(w,h,z,p,p);assert.ok(c.x>=0&&c.y>=0&&c.x+c.side<=w+1e-9&&c.y+c.side<=h+1e-9,'crop stays inside the image');}
assert.throws(()=>photoCrop(0,800),/dimensions/);
console.log('Photo crop geometry, portrait/landscape, zoom/pan boundaries and invalid dimensions passed.');
