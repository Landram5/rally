import {type EmailOtpType} from '@supabase/supabase-js';
import {createAuthClient} from '@/lib/auth';
import {safeNextPath} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
const allowed=new Set<EmailOtpType>(['signup','invite','magiclink','recovery','email_change','email']);

export async function GET(request:Request){
 const url=new URL(request.url),token_hash=url.searchParams.get('token_hash'),rawType=url.searchParams.get('type'),next=safeNextPath(url.searchParams.get('next'));
 if(!token_hash||!rawType||!allowed.has(rawType as EmailOtpType))return Response.redirect(`${url.origin}/login?error=${encodeURIComponent('The confirmation link is invalid or expired.')}`,303);
 const client=await createAuthClient(),{error}=await client.auth.verifyOtp({token_hash,type:rawType as EmailOtpType});
 if(error)return Response.redirect(`${url.origin}/login?error=${encodeURIComponent('The confirmation link is invalid or expired.')}`,303);
 return Response.redirect(`${url.origin}${rawType==='recovery'?'/account/update-password':next}`,303);
}
