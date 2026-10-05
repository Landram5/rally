import handler from 'vinext/server/fetch-handler';
import {createAuthAdmin} from './lib/auth-admin';
import {retryDeletions} from './lib/account-deletion';

const worker={
 fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  return handler.fetch(request,env,ctx);
 },
 async scheduled(_event:ScheduledController,env:Cloudflare.Env){
  if(!env.SUPABASE_SECRET_KEY?.trim())return;
  await retryDeletions(env.DB,createAuthAdmin(env).auth.admin);
 },
};

export default worker;
