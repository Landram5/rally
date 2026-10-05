import {createAuthClient} from '@/lib/auth';
import {sameOrigin} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Request origin not allowed.'},{status:403});
 const client=await createAuthClient();
 await client.auth.signOut();
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
