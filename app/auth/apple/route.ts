import {createAuthClient} from '@/lib/auth';
import {safeNextPath} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),next=safeNextPath(url.searchParams.get('next'));
 const client=await createAuthClient();
 const {data,error}=await client.auth.signInWithOAuth({provider:'apple',options:{redirectTo:`${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,skipBrowserRedirect:true}});
 if(error||!data.url)return Response.redirect(`${url.origin}/login?error=${encodeURIComponent('Apple sign-in could not be started. Please try another sign-in option.')}`,303);
 return Response.redirect(data.url,303);
}
