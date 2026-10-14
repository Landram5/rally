import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
writeFileSync('.test-runtime/oauth-rules.mjs',compile(readFileSync('lib/auth-rules.ts','utf8')));
writeFileSync('.test-runtime/oauth-auth.mjs',`export const calls=[]; export let result={data:{url:'https://provider.example/authorize'},error:null}; export function respond(value){result=value;} export const createAuthClient=async()=>({auth:{signInWithOAuth:async value=>{calls.push(value);return result;},exchangeCodeForSession:async code=>{calls.push(code);return result;}}});`);
for(const name of ['apple','google','callback'])writeFileSync(`.test-runtime/oauth-${name}.mjs`,compile(readFileSync(`app/auth/${name}/route.ts`,'utf8')).replace("'@/lib/auth'","'./oauth-auth.mjs'").replace("'@/lib/auth-rules'","'./oauth-rules.mjs'"));
const {calls,respond}=await import('../.test-runtime/oauth-auth.mjs');
for(const provider of ['apple','google']){
 const {GET}=await import(`../.test-runtime/oauth-${provider}.mjs`);
 for(const next of ['/clubhouse?tab=matches','//evil.example','/\\evil.example','https://evil.example']){
  respond({data:{url:'https://provider.example/authorize'},error:null});
  const response=await GET(new Request('https://rallytt.net/auth/'+provider+'?'+new URLSearchParams({next})));
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://provider.example/authorize');
  const options=calls.at(-1);assert.equal(options.provider,provider);assert.equal(options.options.skipBrowserRedirect,true);
  const callback=new URL(options.options.redirectTo);assert.equal(callback.origin,'https://rallytt.net');assert.equal(callback.pathname,'/auth/callback');assert.equal(callback.searchParams.get('next'),next.startsWith('/clubhouse')?next:'/');
 }
 for(const result of [{data:{url:null},error:null},{data:{url:null},error:{message:'private provider detail'}}]){
  respond(result);const response=await GET(new Request('https://rallytt.net/auth/'+provider));
  const location=new URL(response.headers.get('location'));assert.equal(location.pathname,'/login');assert.match(location.searchParams.get('error'),new RegExp(provider,'i'));assert.ok(!location.href.includes('private'));
 }
}
const {GET}=await import('../.test-runtime/oauth-callback.mjs');
respond({error:null});const response=await GET(new Request('https://rallytt.net/auth/callback?code=one-use-test-code&next=%2Fclubhouse'));
assert.equal(calls.at(-1),'one-use-test-code');assert.equal(response.headers.get('location'),'https://rallytt.net/clubhouse');
assert.equal((await GET(new Request('https://rallytt.net/auth/callback?code=test&next=%2F%2Fevil.example'))).headers.get('location'),'https://rallytt.net/');
for(const url of ['https://rallytt.net/auth/callback','https://rallytt.net/auth/callback?code=expired']){respond({error:{message:'invalid'}});assert.equal(new URL((await GET(new Request(url))).headers.get('location')).pathname,'/login');}
console.log('OAuth passed: Apple/Google provider selection, safe return paths, shared code exchange, missing/expired codes and sanitized start failures.');
