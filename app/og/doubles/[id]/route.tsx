import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicDoublesMatch} from '@/lib/public-doubles';
import {OgCard,OG_SIZE,OG_HEADERS,signedDelta} from '@/lib/og-card';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const m=env.DB?await getPublicDoublesMatch(env.DB,(await params).id):null;
 if(!m)return new Response('Not found',{status:404});
 const aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,first=(names:string[])=>names.map(n=>n.split(' ')[0]).join(' & ');
 return new ImageResponse(<OgCard eyebrow="DOUBLES RESULT" title={`${m.sides[0].names.join(' & ')} vs ${m.sides[1].names.join(' & ')}`} subtitle={m.games.map(g=>`${g[0]}–${g[1]}`).join('  ·  ')} stats={[{value:`${aGames}–${bGames}`,label:'Games'},{value:signedDelta(m.changes[m.sides[0].ids[0]]),label:`${first(m.sides[0].names)} rating`},{value:signedDelta(m.changes[m.sides[1].ids[0]]),label:`${first(m.sides[1].names)} rating`}]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
