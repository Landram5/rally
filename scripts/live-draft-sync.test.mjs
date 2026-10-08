import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['live-draft-store','live-draft','live-score','rally-errors'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {readRemoteDraft,saveRemoteDraft,deleteRemoteDraft}=await import('../.test-runtime/live-draft-store.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:sql.prepare(q).run(...args)}}}}
const db={prepare:q=>stmt(q)};
for(const id of ['p1','p2','p3'])sql.prepare('INSERT INTO profiles(id,name,created_at) VALUES(?,?,?)').run(id,id,'2026-10-08');
const base=(over={})=>({version:1,owner:'p1',id:'m1',clubId:'club',a:'p1',b:'p2',bestOf:3,date:'2026-10-08',updatedAt:'2026-10-08T18:00:00.000Z',swapped:false,state:{points:[3,2],games:[],complete:false,history:[{points:[0,0],games:[],complete:false}]},...over});
// Round trip, one draft per account.
assert.deepEqual(await saveRemoteDraft(db,'p1',base()),{stored:true});
assert.equal((await readRemoteDraft(db,'p1')).state.points.join(),'3,2');
assert.equal(await readRemoteDraft(db,'p2'),null,'another account has no draft');
// The newest update wins; a stale device cannot overwrite it.
assert.equal((await saveRemoteDraft(db,'p1',base({updatedAt:'2026-10-08T18:05:00.000Z',state:{points:[5,2],games:[],complete:false,history:[]}}))).stored,true);
assert.equal((await saveRemoteDraft(db,'p1',base({updatedAt:'2026-10-08T18:01:00.000Z'}))).stored,false,'older update is ignored');
assert.equal((await readRemoteDraft(db,'p1')).state.points.join(),'5,2');
// A different match replaces the draft only when it is newer.
assert.equal((await saveRemoteDraft(db,'p1',base({id:'m2',updatedAt:'2026-10-08T19:00:00.000Z'}))).stored,true);assert.equal((await readRemoteDraft(db,'p1')).id,'m2');
// Validation and ownership.
await assert.rejects(saveRemoteDraft(db,'p1',base({owner:'p2'})),e=>e.status===400,'a draft for someone else is refused');
await assert.rejects(saveRemoteDraft(db,'p1',base({state:{points:[40,2],games:[],complete:false,history:[]}})),e=>e.status===400,'impossible scores are refused');
await assert.rejects(saveRemoteDraft(db,'p1',base({a:'p1',b:'p1'})),e=>e.status===400,'a player cannot face themselves');
await assert.rejects(saveRemoteDraft(db,'p1',base({id:"x'; DROP TABLE live_drafts;--"})),e=>e.status===400);
await assert.rejects(saveRemoteDraft(db,'p1',null),e=>e.status===400);
await assert.rejects(saveRemoteDraft(db,'p1',{x:'y'.repeat(2_100_000)}),e=>e.status===413);
assert.equal((await readRemoteDraft(db,'p1')).id,'m2','rejected input changes nothing');
// Deleting only removes the draft it names.
await deleteRemoteDraft(db,'p1','m1');assert.equal((await readRemoteDraft(db,'p1')).id,'m2','a late delete cannot erase a newer match');
await assert.rejects(deleteRemoteDraft(db,'p1',{id:'m2'}),e=>e.status===400);
await deleteRemoteDraft(db,'p1','m2');assert.equal(await readRemoteDraft(db,'p1'),null);
// Removed with the account.
await saveRemoteDraft(db,'p3',base({owner:'p3',a:'p3',b:'p2'}));assert.equal(sql.prepare("SELECT count(*) n FROM live_drafts WHERE player_id='p3'").get().n,1);
sql.prepare("UPDATE profiles SET deleted_at='2026-10-09',auth_id=NULL,name='Deleted player' WHERE id='p3'").run();assert.equal(sql.prepare("SELECT count(*) n FROM live_drafts WHERE player_id='p3'").get().n,0,'draft removed on account deletion');
assert.deepEqual(await saveRemoteDraft(db,'p3',base({owner:'p3',a:'p3',b:'p2'})),{stored:false},'a deleted account cannot store drafts');
console.log('Live draft sync passed: round trip, newest-wins, validation, ownership, safe delete and account deletion.');
