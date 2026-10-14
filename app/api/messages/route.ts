import {env,waitUntil} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {blockedIds,deleteDm,dmNotifyEnabled,listBlocks,listSafetyReports,listThreads,lookupPeople,markThreadRead,readThread,reportDm,reportUser,resolveSafetyReport,sendDm,setBlock,setDmNotify,startThread,unreadDmCount,canMessage} from '@/lib/messages';
import {publishChat} from '@/lib/chat-room';
import {pushDirectMessage} from '@/lib/chat-push';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
const siteAdmin=(email:string)=>(env.RALLY_ADMIN_EMAILS??'').split(',').some(v=>v.trim().toLowerCase()===email.toLowerCase());
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use messages.');const p=await env.DB.prepare('SELECT id,name FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string;name:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {id:p.id,name:p.name,authId:user.id,admin:siteAdmin(user.email)};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Messages unavailable',e);return response({error:'Messages are temporarily unavailable.'},503);};
export async function GET(request:Request){
 try{
  const me=await viewer(),q=new URL(request.url).searchParams;
  if(q.get('lookup')!==null)return response(await lookupPeople(env.DB,me.id,q.get('lookup')));
  if(q.get('thread'))return response(await readThread(env.DB,me.id,q.get('thread'),{before:q.get('before')??undefined}));
  if(q.get('blocks'))return response(await listBlocks(env.DB,me.id));
  if(q.get('reports'))return response(await listSafetyReports(env.DB,me.admin));
  if(q.get('can')){return response({canMessage:await canMessage(env.DB,me.id,q.get('can')??'')});}
  if(q.get('unread'))return response({unread:await unreadDmCount(env.DB,me.id)});
  return response({me:me.id,admin:me.admin,notify:await dmNotifyEnabled(env.DB,me.id),blocked:await blockedIds(env.DB,me.id),...await listThreads(env.DB,me.id)});
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
   case 'start':return response(await startThread(db,me.id,body.personId));
   case 'send':{
    const r=await sendDm(db,me.id,body.threadId,body);
    if(r.created)waitUntil((async()=>{const event={type:'dm',message:{...r.message,mine:false}};const online=await publishChat(env,`inbox:${r.other}`,event);await publishChat(env,`inbox:${me.id}`,{type:'dm',message:r.message});await pushDirectMessage(env,r.message,me.name,r.other,online);})());
    return response({message:r.message});}
   case 'delete':{const r=await deleteDm(db,me.id,body.id);waitUntil(Promise.all(r.participants.map(p=>publishChat(env,`inbox:${p}`,{type:'dm_delete',id:r.id,threadId:r.threadId}))));return response({ok:true});}
   case 'read':return response(await markThreadRead(db,me.id,body.threadId));
   case 'block':return response(await setBlock(db,me.id,body.personId,body.blocked));
   case 'report_dm':return response(await reportDm(db,me.id,body.id,body.reason));
   case 'report_user':return response(await reportUser(db,me.id,body.personId,body.reason));
   case 'resolve_report':return response(await resolveSafetyReport(db,me.admin,me.id,body.id));
   case 'notify':return response(await setDmNotify(db,me.id,body.on));
   default:throw new AppError(400,'Unknown messages action.');
  }
 }catch(e){return failure(e);}
}
