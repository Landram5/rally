/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import ShareLinkButton from '@/app/share-link-button';
import {RatingDelta} from '@/app/rating-delta';
import {getPublicMatch} from '@/lib/public-rally';
import {shareMetadata} from '@/lib/share-meta';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
async function match(id:string){return env.DB?getPublicMatch(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {id}=await params,m=await match(id);
 if(!m)return {title:'Result not found \u00b7 Rally'};
 const aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,winner=aGames>bGames?m.a.name:m.b.name;
 return shareMetadata({title:`${m.a.name} vs ${m.b.name} \u00b7 Rally result`,description:`${winner} won ${Math.max(aGames,bGames)}\u2013${Math.min(aGames,bGames)} at ${m.clubName} on ${dateLabel(m.playedOn)}.`,path:`/matches/${encodeURIComponent(m.id)}`,image:`/og/match/${encodeURIComponent(m.id)}`});
}

export default async function PublicMatchPage({params}:Props){
 const m=await match((await params).id);if(!m)notFound();
 const aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,aWon=aGames>bGames;
 return <><PublicHeader/><main className="public-page"><div className="player-profile">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Matches</span><span>/</span><span>{m.a.name} vs {m.b.name}</span></nav>
  <section className="public-hero"><div><p className="eyebrow">MATCH RESULT</p><h1>{m.a.name} vs {m.b.name}</h1><p>{aWon?m.a.name:m.b.name} won {Math.max(aGames,bGames)}{'\u2013'}{Math.min(aGames,bGames)} {'\u00b7'} {dateLabel(m.playedOn)}</p></div></section>
  <section className="panel"><div className="profile-section-heading"><h2>Score</h2><ShareLinkButton title={`${m.a.name} vs ${m.b.name} on Rally`} label="Share this result"/></div>
   <div className="public-stat-grid"><article><strong>{aGames}{'\u2013'}{bGames}</strong><span>Games</span><small>{m.games.map(g=>`${g[0]}\u2013${g[1]}`).join(' \u00b7 ')}</small></article><article><strong><RatingDelta value={m.changes.a}/>{m.changes.a===undefined&&'\u2014'}</strong><span>{m.a.name}</span><small>Rating change</small></article><article><strong><RatingDelta value={m.changes.b}/>{m.changes.b===undefined&&'\u2014'}</strong><span>{m.b.name}</span><small>Rating change</small></article></div>
   <p className="footnote">{m.clubName}{m.tournament&&<> {'\u00b7'} <a href={`/tournaments/${m.tournament.id}`}>{m.tournament.name}</a></>} {'\u00b7'} Best of {m.bestOf}</p>
   <p className="public-note"><a href={`/players/${m.a.id}`}>{m.a.name}</a> {'\u00b7'} <a href={`/players/${m.b.id}`}>{m.b.name}</a> {'\u00b7'} <a href={`/head-to-head/${m.a.id}/${m.b.id}`}>Head-to-head</a></p>
  </section>
  <p className="public-note">Confirmed result from an approved club. Rating changes use Rally&rsquo;s model and are separate from USATT ratings. <a href="/ratings">How ratings work</a></p>
 </div></main></>;
}
