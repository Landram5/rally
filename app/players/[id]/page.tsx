import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import {getPublicPlayer} from '@/lib/public-rally';
import PlayerProfile from '@/app/player-profile';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
async function player(id:string){return env.DB?getPublicPlayer(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const p=await player((await params).id);
 return p?{title:`${p.name} · Rally player`,description:`Confirmed table tennis results and statistics for ${p.name}.`}:{title:'Player not found · Rally'};
}

export default async function PublicPlayerPage({params}:Props){
 const p=await player((await params).id);if(!p)notFound();
 return <><PublicHeader/><main className="public-page"><PlayerProfile player={p}/></main></>;
}
