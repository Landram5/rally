import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicMatch} from '@/lib/public-rally';
import {OgCard,OG_SIZE,OG_HEADERS,signedDelta} from '@/lib/og-card';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const m=env.DB?await getPublicMatch(env.DB,(await params).id):null;
 if(!m)return new Response('Not found',{status:404});
 const aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,first=(n:string)=>n.split(' ')[0];
 return new ImageResponse(<OgCard eyebrow="MATCH RESULT" title={`${m.a.name} vs ${m.b.name}`} subtitle={`${m.games.map(g=>`${g[0]}\u2013${g[1]}`).join('  \u00b7  ')}`} stats={[{value:`${aGames}\u2013${bGames}`,label:'Games'},{value:signedDelta(m.changes.a),label:`${first(m.a.name)} rating`},{value:signedDelta(m.changes.b),label:`${first(m.b.name)} rating`}]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
