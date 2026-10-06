import {getAuthenticatedUser} from '@/lib/auth';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';
export async function GET(){
 const user=await getAuthenticatedUser();
 const profile=user?await env.DB.prepare('SELECT id,name FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string;name:string}>():null;
 return Response.json({user:user?{displayName:profile?.name??user.displayName,profileId:profile?.id??null}:null},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
}
