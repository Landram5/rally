import {allowedOrigin} from '@/lib/auth-rules';
import {env,waitUntil} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {createRoom,deleteRoomMessage,invite,leaveRoom,listRooms,lookupInvitees,markRoomRead,postRoomMessage,readRoom,removeMember,reportRoomMessage,respondToInvite,setRoomNotify,updateRoom} from '@/lib/rooms';
import {publishChat} from '@/lib/chat-room';
import {pushRoomMessage} from '@/lib/chat-push';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use leader rooms.');const p=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {id:p.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Leader rooms unavailable',e);return response({error:'Leader rooms are temporarily unavailable.'},503);};
export async function GET(request:Request){
 try{
  const me=await viewer(),q=new URL(request.url).searchParams;
  if(q.get('lookup')!==null)return response(await lookupInvitees(env.DB,me.id,q.get('room'),q.get('lookup')));
  if(q.get('room'))return response(await readRoom(env.DB,me.id,q.get('room'),{before:q.get('before')??undefined}));
  return response(await listRooms(env.DB,me.id));
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(!allowedOrigin(request))throw new AppError(403,'Request origin not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
  const text=await request.text();if(text.length>20_000)throw new AppError(413,'That request is too large.');
  let body:Record<string,unknown>;try{body=JSON.parse(text) as Record<string,unknown>}catch{throw new AppError(400,'Invalid request.')}
  const me=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,me.authId);if(limited)return limited;
  const db=guardAccountWrites(env.DB,me.authId);
  switch(body.action){
   case 'create':return response(await createRoom(db,me.id,body));
   case 'invite':return response(await invite(db,me.id,body.roomId,body.personId));
   case 'respond':return response(await respondToInvite(db,me.id,body.roomId,body.accept));
   case 'remove':return response(await removeMember(db,me.id,body.roomId,body.personId));
   case 'leave':return response(await leaveRoom(db,me.id,body.roomId));
   case 'update':return response(await updateRoom(db,me.id,body.roomId,body));
   case 'send':{
    const {message,roomId,created}=await postRoomMessage(db,me.id,body.roomId,body);
    if(created)waitUntil((async()=>{const online=await publishChat(env,`room:${roomId}`,{type:'message',message:{...message,mine:false,canDelete:false}});await pushRoomMessage(env,roomId,message,online);})());
    return response({message});}
   case 'delete':{const r=await deleteRoomMessage(db,me.id,body.id);if(r.r2Key)waitUntil(env.CHAT_MEDIA.delete(r.r2Key).catch(()=>{}));waitUntil(publishChat(env,`room:${r.roomId}`,{type:'delete',id:r.id}));return response({ok:true});}
   case 'report':return response(await reportRoomMessage(db,me.id,body.id,body.reason));
   case 'read':return response(await markRoomRead(db,me.id,body.roomId));
   case 'notify':return response(await setRoomNotify(db,me.id,body.roomId,body.on));
   default:throw new AppError(400,'Unknown leader room action.');
  }
 }catch(e){return failure(e);}
}
