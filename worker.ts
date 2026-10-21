import handler from 'vinext/server/fetch-handler';
import {createAuthAdmin} from './lib/auth-admin';
import {retryDeletions} from './lib/account-deletion';
import {limitWrite} from './lib/write-limits';
import {deliverNotifications} from './lib/notification-delivery';
import {expireWaitlistOffers} from './lib/tournament-scheduling';
import {expandWeeklySessions} from './lib/weekly-sessions';
import {cleanupChatMedia} from './lib/chat-media';
import {cleanupLiveMatches} from './lib/live-matches';
import {ensureDiscordGateway} from './lib/discord-ensure';
import {announceConfirmedMatches,announceFinishedTournaments} from './lib/discord-club';
import {sendWeeklyDigests} from './lib/weekly-digest';
import {alertIfNeeded,recordRun} from './lib/system-health';
export {ChatRoom} from './lib/chat-room';
export {DiscordGateway} from './lib/discord-gateway';

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
  const jobs:[string,Promise<unknown>][]=[['notifications',deliverNotifications(env)],['weekly sessions',expandWeeklySessions(env.DB)],['waitlist offers',expireWaitlistOffers(env.DB)],['chat media cleanup',cleanupChatMedia(env)],['live matches',cleanupLiveMatches(env.DB)],['Discord gateway',ensureDiscordGateway(env)],['Discord tournament posts',announceFinishedTournaments(env)],['Discord match posts',announceConfirmedMatches(env)],['weekly summaries',sendWeeklyDigests(env)]];
  if(env.SUPABASE_SECRET_KEY?.trim())jobs.push(['account deletions',retryDeletions(env.DB,createAuthAdmin(env).auth.admin)]);
  const results=await Promise.allSettled(jobs.map(j=>j[1])),failed=jobs.filter((_,i)=>results[i].status==='rejected').map(j=>j[0]);
  if(failed.length)console.error('Scheduled maintenance unavailable:',failed.join(', '));
  // Leave a heartbeat for /api/health, and email an administrator (at most every six hours) if something keeps failing.
  try{await recordRun(env.DB,failed);await alertIfNeeded(env,failed);}catch{console.error('Heartbeat unavailable');}
 },
};

export default worker;
