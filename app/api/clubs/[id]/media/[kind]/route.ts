import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;kind:string}>}){
 const {id,kind}=await params,headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!env.DB||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!['photo','banner'].includes(kind))return new Response(null,{status:404,headers});
 const club=await env.DB.prepare('SELECT approval_status FROM clubs WHERE id=?').bind(id).first<{approval_status:string}>();
 if(!club)return new Response(null,{status:404,headers});
 if(club.approval_status!=='approved'){
  const user=await getAuthenticatedUser();if(!user)return new Response(null,{status:404,headers});
  const siteAdmin=(env.RALLY_ADMIN_EMAILS??'').split(',').some(email=>email.trim().toLowerCase()===user.email.toLowerCase());
  const membership=await env.DB.prepare("SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND p.auth_id=? AND m.status='active'").bind(id,user.id).first();
  if(!siteAdmin&&!membership)return new Response(null,{status:404,headers});
 }
 const photo=await env.DB.prepare('SELECT image_data FROM club_media WHERE club_id=? AND kind=?').bind(id,kind).first<{image_data:string}>();
 if(!photo)return new Response(null,{status:404,headers});
 return new Response(Uint8Array.from(atob(photo.image_data.slice(23)),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'image/jpeg'}});
}
