import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['notification-delivery','notification-preferences','push-subscriptions','rally-errors']){
 let source=readFileSync(`lib/${name}.ts`,'utf8');
 if(name==='notification-delivery')source=source.replace("import {createAuthAdmin} from './auth-admin';","const createAuthAdmin=()=>{throw new Error('Unexpected live Auth request');};").replace("import {makeService} from './rally-service';","const makeService=()=>{throw new Error('Unexpected live inbox request');};");
 writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
}
const {deliverNotifications,deliverable}=await import('../.test-runtime/notification-delivery.mjs'),{defaultPreferences,savePreferences,readPreferences}=await import('../.test-runtime/notification-preferences.mjs'),{validateSubscription,saveSubscription}=await import('../.test-runtime/push-subscriptions.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:sql.prepare(q).run(...args)}}};}
const db={prepare:stmt,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
sql.prepare('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)').run('one','auth-one','One','2026-10-07');
const env={DB:db,RESEND_API_KEY:'test-placeholder',NOTIFICATION_FROM:'Rally <test@example.test>',SUPABASE_SECRET_KEY:'test-placeholder'};
const n={id:'match-one',title:'Verify a match',detail:'One vs Two',href:'/clubhouse?tab=matches&match=one',kind:'match',read:false,actionNeeded:true};
let inbox=[n],calls=[],mode=200;
const deps={inbox:async()=>inbox,email:async()=>'recipient@example.test',fetch:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');calls.push(init);return new Response(null,{status:mode});}};
assert.equal((await readPreferences(db,'one')).email_delivery,false);await deliverNotifications(env,deps);assert.equal(calls.length,0);
await savePreferences(db,'one',{...defaultPreferences,email_delivery:true});await deliverNotifications(env,deps);assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].body).to[0],'recipient@example.test');assert.equal(sql.prepare('SELECT status FROM notification_deliveries').get().status,'sent');
await deliverNotifications(env,deps);assert.equal(calls.length,1,'sent event must not send again');
const old={...defaultPreferences};delete old.email_delivery;delete old.push_delivery;await savePreferences(db,'one',old);assert.equal((await readPreferences(db,'one')).email_delivery,true,'old clients preserve new opt-ins');
inbox=[{...n,id:'match-retry'}];mode=503;await deliverNotifications(env,deps);assert.equal(sql.prepare("SELECT attempts FROM notification_deliveries WHERE notification_id='match-retry'").get().attempts,1);
sql.exec("UPDATE notification_deliveries SET retry_at=0 WHERE status='pending'");mode=200;await deliverNotifications(env,deps);assert.equal(calls[1].headers['Idempotency-Key'],calls[2].headers['Idempotency-Key'],'retry reuses provider idempotency key');
inbox=[{...n,id:'match-cancel'}];mode=503;await deliverNotifications(env,deps);const before=calls.length;inbox=[];sql.exec("UPDATE notification_deliveries SET retry_at=0 WHERE status='pending'");await deliverNotifications(env,deps);assert.equal(calls.length,before);assert.equal(sql.prepare("SELECT status FROM notification_deliveries WHERE notification_id='match-cancel'").get().status,'skipped');
inbox=[{...n,id:'match-off'}];mode=503;await deliverNotifications(env,deps);await savePreferences(db,'one',{...defaultPreferences,email_delivery:false});sql.exec("UPDATE notification_deliveries SET retry_at=0 WHERE status='pending'");const off=calls.length;await deliverNotifications(env,deps);assert.equal(calls.length,off);
assert.equal(deliverable({...n,read:true}),false);assert.equal(deliverable({...n,id:'announcement-1',kind:'announcement'}),false);assert.equal(deliverable({...n,id:'remind-session-1',actionNeeded:false}),false);assert.equal(deliverable({...n,id:'fixture-forecast',kind:'tournament'}),false);assert.equal(deliverable({...n,callUp:true,id:'fixture-1',kind:'tournament'}),true);
await savePreferences(db,'one',{...defaultPreferences,email_delivery:true});inbox=[{...n,id:'match-race'}];mode=200;const race=calls.length;await Promise.all([deliverNotifications(env,deps),deliverNotifications(env,deps)]);assert.equal(calls.length,race+1,'scan lease prevents overlapping delivery');
const ec=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),publicKey=Buffer.from(await crypto.subtle.exportKey('raw',ec.publicKey)).toString('base64url');
const subscription={endpoint:'https://fcm.googleapis.com/wp/test',keys:{p256dh:publicKey,auth:Buffer.alloc(16,1).toString('base64url')}};
assert.equal(validateSubscription(subscription).endpoint,subscription.endpoint);
for(const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:444/x','https://user@fcm.googleapis.com/x'])assert.throws(()=>validateSubscription({...subscription,endpoint}),e=>e.status===400);
assert.throws(()=>validateSubscription({...subscription,keys:{...subscription.keys,auth:'bad'}}),e=>e.status===400);
await saveSubscription(db,'one','device',subscription);await saveSubscription(db,'one','device',{...subscription,endpoint:'https://fcm.googleapis.com/wp/new'});assert.equal(sql.prepare('SELECT count(*) n FROM push_subscriptions').get().n,1);
for(let i=1;i<5;i++)await saveSubscription(db,'one','device-'+i,{...subscription,endpoint:'https://fcm.googleapis.com/wp/'+i});await assert.rejects(saveSubscription(db,'one','sixth',{...subscription,endpoint:'https://fcm.googleapis.com/wp/sixth'}),e=>e.status===409);
const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),privateKey=await crypto.subtle.exportKey('jwk',vapid.privateKey);
const pushEnv={DB:db,VAPID_PUBLIC_KEY:Buffer.from(await crypto.subtle.exportKey('raw',vapid.publicKey)).toString('base64url'),VAPID_PRIVATE_KEY:privateKey.d,VAPID_SUBJECT:'mailto:test@example.test'};
await savePreferences(db,'one',{...defaultPreferences,push_delivery:true});sql.exec("DELETE FROM notification_deliveries");inbox=[{...n,callUp:true,id:'fixture-push',kind:'tournament'}];let pushes=0;
await deliverNotifications(pushEnv,{...deps,fetch:async(url,init)=>{assert.ok(url.startsWith('https://fcm.googleapis.com/'));assert.equal(init.headers['content-encoding'],'aes128gcm');pushes++;return new Response(null,{status:410});}});assert.equal(pushes,3);assert.equal(sql.prepare('SELECT count(*) n FROM push_subscriptions').get().n,2);
const handlers={},shown=[];runInNewContext(readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://rallytt.net'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})}}});
async function push(data){let promise;handlers.push({data:{json:()=>data},waitUntil:p=>promise=p});await promise;}
await push({...n,href:'https://evil.test'});await push({...n,href:'//evil.test'});await push({...n});assert.equal(shown.length,1);assert.equal(shown[0].options.tag,n.id);
sql.exec("UPDATE profiles SET deleted_at='2026-10-07',auth_id=NULL,name='Deleted player' WHERE id='one'");assert.equal(sql.prepare('SELECT count(*) n FROM notification_deliveries').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM push_subscriptions').get().n,0);const deleted=calls.length;await deliverNotifications(env,deps);assert.equal(calls.length,deleted);
console.log('Delivery checks passed: opt-ins, old clients, inbox filtering, deduplication, retry idempotency, resolution, lease races, encrypted push, expired devices, endpoint validation and deletion cleanup.');
