import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {chatAccess} from '@/lib/chat';
import {roomAccess} from '@/lib/rooms';
export const dynamic='force-dynamic';
// WebSocket for live chat. Membership is checked here; the room only ever sees verified members.
export async function GET(request:Request){
 try{
  if(request.headers.get('Upgrade')!=='websocket')throw new AppError(426,'WebSocket required.');
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use club chat.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)throw new AppError(403,'Create your player profile first.');
  // The messages tab listens on a private room per person; club chat listens on the club's room.
  if(new URL(request.url).searchParams.get('inbox'))return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('inbox:'+me.id)).fetch('https://room/connect',{headers:{Upgrade:'websocket','x-chat-player':me.id}});
  const roomId=new URL(request.url).searchParams.get('room');
  if(roomId){await roomAccess(env.DB,me.id,roomId);return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('room:'+roomId)).fetch('https://room/connect',{headers:{Upgrade:'websocket','x-chat-player':me.id}});}
  const club=new URL(request.url).searchParams.get('club')??'';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(club))throw new AppError(400,'Invalid club.');
  await chatAccess(env.DB,me.id,club);
  const room=env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(club));
  return room.fetch('https://room/connect',{headers:{Upgrade:'websocket','x-chat-player':me.id}});
 }catch(e){if(e instanceof AppError)return new Response(e.message,{status:e.status});console.error('Chat connection unavailable',e);return new Response('Unavailable',{status:503});}
}
