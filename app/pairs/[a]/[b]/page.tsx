/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import ShareLinkButton from '@/app/share-link-button';
import {getPublicPair} from '@/lib/public-doubles';
import {shareMetadata} from '@/lib/share-meta';

export const dynamic='force-dynamic';
type Props={params:Promise<{a:string;b:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
async function pair(a:string,b:string){return env.DB?getPublicPair(env.DB,a,b):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {a,b}=await params,p=await pair(a,b);
 if(!p)return {title:'Pair not found · Rally'};
 return shareMetadata({title:`${p.names.join(' & ')} · Rally doubles pair`,description:`${p.names.join(' & ')} are ${p.wins}–${p.played-p.wins} together in confirmed doubles matches on Rally.`,path:`/pairs/${encodeURIComponent(p.ids[0])}/${encodeURIComponent(p.ids[1])}`,image:`/og/pair/${encodeURIComponent(p.ids[0])}/${encodeURIComponent(p.ids[1])}`});
}

export default async function PublicPairPage({params}:Props){
 const {a,b}=await params,p=await pair(a,b);if(!p)notFound();
 const pct=Math.round(p.wins/p.played*100);
 return <><PublicHeader/><main className="public-page"><div className="player-profile">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Doubles</span><span>/</span><span>{p.names.join(' & ')}</span></nav>
  <section className="public-hero"><div><p className="eyebrow">DOUBLES PAIR</p><h1>{p.names.join(' & ')}</h1><p>{p.wins}{'–'}{p.played-p.wins} together {'·'} {p.played} confirmed {p.played===1?'match':'matches'}</p></div></section>
  <section className="panel"><div className="profile-section-heading"><h2>Record together</h2><ShareLinkButton title={`${p.names.join(' & ')} on Rally`} label="Share this pair"/></div>
   <div className="public-stat-grid"><article><strong>{p.wins}{'–'}{p.played-p.wins}</strong><span>Wins and losses</span><small>{pct}% win rate</small></article>
    {p.ids.map((id,i)=><article key={id}><strong>{Math.round(p.ratings[id])}</strong><span><a href={`/players/${id}`}>{p.names[i]}</a></span><small>Doubles rating</small></article>)}</div>
  </section>
  <section className="panel"><div className="profile-section-heading"><h2>Recent matches</h2></div>
   <ul className="doubles-list">{p.recent.map(m=><li key={m.id} className={`doubles-row ${m.won?'status-confirmed':''}`}><div className="doubles-sides"><span className={m.won?'doubles-winner':''}>{m.won?'Won':'Lost'}</span><span className="versus">vs</span><span><a href={`/pairs/${m.opponentIds[0]}/${m.opponentIds[1]}`}>{m.opponents.join(' & ')}</a></span></div><div className="doubles-score"><strong>{m.score}</strong></div><div className="doubles-meta"><span>{dateLabel(m.playedOn)} {'·'} {m.clubName}</span> <a href={`/doubles/${m.id}`}>Result</a></div></li>)}</ul>
  </section>
  {p.opponents.length>0&&<section className="panel"><div className="profile-section-heading"><h2>Against other pairs</h2></div><ul className="doubles-partners">{p.opponents.map(o=><li key={o.ids.join('|')}><span><a href={`/pairs/${o.ids[0]}/${o.ids[1]}`}>{o.names.join(' & ')}</a></span><span>{o.wins}{'–'}{o.played-o.wins}</span></li>)}</ul></section>}
  <p className="public-note">Confirmed results from approved clubs. Doubles ratings are separate from singles and from USATT ratings. <a href="/ratings">How ratings work</a></p>
 </div></main></>;
}
