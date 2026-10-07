import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {clubExport} from '@/lib/club-export';
import {AppError} from '@/lib/rally-errors';
import {rateLimit} from '@/lib/write-limits';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
 try{
  const user=await getAuthenticatedUser();if(!user)return Response.json({error:'Sign in to export club data.'},{status:401,headers});
  const limited=await rateLimit(env.USER_WRITE_LIMITER,user.id);if(limited)return limited;
  const {id}=await params,kind=new URL(request.url).searchParams.get('kind')??'',content=await clubExport(env.DB,user.id,id,kind);
  return new Response(content,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="rally-${id}-${kind}.csv"`}});
 }catch(error){return Response.json({error:error instanceof AppError?error.message:'Export unavailable. Try again shortly.'},{status:error instanceof AppError?error.status:503,headers});}
}
