import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {createLinkCode,discordStatus,unlinkClub} from '@/lib/discord';
import {avatarOptedIn,connectedDiscord,createConnectCode,disconnectDiscord,listAnnounceChannels,setAnnounce,setAnnounceChannel,setAnnounceMatches,setMatchChannel,setAvatarOptIn} from '@/lib/discord-club';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to manage the Discord link.');const p=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {id:p.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Discord link unavailable',e);return response({error:'The Discord link is temporarily unavailable.'},503);};
const clubId=(v:unknown)=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new AppError(400,'Invalid club.');return v;};
// Club organizers only: link status, a one-time code to link a Discord channel, and unlinking.
export async function GET(request:Request){
 try{const me=await viewer();if(new URL(request.url).searchParams.get('account')==='1')return response({connected:await connectedDiscord(env,me.id),avatar:await avatarOptedIn(env,me.id)});return response(await discordStatus(env,me.id,clubId(new URL(request.url).searchParams.get('club'))));}catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
  const body=await request.json().catch(()=>({})) as {action?:string;clubId?:unknown;on?:unknown;channelId?:unknown};
  const me=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,me.authId);if(limited)return limited;
  if(body.action==='code')return response(await createLinkCode(env,me.id,clubId(body.clubId)));
  if(body.action==='unlink')return response(await unlinkClub(env,me.id,clubId(body.clubId)));
  if(body.action==='announce')return response(await setAnnounce(env,me.id,clubId(body.clubId),body.on===true));
  if(body.action==='announce_matches')return response(await setAnnounceMatches(env,me.id,clubId(body.clubId),body.on===true));
  if(body.action==='channels')return response(await listAnnounceChannels(env,me.id,clubId(body.clubId)));
  if(body.action==='match_channel')return response(await setMatchChannel(env,me.id,clubId(body.clubId),typeof body.channelId==='string'&&body.channelId?body.channelId:null));
  if(body.action==='announce_channel')return response(await setAnnounceChannel(env,me.id,clubId(body.clubId),typeof body.channelId==='string'&&body.channelId?body.channelId:null));
  if(body.action==='connect_code'){if(!env.DISCORD_BOT_TOKEN?.trim())throw new AppError(409,'The Discord bot is not set up for Rally yet.');return response(await createConnectCode(env,me.id));}
  if(body.action==='avatar')return response(await setAvatarOptIn(env,me.id,body.on===true));
  if(body.action==='disconnect')return response(await disconnectDiscord(env,me.id));
  throw new AppError(400,'Unknown action.');
 }catch(e){return failure(e);}
}
