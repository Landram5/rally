import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {uploadChatMedia} from '@/lib/chat-media';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
// POST /api/chat/media?club=<id> with the raw file as the body. Returns the attachment to send with a message.
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use club chat.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)throw new AppError(403,'Create your player profile first.');
  const limited=await rateLimit(env.USER_WRITE_LIMITER,user.id);if(limited)return limited;
  return response(await uploadChatMedia(env,me.id,new URL(request.url).searchParams.get('club')??'',request));
 }catch(e){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Chat upload unavailable',e);return response({error:'Uploads are temporarily unavailable.'},503);}
}
