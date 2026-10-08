import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import {getPublicPlayer} from '@/lib/public-rally';
import PlayerProfile from '@/app/player-profile';
import {shareMetadata} from '@/lib/share-meta';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
async function player(id:string){return env.DB?getPublicPlayer(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const p=await player((await params).id);
 return p?shareMetadata({title:`${p.name} \u00b7 Rally player`,description:p.rating?`${p.name}: Rally rating ${p.rating.value}, ${p.matches.length} verified ${p.matches.length===1?'match':'matches'}.`:`Confirmed table tennis results and statistics for ${p.name}.`,path:`/players/${encodeURIComponent(p.id)}`,image:`/og/player/${encodeURIComponent(p.id)}`}):{title:'Player not found \u00b7 Rally'};
}

export default async function PublicPlayerPage({params}:Props){
 const p=await player((await params).id);if(!p)notFound();
 return <><PublicHeader/><main className="public-page"><PlayerProfile player={p}/></main></>;
}
