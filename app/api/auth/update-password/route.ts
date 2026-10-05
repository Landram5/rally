import {createAuthClient} from '@/lib/auth';
import {sameOrigin,validPassword} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Request origin not allowed.'},{status:403});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!validPassword(body.password))return Response.json({error:'Password must be 8 to 128 characters.'},{status:400});
 const client=await createAuthClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return Response.json({error:'Open the password reset link from your email again.'},{status:401});
 const {error}=await client.auth.updateUser({password:body.password});
 if(error)return Response.json({error:error.message},{status:400});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
