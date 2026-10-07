import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {guardAccountWrites} from '@/lib/account-write-guard';
import {readSessions,sessionAction} from '@/lib/club-sessions';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function viewer(){const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to view club sessions.');const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)throw new AppError(403,'Create your player profile first.');return {id:profile.id,authId:user.id,siteAdmin:(env.RALLY_ADMIN_EMAILS??'').split(',').some(e=>e.trim().toLowerCase()===user.email.toLowerCase())};}
const failure=(e:unknown)=>{if(e instanceof AppError)return response({error:e.message},e.status);console.error('Sessions unavailable',e);return response({error:'Sessions are temporarily unavailable. Try again.'},503);};
export async function GET(request:Request){try{const user=await viewer();return response({sessions:await readSessions(env.DB,user.id,new URL(request.url).searchParams.get('club')??undefined)});}catch(e){return failure(e);}}
export async function POST(request:Request){try{if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Request origin not allowed.');if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');const text=await request.text();if(text.length>10000)throw new AppError(413,'Session request is too large.');let body:Record<string,unknown>;try{body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{throw new AppError(400,'Invalid session request.');}const user=await viewer();return response(await sessionAction(guardAccountWrites(env.DB,user.authId),user.id,body));}catch(e){return failure(e);}}
