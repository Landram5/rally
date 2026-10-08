import {rateLimit} from '@/lib/write-limits';
import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {deleteRemoteDraft,readRemoteDraft,saveRemoteDraft} from '@/lib/live-draft-store';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to sync a live match.');const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)throw new AppError(403,'Create your player profile first.');return {id:profile.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Live draft sync unavailable',e);return response({error:'Live match sync is temporarily unavailable.'},503);};
async function readJson(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
 const text=await request.text();if(text.length>2_000_000)throw new AppError(413,'This draft is too large to sync.');
 try{return JSON.parse(text) as unknown}catch{throw new AppError(400,'Invalid request.')}
}
export async function GET(){try{const user=await viewer();return response({draft:await readRemoteDraft(env.DB,user.id)});}catch(e){return failure(e);}}
export async function PUT(request:Request){try{const body=await readJson(request),user=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,user.authId);if(limited)return limited;return response(await saveRemoteDraft(guardAccountWrites(env.DB,user.authId),user.id,body));}catch(e){return failure(e);}}
export async function DELETE(request:Request){try{const body=await readJson(request) as {id?:unknown},user=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,user.authId);if(limited)return limited;return response(await deleteRemoteDraft(guardAccountWrites(env.DB,user.authId),user.id,body?.id));}catch(e){return failure(e);}}
