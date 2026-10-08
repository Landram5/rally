import {createAuthClient} from '@/lib/auth';
import {sameOrigin} from '@/lib/auth-rules';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {pushCookie} from '@/lib/push-subscriptions';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Request origin not allowed.'},{status:403});
 const client=await createAuthClient();
 const {data}=await client.auth.getUser(),store=await cookies(),device=store.get(pushCookie)?.value;
 if(data.user&&device)await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=? AND player_id IN (SELECT id FROM profiles WHERE auth_id=?)').bind(device,data.user.id).run();
 store.delete(pushCookie);
 await client.auth.signOut();
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
