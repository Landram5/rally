import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {serveChatMedia} from '@/lib/chat-media';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to view club chat.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)throw new AppError(403,'Create your player profile first.');
  return await serveChatMedia(env,me.id,(await params).id,request.headers.get('range'));
 }catch(e){if(e instanceof AppError)return new Response(e.message,{status:e.status,headers:{'Cache-Control':'private, no-store'}});console.error('Chat media unavailable',e);return new Response('Unavailable',{status:503});}
}
