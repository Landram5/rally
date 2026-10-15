import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
import {acceptInvite,activeInvite,createInvite,revokeInvites} from '@/lib/club-invites';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(accept=false){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use an invite link.');if(accept)await env.DB.prepare('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?) ON CONFLICT(auth_id) DO NOTHING').bind(crypto.randomUUID(),user.id,user.displayName.slice(0,60)||'Player',new Date().toISOString()).run();const p=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!p)throw new AppError(403,'Create your player profile first.');return {id:p.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Invite links unavailable',e);return response({error:'Invite links are temporarily unavailable.'},503);};
const clubId=(v:unknown)=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new AppError(400,'Invalid club.');return v;};
// Organizers: the club's working invite link. Anyone signed in: join with a link.
export async function GET(request:Request){
 try{const me=await viewer();return response({invite:await activeInvite(env.DB,me.id,clubId(new URL(request.url).searchParams.get('club')))});}catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
  const body=await request.json().catch(()=>({})) as {action?:string;clubId?:unknown;days?:unknown;token?:unknown};
  const me=await viewer(body.action==='accept'),limited=await rateLimit(env.USER_WRITE_LIMITER,me.authId);if(limited)return limited;
  if(body.action==='create')return response({invite:await createInvite(env.DB,me.id,clubId(body.clubId),Number(body.days))});
  if(body.action==='revoke')return response(await revokeInvites(env.DB,me.id,clubId(body.clubId)));
  if(body.action==='accept'){if(typeof body.token!=='string')throw new AppError(400,'Invalid invite link.');return response(await acceptInvite(env.DB,me.id,body.token));}
  throw new AppError(400,'Unknown action.');
 }catch(e){return failure(e);}
}
