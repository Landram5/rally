import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/cf-stub.mjs','export class DurableObject{}\n');
for(const name of readdirSync('lib').filter(f=>f.endsWith('.ts')).map(f=>f.slice(0,-3)))writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'").replace(/from ['"]cloudflare:workers['"]/g,"from './cf-stub.mjs'"));
const d=await import('../.test-runtime/weekly-digest.mjs'),prefs=await import('../.test-runtime/notification-preferences.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt};
// Weeks and the send window (UTC).
assert.equal(d.weekOf(new Date('2026-10-15T09:00:00Z')),'2026-10-12','a Thursday belongs to the week of its Monday');assert.equal(d.weekOf(new Date('2026-10-12T00:00:00Z')),'2026-10-12');assert.equal(d.weekOf(new Date('2026-10-18T23:59:00Z')),'2026-10-12','Sunday is still that week');assert.equal(d.weekOf(new Date('2026-10-19T00:00:00Z')),'2026-10-19');
assert.equal(d.isSendWindow(new Date('2026-10-19T13:00:00Z')),true);assert.equal(d.isSendWindow(new Date('2026-10-19T12:59:00Z')),false,'not before 1 pm UTC Monday');assert.equal(d.isSendWindow(new Date('2026-10-20T14:00:00Z')),false,'only on Monday');
// Content.
const now=new Date('2026-10-19T13:05:00Z'),notice=(id,over={})=>({id,title:'Verify a match',detail:'A vs B',href:'/clubhouse?tab=matches',kind:'match',read:false,actionNeeded:true,...over});
const session=(title,hours,over={})=>({title,clubName:'Harbor TT',starts_at:new Date(now.getTime()+hours*3600000).toISOString(),status:'scheduled',...over});
assert.equal(d.buildDigest({notifications:[],sessions:[]},now),null,'nothing to say, no email');
assert.equal(d.buildDigest({notifications:[notice('a',{read:true}),notice('b',{actionNeeded:false})],sessions:[session('Old',-5),session('Far',24*9),session('Cancelled',5,{status:'cancelled'})]},now),null,'read, informational, past, far-off and cancelled items are left out');
let mail=d.buildDigest({notifications:[notice('a'),notice('b',{title:'Review a membership request',detail:'Sam wants to join',href:'/clubs/c1?section=management'})],sessions:[session('Practice',30),session('Early',3)]},now);
assert.match(mail.subject,/2 things are waiting/);assert.match(mail.text,/WAITING FOR YOU/);assert.match(mail.text,/https:\/\/rallytt\.net\/clubs\/c1\?section=management/);assert.match(mail.text,/COMING UP THIS WEEK/);
assert.ok(mail.text.indexOf('Early')<mail.text.indexOf('Practice'),'sessions are in date order');assert.match(mail.text,/account#notifications/,'every email says how to stop');
mail=d.buildDigest({notifications:[],sessions:[session('Practice',30)]},now);assert.equal(mail.subject,'Your week on Rally');assert.ok(!/WAITING FOR YOU/.test(mail.text));
assert.match(d.buildDigest({notifications:[notice('a')],sessions:[]},now).subject,/1 thing is waiting/);
assert.equal(d.buildDigest({notifications:Array.from({length:20},(_,i)=>notice('n'+i)),sessions:[]},now).text.match(/Verify a match/g).length,8,'at most eight waiting items');
// Preferences: off by default, and saving other choices never turns it on or off.
for(const p of ['a','b','c','d','gone'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');
const all=over=>({match_updates:true,registration_updates:true,tournament_updates:true,record_updates:true,feedback_updates:true,...over});
assert.equal((await prefs.readPreferences(db,'a')).weekly_digest,false,'off by default');
await prefs.savePreferences(db,'a',all({weekly_digest:true}));assert.equal((await prefs.readPreferences(db,'a')).weekly_digest,true);
await prefs.savePreferences(db,'a',all({}));assert.equal((await prefs.readPreferences(db,'a')).weekly_digest,true,'a save that does not mention it keeps it');
await prefs.savePreferences(db,'a',all({weekly_digest:false}));assert.equal((await prefs.readPreferences(db,'a')).weekly_digest,false);
for(const p of ['a','b','c','d','gone'])await prefs.savePreferences(db,p,all({weekly_digest:p!=='d'}));
run("UPDATE profiles SET deleted_at='2026-10-02',auth_id=NULL,name='Deleted player' WHERE id='gone'");
// The job.
const sentMail=[],http=async(url,init)=>{const b=JSON.parse(init.body);sentMail.push({to:b.to[0],subject:b.subject,key:init.headers['Idempotency-Key']});return new Response('{}',{status:200});};
const env={DB:db,RESEND_API_KEY:'k',NOTIFICATION_FROM:'Rally <r@rallytt.net>',SUPABASE_SECRET_KEY:'s'};
const read=async auth=>auth==='c-auth'?{notifications:[],sessions:[]}:{notifications:[notice('x')],sessions:[]};
const email=async auth=>auth==='b-auth'?null:auth.replace('-auth','')+'@example.com';
const deps={read,email,fetch:http,now};
assert.equal(await d.sendWeeklyDigests({...env,RESEND_API_KEY:''},deps),0,'needs the email provider');assert.equal(await d.sendWeeklyDigests(env,{...deps,now:new Date('2026-10-20T14:00:00Z')}),0,'only Monday afternoon');assert.equal(sentMail.length,0);
assert.equal(await d.sendWeeklyDigests(env,deps),1,'only people who opted in, have something to read and a confirmed address get one');
assert.deepEqual(sentMail.map(m=>m.to),['a@example.com'],'not d (opted out), c (nothing to say), b (no confirmed address) or the deleted account');assert.equal(sentMail[0].key,'digest-a-2026-10-19');
assert.equal(await d.sendWeeklyDigests(env,deps),0,'a second run the same week sends nothing');assert.equal(sentMail.length,1);
assert.equal(one("SELECT count(*) n FROM digest_sent WHERE week='2026-10-19'").n,3,'quiet weeks are recorded too, so they are not retried every five minutes');
assert.equal(await d.sendWeeklyDigests(env,{...deps,now:new Date('2026-10-26T13:10:00Z')}),1,'and the next Monday it goes out again');
// A failing provider gives the week back so the next run retries.
run("DELETE FROM digest_sent");sentMail.length=0;
assert.equal(await d.sendWeeklyDigests(env,{...deps,fetch:async()=>new Response('no',{status:500})}),0);assert.equal(one("SELECT count(*) n FROM digest_sent WHERE player_id='a'").n,0,'a refused email is retried');
assert.equal(await d.sendWeeklyDigests(env,{...deps,fetch:async()=>{throw new Error('offline')}}),0);assert.equal(one("SELECT count(*) n FROM digest_sent WHERE player_id='a'").n,0,'so is a network failure');
assert.equal(await d.sendWeeklyDigests(env,deps),1,'and it sends once the provider is back');
// Deleting an account removes its record.
run("DELETE FROM profiles WHERE id='a'");assert.equal(one("SELECT count(*) n FROM digest_sent WHERE player_id='a'").n,0);
console.log('weekly digest tests passed');
