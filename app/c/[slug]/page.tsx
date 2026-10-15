import {env} from 'cloudflare:workers';
import {notFound,redirect} from 'next/navigation';
import {resolveSlug} from '@/lib/club-slugs';
export const dynamic='force-dynamic';
// rallytt.net/c/<name> is the short address of a club (current or an older one it used before).
export default async function ClubShortLink({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,hit=env.DB?await resolveSlug(env.DB,decodeURIComponent(slug)).catch(()=>null):null;
 if(!hit||hit.status==='rejected')notFound();
 redirect(`/clubs/${encodeURIComponent(hit.clubId)}`);
}
