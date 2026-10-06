import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
import {createServerClient} from '@supabase/ssr';

mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/auth-session.mjs',ts.transpileModule(readFileSync('lib/auth-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'next/server'","'next/server.js'"));
const {refreshPageSession}=await import('../.test-runtime/auth-session.mjs');
const config={url:'https://rally-test.supabase.co',key:'test-publishable-key'},key='sb-rally-test-auth-token';
const user={id:'test-player',aud:'authenticated',role:'authenticated',email:'player@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{display_name:'Test Player'},created_at:'2026-01-01T00:00:00Z'};
const jwt=expires=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:expires,iat:expires-3600,role:'authenticated'})).toString('base64url'),'test-signature'].join('.');
const now=Math.floor(Date.now()/1000),oldSession={access_token:jwt(now-3600),refresh_token:'old-test-refresh',expires_at:now-3600,expires_in:3600,token_type:'bearer',user};
let refreshes=0,validations=0;
const mockFetch=async(input,options)=>{
 const url=String(input);
 if(url.includes('/token?grant_type=refresh_token')){
  refreshes++;assert.equal(JSON.parse(options.body).refresh_token,'old-test-refresh');
  return Response.json({access_token:jwt(now+3600),refresh_token:'renewed-test-refresh',expires_in:3600,token_type:'bearer',user});
 }
 if(url.endsWith('/user')){validations++;return Response.json(user)}
 throw new Error('Unexpected Auth request');
};
const factory=(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:mockFetch}});
const expiredCookie='base64-'+Buffer.from(JSON.stringify(oldSession)).toString('base64url');
const request=new NextRequest('https://rallytt.net/players/test-player',{headers:{cookie:`${key}=${expiredCookie}`}});
const response=await refreshPageSession(request,config,factory);
assert.equal(refreshes,1);assert.ok(validations>=1,'identity is validated against Auth');
const cookie=response.cookies.get(key);assert.ok(cookie?.value,'renewed cookies must be returned to the browser');
assert.equal(request.cookies.get(key).value,cookie.value,'the same request must render with the renewed session');
assert.match(response.headers.get('cache-control'),/private.*no-store/);
assert.ok(cookie.maxAge>86400,'cookie outlives the access token and app closure');
assert.equal(cookie.path,'/');assert.equal(cookie.sameSite,'lax');
const next=new NextRequest('https://rallytt.net/',{headers:{cookie:`${key}=${cookie.value}`}});
await refreshPageSession(next,config,factory);
assert.equal(refreshes,1,'reopening the app keeps the renewed token without another refresh');
assert.ok(validations>=2);
const anonymous=new NextRequest('https://rallytt.net/players/test-player');
const anonymousResponse=await refreshPageSession(anonymous,config,factory);
assert.equal(anonymousResponse.cookies.getAll().length,0,'anonymous public pages do not create a session');
const revokedFactory=(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:async()=>Response.json({code:'refresh_token_not_found',message:'Invalid Refresh Token: Refresh Token Not Found'},{status:400})}});
const revoked=new NextRequest('https://rallytt.net/',{headers:{cookie:`${key}=${expiredCookie}`}});
const revokedResponse=await refreshPageSession(revoked,config,revokedFactory);
assert.equal(revokedResponse.cookies.get(key).maxAge,0,'a revoked session must not be kept signed in');
console.log('Passed: expired-session renewal, browser/request cookie propagation, persistent lifetime, reopen continuity, Auth validation and anonymous navigation.');
