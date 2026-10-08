import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/live-draft-sync.mjs',ts.transpileModule(readFileSync('app/live-draft-sync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const {queueMatch,readOutbox,removeQueued,isNewer}=await import('../.test-runtime/live-draft-sync.mjs');
const match=(id,extra={})=>({action:'record_match',id,clubId:'club',a:'a',b:'b',games:[[11,5],[11,7]],bestOf:3,date:'2026-10-08',...extra});
assert.deepEqual(readOutbox('me'),[],'empty by default');
queueMatch('me',match('m1'));queueMatch('me',match('m2'));assert.deepEqual(readOutbox('me').map(i=>i.payload.id),['m1','m2'],'queued in order');
queueMatch('me',match('m1',{games:[[11,9],[11,8]]}));assert.deepEqual(readOutbox('me').map(i=>i.payload.id),['m2','m1'],'a retry of the same match id replaces it instead of duplicating');
assert.deepEqual(readOutbox('someone-else'),[],'queues are per account');
removeQueued('me','m2');assert.deepEqual(readOutbox('me').map(i=>i.payload.id),['m1']);removeQueued('me','missing');assert.equal(readOutbox('me').length,1);
for(let i=0;i<14;i++)queueMatch('me',match('x'+i));assert.equal(readOutbox('me').length,10,'the queue is capped');assert.equal(readOutbox('me').at(-1).payload.id,'x13','newest entries are kept');
// Corrupt or hostile storage never throws and never yields non-match actions.
store.set('rally-match-outbox-v1:me','{not json');assert.deepEqual(readOutbox('me'),[]);
store.set('rally-match-outbox-v1:me',JSON.stringify([{payload:{action:'delete_account',id:'z'}},{payload:{action:'record_match',id:'ok'}},{payload:{action:'record_match'}},null,'x']));assert.deepEqual(readOutbox('me').map(i=>i.payload.id),['ok'],'only valid record_match entries are replayed');
assert.equal(isNewer({updatedAt:'2026-10-08T18:01:00.000Z'},{updatedAt:'2026-10-08T18:00:00.000Z'}),true);assert.equal(isNewer({updatedAt:'2026-10-08T18:00:00.000Z'},{updatedAt:'2026-10-08T18:00:00.000Z'}),false);
console.log('Match outbox passed: ordering, de-duplication by id, per-account queues, cap and hostile storage.');
