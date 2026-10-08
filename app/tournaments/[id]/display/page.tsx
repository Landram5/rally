import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import VenueDisplay from '@/app/venue-display';
import {getPublicTournament} from '@/lib/public-rally';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const t=env.DB?await getPublicTournament(env.DB,(await params).id):null;
 return {title:t?`${t.name} \u00b7 Venue display`:'Tournament not found \u00b7 Rally',robots:{index:false}};
}
export default async function VenueDisplayPage({params}:Props){
 const {id}=await params,t=env.DB?await getPublicTournament(env.DB,id):null;if(!t)notFound();
 return <VenueDisplay t={t} exitHref={`/tournaments/${encodeURIComponent(t.id)}`}/>;
}
