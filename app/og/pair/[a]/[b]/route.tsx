import {ImageResponse} from 'next/og';
import {env} from 'cloudflare:workers';
import {getPublicPair} from '@/lib/public-doubles';
import {OgCard,OG_SIZE,OG_HEADERS} from '@/lib/og-card';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{a:string;b:string}>}){
 const {a,b}=await params,p=env.DB?await getPublicPair(env.DB,a,b):null;
 if(!p)return new Response('Not found',{status:404});
 return new ImageResponse(<OgCard eyebrow="DOUBLES PAIR" title={p.names.join(' & ')} subtitle={`${p.played} confirmed ${p.played===1?'match':'matches'} together`} stats={[{value:`${p.wins}–${p.played-p.wins}`,label:'Record together'},{value:`${Math.round(p.wins/p.played*100)}%`,label:'Win rate'},{value:String(Math.round((p.ratings[p.ids[0]]+p.ratings[p.ids[1]])/2)),label:'Average rating'}]}/>,{...OG_SIZE,headers:OG_HEADERS});
}
