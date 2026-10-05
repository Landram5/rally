import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError,makeService} from '@/lib/rally-service';
export const dynamic='force-dynamic';
function service(){if(!env.DB)throw new Error('Database unavailable');return makeService(env.DB)}
function isSiteAdmin(email:string){return (env.RALLY_ADMIN_EMAILS??'').split(',').some(value=>value.trim().toLowerCase()===email.toLowerCase())}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})}
function error(e:unknown){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Rally data error',e);return response({error:'Your data is temporarily unavailable. Please try again.'},503)}
export async function GET(){try{const user=await getAuthenticatedUser();if(!user)return response({error:'Sign in to open the Rally clubhouse.'},401);const siteAdmin=isSiteAdmin(user.email);return response({...await service().read(user.id,{isSiteAdmin:siteAdmin}),account:{email:user.email,displayName:user.displayName,emailVerified:user.emailVerified},isSiteAdmin:siteAdmin})}catch(e){return error(e)}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return response({error:'Request origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'JSON required.'},415);
 const user=await getAuthenticatedUser();if(!user)return response({error:'Sign in to save changes.'},401);
 if(Number(request.headers.get('content-length')??0)>262144)return response({error:'Request too large.'},413);
 const raw=await request.text();if(raw.length>262144)return response({error:'Request too large.'},413);
 let body;try{body=JSON.parse(raw)}catch{return response({error:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Invalid request.'},400);
 if(body.action==='create_club'&&!user.emailVerified)return response({error:'Verify your email address before creating a club.'},403);
 return response(await service().act(user.id,body,{isSiteAdmin:isSiteAdmin(user.email),reviewerId:user.id}));
}catch(e){return error(e)}}
