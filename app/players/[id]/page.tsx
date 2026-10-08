/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import {getPublicPlayer} from '@/lib/public-rally';
import {getPublicDoublesPlayer} from '@/lib/public-doubles';
import {ESTABLISHED_MATCHES} from '@/lib/seeding';
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
 const doubles=env.DB?await getPublicDoublesPlayer(env.DB,p.id).catch(()=>null):null;
 return <><PublicHeader/><main className="public-page"><PlayerProfile player={p}/>{doubles&&<section className="panel public-doubles" aria-label="Doubles"><div className="profile-section-heading"><h2>Doubles</h2><a href="/doubles">Doubles leaderboard</a></div><div className="rating-summary"><strong>{Math.round(doubles.rating)}</strong><span>{doubles.established?`Established \u00b7 ${doubles.played} matches`:`Provisional \u00b7 ${doubles.played}/${ESTABLISHED_MATCHES} matches`}</span><span>{doubles.wins}{'\u2013'}{doubles.played-doubles.wins}</span></div>{doubles.partners.length>0&&<ul className="doubles-partners">{doubles.partners.map(x=><li key={x.id}><span><a href={`/pairs/${p.id}/${x.id}`}>{p.name} &amp; {x.name}</a></span><span>{x.wins}{'\u2013'}{x.played-x.wins}</span></li>)}</ul>}<p className="public-note">Doubles ratings are separate from the singles rating.</p></section>}</main></>;
}
