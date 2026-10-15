import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['system-health','admin-email','club-review-alert'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const h=await import('../.test-runtime/system-health.mjs'),m=await import('../.test-runtime/admin-email.mjs');
const sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt};
const t0=new Date('2026-10-15T12:00:00.000Z'),min=n=>new Date(t0.getTime()+n*60000);
// Health: nothing recorded yet is fine (a fresh deploy); a recent heartbeat is fine; an old one is not.
let r=await h.healthReport(db,t0);assert.equal(r.ok,true);assert.equal(r.database,true);assert.equal(r.scheduled,null);
await h.recordRun(db,[],t0);r=await h.healthReport(db,min(4));assert.deepEqual({ok:r.ok,age:r.scheduled.ageSeconds,stale:r.scheduled.stale,failed:r.scheduled.failedJobs},{ok:true,age:240,stale:false,failed:[]});
r=await h.healthReport(db,min(20));assert.equal(r.ok,true,'exactly at the limit is still fine');r=await h.healthReport(db,min(21));assert.equal(r.ok,false,'a stalled job makes it unhealthy');assert.equal(r.scheduled.stale,true);assert.equal(r.database,true);
// Failed jobs are reported by name but do not by themselves make the site unhealthy.
await h.recordRun(db,['notifications','Discord gateway'],min(30));r=await h.healthReport(db,min(31));assert.equal(r.ok,true);assert.deepEqual(r.scheduled.failedJobs,['notifications','Discord gateway']);
await h.recordRun(db,[],min(35));assert.deepEqual((await h.healthReport(db,min(36))).scheduled.failedJobs,[],'and clear when they recover');assert.equal(one("SELECT count(*) n FROM system_status").n,1,'one row, updated in place');
// A broken database is unhealthy and never throws.
assert.equal((await h.healthReport({prepare(){throw new Error('down')}},t0)).ok,false);assert.equal((await h.healthReport({prepare(){throw new Error('down')}},t0)).database,false);
assert.equal((await h.healthReport({prepare:()=>({bind(){return this},async first(){throw new Error('down')}})},t0)).ok,false);
// Alerts: once per six hours, only when something failed and an email actually went out.
const sent=[],http=async(u,i)=>{sent.push(JSON.parse(i.body));return new Response('{}',{status:200})};
const env={DB:db,RALLY_ADMIN_EMAILS:'admin@example.com, second@example.com',RESEND_API_KEY:'k',NOTIFICATION_FROM:'Rally <r@rallytt.net>'};
await h.recordRun(db,['notifications'],min(60));
assert.equal(await h.alertIfNeeded(env,[],min(60),http),false,'nothing failed, nothing sent');assert.equal(sent.length,0);
assert.equal(await h.alertIfNeeded(env,['notifications'],min(60),http),true);assert.equal(sent.length,2,'every administrator is told');assert.match(sent[0].subject,/a maintenance job failed/);assert.match(sent[0].text,/notifications/);assert.match(sent[0].text,/api\/health/);
await h.recordRun(db,['notifications'],min(65));assert.equal(await h.alertIfNeeded(env,['notifications'],min(65),http),false,'the same trouble five minutes later is not another email');assert.equal(sent.length,2);
assert.equal(await h.alertIfNeeded(env,['notifications'],min(60+6*60-1),http),false,'still quiet just under six hours');
assert.equal(await h.alertIfNeeded(env,['a','b'],min(60+6*60+1),http),true,'and again after six hours');assert.match(sent.at(-1).subject,/2 maintenance jobs failed/);
// Overlapping runs send one email.
await h.recordRun(db,['x'],min(1000));const both=await Promise.all([h.alertIfNeeded(env,['x'],min(1000),http),h.alertIfNeeded(env,['x'],min(1000),http)]);assert.deepEqual(both.sort(),[false,true]);
// With no email provider nothing is lost: the quiet period is given back so a later run can try.
await h.recordRun(db,['x'],min(2000));assert.equal(await h.alertIfNeeded({DB:db},['x'],min(2000),http),false);assert.equal(one("SELECT last_alert_at a FROM system_status").a,null);assert.equal(await h.alertIfNeeded(env,['x'],min(2001),http),true,'it goes out once email is set up');
// The shared admin email helper.
assert.equal(await m.emailAdmins({...env,RALLY_ADMIN_EMAILS:'bad, ,x@y.z'},{subject:'s',text:'t',key:'k'},http),1,'invalid addresses are skipped');
assert.equal(await m.emailAdmins(env,{subject:'s',text:'t',key:'k'},async()=>{throw new Error('offline')}),0,'a failing provider never throws');
console.log('system health tests passed');
