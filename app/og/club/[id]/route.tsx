import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {OgCard,OG_SIZE,OG_HEADERS} from '@/lib/og-card';
export const dynamic='force-dynamic';
// Share image for a club (link previews in chats and social posts). Shows only what the club page already shows publicly.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const id=(await params).id;
 const club=env.DB&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)?await env.DB.prepare("SELECT c.name,c.location,(SELECT count(*) FROM memberships m JOIN profiles p ON p.id=m.player_id AND p.deleted_at IS NULL WHERE m.club_id=c.id AND m.status='active') AS members,(SELECT count(*) FROM matches x WHERE x.club_id=c.id AND x.status='confirmed') AS matches,(SELECT count(*) FROM tournaments t WHERE t.club_id=c.id AND t.deleted_at IS NULL) AS events FROM clubs c WHERE c.id=? AND c.approval_status IN ('approved','pending')").bind(id).first<{name:string;location:string;members:number;matches:number;events:number}>().catch(()=>null):null;
 if(!club)return new Response('Not found',{status:404});
 const invite=new URL(request.url).searchParams.get('invite')==='1';
 return new ImageResponse(<OgCard eyebrow={invite?'YOU ARE INVITED':'CLUB'} title={club.name} subtitle={club.location} stats={[{value:String(club.members),label:club.members===1?'Member':'Members'},{value:String(club.matches),label:'Verified matches'},{value:String(club.events),label:club.events===1?'Tournament':'Tournaments'}]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
