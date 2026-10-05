import {createAuthClient} from '@/lib/auth';
import {safeNextPath} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code'),next=safeNextPath(url.searchParams.get('next'));
 if(!code)return Response.redirect(`${url.origin}/login?error=${encodeURIComponent('The sign-in link is invalid or expired.')}`,303);
 const client=await createAuthClient(),{error}=await client.auth.exchangeCodeForSession(code);
 if(error)return Response.redirect(`${url.origin}/login?error=${encodeURIComponent('The sign-in link is invalid or expired.')}`,303);
 return Response.redirect(`${url.origin}${next}`,303);
}
