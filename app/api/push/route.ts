import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {getAuthenticatedUser} from '@/lib/auth';
import {sameOrigin} from '@/lib/auth-rules';
import {AppError} from '@/lib/rally-errors';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {rateLimit} from '@/lib/write-limits';
import {pushCookie,saveSubscription} from '@/lib/push-subscriptions';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to manage notifications.');const p=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {...p,authId:user.id};}
async function handle(request:Request){
 try{const user=await viewer(),store=await cookies(),device=store.get(pushCookie)?.value;
  if(request.method==='GET')return reply({publicKey:env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT?env.VAPID_PUBLIC_KEY??null:null,enabled:!!device&&!!await env.DB.prepare('SELECT 1 FROM push_subscriptions WHERE id=? AND player_id=?').bind(device,user.id).first()});
  if(!sameOrigin(request))throw new AppError(403,'Request origin not allowed.');const limited=await rateLimit(env.USER_WRITE_LIMITER,user.authId);if(limited)return limited;
  const db=guardAccountWrites(env.DB,user.authId);
  if(request.method==='DELETE'){if(device)await db.prepare('DELETE FROM push_subscriptions WHERE id=? AND player_id=?').bind(device,user.id).run();store.delete(pushCookie);return reply({ok:true});}
  if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)throw new AppError(503,'Push notifications are not configured yet.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');const raw=await request.text();if(raw.length>4096)throw new AppError(413,'Subscription is too large.');let body;try{body=JSON.parse(raw);}catch{throw new AppError(400,'Invalid subscription.');}
  const owned=device&&/^[a-f0-9-]{36}$/.test(device)&&await db.prepare('SELECT 1 FROM push_subscriptions WHERE id=? AND player_id=?').bind(device,user.id).first();
  const id=owned?device!:crypto.randomUUID();await saveSubscription(db,user.id,id,body);store.set(pushCookie,id,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:365*86400});return reply({ok:true});
 }catch(e){if(e instanceof AppError)return reply({error:e.message},e.status);console.error('Push subscription failed');return reply({error:'Notifications are temporarily unavailable.'},503);}
}
export const GET=handle,POST=handle,DELETE=handle;
