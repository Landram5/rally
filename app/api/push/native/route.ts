import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {allowedOrigin} from '@/lib/auth-rules';
import {AppError} from '@/lib/rally-errors';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {rateLimit} from '@/lib/write-limits';
import {saveNativeDevice,removeNativeDevice} from '@/lib/native-push';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
// iOS app: POST {token,environment:'sandbox'|'production'} registers this device, DELETE {token} removes it.
async function handle(request:Request){
 try{
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to manage notifications.');
  const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)throw new AppError(403,'Create your player profile first.');
  if(!allowedOrigin(request))throw new AppError(403,'Request origin not allowed.');
  const limited=await rateLimit(env.USER_WRITE_LIMITER,user.id);if(limited)return limited;
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
  const raw=await request.text();if(raw.length>1024)throw new AppError(413,'Request too large.');
  let body;try{body=JSON.parse(raw);}catch{throw new AppError(400,'Invalid request.');}
  const db=guardAccountWrites(env.DB,user.id);
  if(request.method==='DELETE')await removeNativeDevice(db,profile.id,body);else await saveNativeDevice(db,profile.id,body);
  return reply({ok:true});
 }catch(e){if(e instanceof AppError)return reply({error:e.message},e.status);console.error('Native push registration failed');return reply({error:'Notifications are temporarily unavailable.'},503);}
}
export const POST=handle,DELETE=handle;
