import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicTournament} from '@/lib/public-rally';
import {outcome} from '@/lib/tournament-engine';
import {OgCard,OG_SIZE,OG_HEADERS} from '@/lib/og-card';
export const dynamic='force-dynamic';
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const t=env.DB?await getPublicTournament(env.DB,(await params).id):null;
 if(!t)return new Response('Not found',{status:404});
 const names=new Map(t.entrants.map(p=>[p.id,p.name])),winners=t.state?outcome(t.state).winners.map(id=>names.get(id)??'Player'):[];
 const status=t.status==='registration'?'Registration open':t.status==='active'?'In progress':'Completed';
 return new ImageResponse(<OgCard eyebrow="TOURNAMENT" title={t.name} subtitle={winners.length?`Winner: ${winners.join(' & ')}`:`${t.club.name} \u00b7 ${dateLabel(t.date)}`} stats={[{value:String(t.entrants.length),label:t.entrants.length===1?'Player':'Players'},{value:t.format.replace(' elimination',' elim.'),label:'Format'},{value:status,label:t.club.name}]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
