import {env,waitUntil} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {deleteMessage,listReports,markRead,postMessage,readMessages,reportMessage,resolveReport,setMute,setNotify,unreadCounts} from '@/lib/chat';
import {publishChat} from '@/lib/chat-room';
import {blockedIds} from '@/lib/messages';
import {pushChatMessage} from '@/lib/chat-push';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use club chat.');const p=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {id:p.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Club chat unavailable',e);return response({error:'Club chat is temporarily unavailable.'},503);};
export async function GET(request:Request){
 try{
  const me=await viewer(),url=new URL(request.url);
  if(url.searchParams.get('counts'))return response({counts:await unreadCounts(env.DB,me.id)});
  if(url.searchParams.get('reports'))return response(await listReports(env.DB,me.id,url.searchParams.get('club')));
  return response({me:me.id,blocked:await blockedIds(env.DB,me.id),...await readMessages(env.DB,me.id,url.searchParams.get('club'),{before:url.searchParams.get('before')??undefined,after:url.searchParams.get('after')??undefined})});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
  const text=await request.text();if(text.length>20_000)throw new AppError(413,'That request is too large.');
  let body:Record<string,unknown>;try{body=JSON.parse(text) as Record<string,unknown>}catch{throw new AppError(400,'Invalid request.')}
  const me=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,me.authId);if(limited)return limited;
  const db=guardAccountWrites(env.DB,me.authId);
  switch(body.action){
   case 'send':{
    const {message,created}=await postMessage(db,me.id,body.clubId,body);
    if(created)waitUntil((async()=>{const online=await publishChat(env,message.clubId,{type:'message',message:{...message,mine:false,canDelete:false}});await pushChatMessage(env,message,online);})());
    return response({message});}
   case 'delete':{
    const r=await deleteMessage(db,me.id,body.id);
    if(r.r2Key)waitUntil(env.CHAT_MEDIA.delete(r.r2Key).catch(()=>{}));
    waitUntil(publishChat(env,r.clubId,{type:'delete',id:r.id}));
    return response({ok:true});}
   case 'report':return response(await reportMessage(db,me.id,body.id,body.reason));
   case 'resolve_report':return response(await resolveReport(db,me.id,body.id));
   case 'mute':return response(await setMute(db,me.id,body.clubId,body.playerId,body.muted));
   case 'read':return response(await markRead(db,me.id,body.clubId));
   case 'notify':return response(await setNotify(db,me.id,body.clubId,body.on));
   default:throw new AppError(400,'Unknown chat action.');
  }
 }catch(e){return failure(e);}
}
