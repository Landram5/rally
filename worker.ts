import handler from 'vinext/server/fetch-handler';
import {createAuthAdmin} from './lib/auth-admin';
import {retryDeletions} from './lib/account-deletion';
import {limitWrite} from './lib/write-limits';
import {deliverNotifications} from './lib/notification-delivery';
import {expireWaitlistOffers} from './lib/tournament-scheduling';
import {expandWeeklySessions} from './lib/weekly-sessions';

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
  const response=await handler.fetch(request,env,ctx);
  if(response.ok&&request.method==='POST'&&['/api/rally','/api/sessions'].includes(url.pathname))ctx.waitUntil(deliverNotifications(env));
  return response;
 },
 async scheduled(_event:ScheduledController,env:Cloudflare.Env){
  const jobs:Promise<unknown>[]=[deliverNotifications(env),expandWeeklySessions(env.DB),expireWaitlistOffers(env.DB)];
  if(env.SUPABASE_SECRET_KEY?.trim())jobs.push(retryDeletions(env.DB,createAuthAdmin(env).auth.admin));
  for(const result of await Promise.allSettled(jobs))if(result.status==='rejected')console.error('Scheduled maintenance unavailable');
 },
};

export default worker;
