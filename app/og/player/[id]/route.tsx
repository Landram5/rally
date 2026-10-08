import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicPlayer} from '@/lib/public-rally';
import {OgCard,OG_SIZE,OG_HEADERS} from '@/lib/og-card';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const p=env.DB?await getPublicPlayer(env.DB,(await params).id):null;
 if(!p)return new Response('Not found',{status:404});
 const wins=p.matches.filter(m=>m.games.filter(g=>g[m.playerSide]>g[1-m.playerSide]).length>m.games.length/2).length,losses=p.matches.length-wins;
 const stats=[{value:p.rating?String(p.rating.value):'\u2014',label:p.rating?(p.rating.established?'Rally rating':'Rally rating \u00b7 provisional'):'Rally rating'},{value:`${wins}\u2013${losses}`,label:'Match record'},{value:String(p.matches.length),label:p.matches.length===1?'Verified match':'Verified matches'}];
 if(p.highlights&&p.highlights.longestWinStreak>=3)stats.push({value:String(p.highlights.longestWinStreak),label:'Best win streak'});
 return new ImageResponse(<OgCard eyebrow="PLAYER" title={p.name} subtitle={p.clubs.map(c=>c.name).join(' \u00b7 ')||'Rally player'} stats={stats}/>,{...OG_SIZE,headers:OG_HEADERS});
}
