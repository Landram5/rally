import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['write-limits','turnstile','club-export','rally-errors','seeding'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {limitWrite,rateLimit}=await import('../.test-runtime/write-limits.mjs'),{verifyTurnstile,captchaToken}=await import('../.test-runtime/turnstile.mjs'),{clubExport,csv}=await import('../.test-runtime/club-export.mjs'),{calculateRatings}=await import('../.test-runtime/seeding.mjs');
const seen=[],bindings={WRITE_LIMITER:{limit:async options=>{seen.push(['write',options.key]);return {success:false};}},AUTH_LIMITER:{limit:async options=>{seen.push(['auth',options.key]);return {success:false};}}};
for(const path of ['/api/rally','/api/sessions','/api/announcements','/api/account','/api/future']){const response=await limitWrite(new Request('https://rallytt.net'+path,{method:'POST',headers:{'CF-Connecting-IP':'203.0.113.1'}}),bindings);assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');}
assert.equal(await limitWrite(new Request('https://rallytt.net/api/rally'),bindings),null);
await limitWrite(new Request('https://rallytt.net/api/auth/password',{method:'POST',headers:{'CF-Connecting-IP':'203.0.113.1'}}),bindings);assert.deepEqual(seen.at(-1),['auth','203.0.113.1']);
assert.equal(await rateLimit({limit:async()=>({success:true})},'user'),null);assert.equal((await rateLimit({limit:async()=>{throw new Error();}},'user')).status,503);
for(const value of [null,{},'',false,'x'.repeat(2049)])assert.throws(()=>captchaToken(value),e=>e.status===400);
const originalFetch=globalThis.fetch,request=new Request('https://rallytt.net/api/rally',{headers:{'CF-Connecting-IP':'203.0.113.1'}});let answer={success:true,hostname:'rallytt.net',action:'feedback'};
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(options.body.get('response'),'token');assert.equal(options.body.get('remoteip'),'203.0.113.1');return Response.json(answer);};
await verifyTurnstile(request,'token','test-secret');
for(const invalid of [{success:false},{...answer,hostname:'evil.example'},{...answer,action:'auth'}]){answer=invalid;await assert.rejects(verifyTurnstile(request,'token','test-secret'),e=>e.status===400);}
await assert.rejects(verifyTurnstile(request,'token',''),e=>e.status===503);
globalThis.fetch=async()=>{throw new Error();};await assert.rejects(verifyTurnstile(request,'token','test-secret'),e=>e.status===503);globalThis.fetch=originalFetch;
assert.equal(csv([['=SUM(1)', 'a,"b"\nc',null]]),'\uFEFF"\'=SUM(1)","a,""b""\nc",""\r\n');
for(const dangerous of ['+CMD','-CMD','@CMD','  =1','\t1','\r1','\n1'])assert.ok(csv([[dangerous]]).startsWith('\uFEFF"\''));
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...args)=>sql.prepare(q).run(...args);function stmt(q,args=[]){return {bind(...a){return stmt(q,a);},async first(){return sql.prepare(q).get(...args)??null;},async all(){return {results:sql.prepare(q).all(...args)};}};}const db={prepare:stmt};
for(const id of ['owner','admin','board','member','pending','outsider'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',id,id+'-auth',id==='member'?'=formula':id,'2026-10-07');
for(const id of ['one','two'])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,'City',?,'2026-10-07','approved')",id,id,id==='one'?'owner':'outsider');
for(const [id,role] of [['owner','owner'],['admin','admin'],['board','board'],['member','member'],['pending','admin']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'one',?,?,?,'2026-10-07')",id,id,role,id==='pending'?'pending':'active');
run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('outsider','two','outsider','owner','active','2026-10-07')");
for(const kind of ['roster','results','ratings']){
 for(const id of ['board','member','pending','outsider','anonymous'])await assert.rejects(clubExport(db,id+'-auth','one',kind),e=>e.status===403);
 assert.equal(await clubExport(db,'owner-auth','one',kind),await clubExport(db,'admin-auth','one',kind));
 await assert.rejects(clubExport(db,'owner-auth','two',kind),e=>e.status===403);
}
await assert.rejects(clubExport(db,'owner-auth','one','secrets'),e=>e.status===400);
assert.ok((await clubExport(db,'owner-auth','one','roster')).includes('"\'=formula"'));assert.ok(!(await clubExport(db,'owner-auth','one','roster')).includes('outsider'));
run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('result','one','member','board','[[11,5],[11,6]]',3,'2026-10-07','confirmed','member','2026-10-07')");
const rating=calculateRatings([{id:'result',a:'member',b:'board',games:[[11,5],[11,6]],best_of:3,played_on:'2026-10-07',club_id:'one',status:'confirmed'}],'2026-10-07').get('member');
assert.ok((await clubExport(db,'owner-auth','one','ratings','2026-10-07')).includes(`"${Math.round(rating.rating)}","1","1","0"`));
run("UPDATE memberships SET status='declined' WHERE player_id='admin'");await assert.rejects(clubExport(db,'admin-auth','one','roster'),e=>e.status===403);
console.log('Safety passed: all write routes, auth limits, outage denial, CAPTCHA input/hostname/action failures, CSV formula escaping, club isolation, owner/admin-only access, revoked roles and rating parity.');
// Exercise the real Auth routes without creating accounts or sending emails.
writeFileSync('.test-runtime/safety-auth.mjs',`export const calls=[]; export const createAuthClient=async()=>({auth:{signUp:async value=>{calls.push(value);return {data:{session:null},error:null};},signInWithPassword:async value=>{calls.push(value);return {error:null};},resetPasswordForEmail:async (...value)=>{calls.push(value);return {error:null};}}});`);
writeFileSync('.test-runtime/auth-rules.mjs',ts.transpileModule(readFileSync('lib/auth-rules.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
for(const name of ['password','reset-password'])writeFileSync(`.test-runtime/safety-${name}.mjs`,ts.transpileModule(readFileSync(`app/api/auth/${name}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'@/lib/auth'","'./safety-auth.mjs'").replace("'@/lib/auth-rules'","'./auth-rules.mjs'").replace("'@/lib/turnstile'","'./turnstile.mjs'"));
const password=await import('../.test-runtime/safety-password.mjs'),reset=await import('../.test-runtime/safety-reset-password.mjs'),{calls}=await import('../.test-runtime/safety-auth.mjs');
const authRequest=body=>new Request('https://rallytt.net/api/auth/password',{method:'POST',headers:{origin:'https://rallytt.net','content-type':'application/json'},body:JSON.stringify(body)});
const signup={mode:'signup',email:'test@example.test',password:'test-password',displayName:'Test',captchaToken:'test-token'};
assert.equal((await password.POST(authRequest({...signup,captchaToken:''}))).status,400);assert.equal(calls.length,0);
assert.equal((await password.POST(authRequest(null))).status,400);assert.equal((await reset.POST(authRequest(null))).status,400);
assert.equal((await password.POST(authRequest(signup))).status,200);assert.equal(calls.at(-1).options.captchaToken,'test-token');
assert.equal((await password.POST(authRequest({...signup,mode:'signin'}))).status,200);assert.equal(calls.at(-1).options.captchaToken,'test-token');
assert.equal((await reset.POST(authRequest(signup))).status,200);assert.equal(calls.at(-1)[1].captchaToken,'test-token');
console.log('Auth safety passed: missing-token rejection, malformed bodies, and one-use CAPTCHA forwarding to Supabase for signup, signin and reset.');
