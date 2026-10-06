import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!env.DB)return new Response(null,{status:404,headers});
 const photo=await env.DB.prepare('SELECT ph.image_data FROM profile_photos ph JOIN profiles p ON p.id=ph.player_id WHERE p.id=? AND p.deleted_at IS NULL').bind(id).first<{image_data:string}>();
 if(!photo)return new Response(null,{status:404,headers});
 const bytes=Uint8Array.from(atob(photo.image_data.slice(23)),c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{...headers,'Content-Type':'image/jpeg'}});
}
