import {rateLimit} from '@/lib/write-limits';
import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {openPlayAction,readOpenPlay} from '@/lib/open-play';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to use open play.');const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)throw new AppError(403,'Create your player profile first.');return {id:profile.id,authId:user.id};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Open play unavailable',e);return response({error:'Open play is temporarily unavailable. Try again.'},503);};
export async function GET(request:Request){try{const user=await viewer();return response({players:await readOpenPlay(env.DB,user.id,new URL(request.url).searchParams.get('club')??'')});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
 const text=await request.text();if(text.length>2000)throw new AppError(413,'Open play request is too large.');
 let body:Record<string,unknown>;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{throw new AppError(400,'Invalid open play request.');}
 const user=await viewer(),limited=await rateLimit(env.USER_WRITE_LIMITER,user.authId);if(limited)return limited;
 return response(await openPlayAction(guardAccountWrites(env.DB,user.authId),user.id,body));
}catch(e){return failure(e);}}
