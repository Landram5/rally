import {allowedOrigin} from '@/lib/auth-rules';
import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {roomScope,uploadMedia} from '@/lib/chat-media';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
// POST /api/rooms/media?room=<id> with the raw file as the body.
export async function POST(request:Request){
 try{
  if(!allowedOrigin(request))throw new AppError(403,'Request origin not allowed.');
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use leader rooms.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)throw new AppError(403,'Create your player profile first.');
  const limited=await rateLimit(env.USER_WRITE_LIMITER,user.id);if(limited)return limited;
  return response(await uploadMedia(env,roomScope(env.DB),new URL(request.url).searchParams.get('room')??'',me.id,request));
 }catch(e){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Room upload unavailable',e);return response({error:'Uploads are temporarily unavailable.'},503);}
}
