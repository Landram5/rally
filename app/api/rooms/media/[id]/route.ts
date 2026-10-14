import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {roomScope,serveMedia} from '@/lib/chat-media';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to view leader rooms.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)throw new AppError(403,'Create your player profile first.');
  return await serveMedia(env,roomScope(env.DB),me.id,(await params).id,request.headers.get('range'));
 }catch(e){if(e instanceof AppError)return new Response(e.message,{status:e.status,headers:{'Cache-Control':'private, no-store'}});console.error('Room media unavailable',e);return new Response('Unavailable',{status:503});}
}
