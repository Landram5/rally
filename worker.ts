import handler from 'vinext/server/fetch-handler';
import {createAuthAdmin} from './lib/auth-admin';
import {retryDeletions} from './lib/account-deletion';
import {limitWrite} from './lib/write-limits';

const worker={
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const url=new URL(request.url);
  if((url.hostname==='rallytt.net'||url.hostname==='www.rallytt.net')&&
    (url.protocol!=='https:'||url.hostname==='www.rallytt.net')){
   url.protocol='https:';
   url.hostname='rallytt.net';
   url.port='';
   return Response.redirect(url.toString(),308);
  }
  const limited=await limitWrite(request,env);if(limited)return limited;
  return handler.fetch(request,env,ctx);
 },
 async scheduled(_event:ScheduledController,env:Cloudflare.Env){
  if(!env.SUPABASE_SECRET_KEY?.trim())return;
  await retryDeletions(env.DB,createAuthAdmin(env).auth.admin);
 },
};

export default worker;
