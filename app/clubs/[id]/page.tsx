import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import ClubPage from '@/app/club-page';
import {makeService} from '@/lib/rally-service';
import {shareMetadata} from '@/lib/share-meta';
import type {Data} from '@/app/rally-app';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params,path=`/clubs/${encodeURIComponent(id)}`;
 const club=env.DB?await env.DB.prepare("SELECT name,location,bio FROM clubs WHERE id=? AND approval_status='approved'").bind(id).first<{name:string;location:string;bio:string|null}>().catch(()=>null):null;
 if(!club)return {title:'Club · Rally',alternates:{canonical:path}};
 const about=club.bio?.replace(/\s+/g,' ').trim(),description=about?about.slice(0,160):`${club.name} in ${club.location}: members, sessions, results and tournaments on Rally.`;
 return shareMetadata({title:`${club.name} · Rally`,description,path,image:'/rally-share-v2.png'});
}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const all={...await makeService(env.DB).read(null,{clubId:id,compact:true}),account:null,isSiteAdmin:false} as unknown as Data;
 const memberships=all.memberships.filter(m=>m.club_id===id),matches=all.matches.filter(m=>m.club_id===id),tournaments=all.tournaments.filter(t=>t.club_id===id),eventIds=new Set(tournaments.map(t=>t.id)),entries=all.entries.filter(e=>eventIds.has(e.tournament_id));
 const playerIds=new Set([...memberships.map(m=>m.player_id),...matches.flatMap(m=>[m.a,m.b]),...entries.map(e=>e.player_id)]);
 const data={...all,clubs:all.clubs.filter(c=>c.id===id),memberships,matches,tournaments,entries,players:all.players.filter(p=>playerIds.has(p.id)),deletedPlayers:all.deletedPlayers?.filter(p=>playerIds.has(p.id))};
 return <ClubPage id={id} initialData={data}/>;
}
