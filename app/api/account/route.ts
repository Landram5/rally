import {env} from 'cloudflare:workers';
import {createAuthClient} from '@/lib/auth';
import {createAuthAdmin} from '@/lib/auth-admin';
import {accountHandlers} from '@/lib/account-http';
import {rateLimit} from '@/lib/write-limits';

export const dynamic='force-dynamic';
const handlers=()=>accountHandlers({
 db:env.DB,
 limit:userId=>rateLimit(env.USER_WRITE_LIMITER,userId),
 configured:()=>!!env.SUPABASE_URL?.trim()&&!!env.SUPABASE_SECRET_KEY?.trim(),
 admin:()=>createAuthAdmin(env).auth.admin,
 session:async()=>{
  const client=await createAuthClient();
  const {data,error}=await client.auth.getUser();
  return {user:error?null:data.user,signOut:()=>client.auth.signOut({scope:'global'})};
 },
});
export async function GET(){return handlers().GET()}
export async function POST(request:Request){return handlers().POST(request)}
