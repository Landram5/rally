/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import ShareLinkButton from '@/app/share-link-button';
import {getPublicPairHeadToHead} from '@/lib/public-doubles';
import {shareMetadata} from '@/lib/share-meta';

export const dynamic='force-dynamic';
type Props={params:Promise<{a:string;b:string;c:string;d:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
async function h2h(p:{a:string;b:string;c:string;d:string}){return env.DB?getPublicPairHeadToHead(env.DB,[p.a,p.b],[p.c,p.d]):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const route=await params,h=await h2h(route);
 if(!h)return {title:'Pairs not found · Rally'};
 return shareMetadata({title:`${h.a.names.join(' & ')} vs ${h.b.names.join(' & ')} · Rally doubles`,description:`Head-to-head: ${h.a.wins}–${h.b.wins} in confirmed doubles matches.`,path:`/pairs/${route.a}/${route.b}/vs/${route.c}/${route.d}`,image:'/rally-share-v2.png'});
}

export default async function PairHeadToHeadPage({params}:Props){
 const route=await params,h=await h2h(route);if(!h)notFound();
 const A=h.a.names.join(' & '),B=h.b.names.join(' & ');
 return <><PublicHeader/><main className="public-page"><div className="player-profile">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Doubles</span><span>/</span><span>Head-to-head</span></nav>
  <section className="public-hero"><div><p className="eyebrow">DOUBLES HEAD-TO-HEAD</p><h1>{A} vs {B}</h1><p>{h.a.wins}{'–'}{h.b.wins} in confirmed matches</p></div></section>
  <section className="panel"><div className="profile-section-heading"><h2>Record</h2><ShareLinkButton title={`${A} vs ${B} on Rally`} label="Share this matchup"/></div>
   <div className="public-stat-grid"><article><strong>{h.a.wins}</strong><span><a href={`/pairs/${h.a.ids[0]}/${h.a.ids[1]}`}>{A}</a></span><small>Wins</small></article><article><strong>{h.b.wins}</strong><span><a href={`/pairs/${h.b.ids[0]}/${h.b.ids[1]}`}>{B}</a></span><small>Wins</small></article></div>
  </section>
  <section className="panel"><div className="profile-section-heading"><h2>Matches</h2></div>
   <ul className="doubles-list">{h.matches.map(m=><li key={m.id} className="doubles-row"><div className="doubles-sides"><span className={m.aWon?'doubles-winner':''}>{m.aWon?A:B} won</span></div><div className="doubles-score"><strong>{m.score}</strong><small>from {A}&rsquo;s side</small></div><div className="doubles-meta"><span>{dateLabel(m.playedOn)} {'·'} {m.clubName}</span> <a href={`/doubles/${m.id}`}>Result</a></div></li>)}</ul>
  </section>
  <p className="public-note">Confirmed results from approved clubs. Doubles ratings are separate from singles and from USATT ratings. <a href="/ratings">How ratings work</a></p>
 </div></main></>;
}
