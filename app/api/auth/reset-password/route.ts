import {createAuthClient} from '@/lib/auth';
import {sameOrigin,validEmail} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Request origin not allowed.'},{status:403});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!validEmail(email))return Response.json({error:'Enter a valid email address.'},{status:400});
 const client=await createAuthClient();
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent('/account/update-password')}`});
 if(error)return Response.json({error:'Password reset is temporarily unavailable.'},{status:503});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
