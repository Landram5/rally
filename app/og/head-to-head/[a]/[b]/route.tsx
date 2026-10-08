import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicHeadToHead} from '@/lib/public-rally';
import {headToHeadSummary} from '@/lib/head-to-head';
import {OgCard,OG_SIZE,OG_HEADERS} from '@/lib/og-card';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{a:string;b:string}>}){
 const {a,b}=await params,h=env.DB?await getPublicHeadToHead(env.DB,a,b):null;
 if(!h)return new Response('Not found',{status:404});
 const s=headToHeadSummary(h.meetings),lead=s.aWins===s.bWins?'Tied':`${s.aWins>s.bWins?h.a.name:h.b.name} leads`;
 return new ImageResponse(<OgCard eyebrow="HEAD-TO-HEAD" title={`${h.a.name} vs ${h.b.name}`} subtitle={s.played?lead:'No confirmed meetings yet'} stats={s.played?[{value:`${s.aWins}\u2013${s.bWins}`,label:'Match record'},{value:`${s.aGames}\u2013${s.bGames}`,label:'Games'},{value:String(s.played),label:s.played===1?'Meeting':'Meetings'}]:[]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
