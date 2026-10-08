/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import ShareLinkButton from '@/app/share-link-button';
import {RatingDelta} from '@/app/rating-delta';
import {getPublicDoublesMatch} from '@/lib/public-doubles';
import {shareMetadata} from '@/lib/share-meta';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
async function match(id:string){return env.DB?getPublicDoublesMatch(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {id}=await params,m=await match(id);
 if(!m)return {title:'Result not found · Rally'};
 const a=m.sides[0].names.join(' & '),b=m.sides[1].names.join(' & '),aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,winner=aGames>bGames?a:b;
 return shareMetadata({title:`${a} vs ${b} · Rally doubles result`,description:`${winner} won ${Math.max(aGames,bGames)}–${Math.min(aGames,bGames)} at ${m.clubName} on ${dateLabel(m.playedOn)}.`,path:`/doubles/${encodeURIComponent(m.id)}`,image:`/og/doubles/${encodeURIComponent(m.id)}`});
}

export default async function PublicDoublesMatchPage({params}:Props){
 const m=await match((await params).id);if(!m)notFound();
 const a=m.sides[0].names.join(' & '),b=m.sides[1].names.join(' & '),aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,aWon=aGames>bGames;
 return <><PublicHeader/><main className="public-page"><div className="player-profile">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Doubles</span><span>/</span><span>{a} vs {b}</span></nav>
  <section className="public-hero"><div><p className="eyebrow">DOUBLES RESULT</p><h1>{a} vs {b}</h1><p>{aWon?a:b} won {Math.max(aGames,bGames)}{'–'}{Math.min(aGames,bGames)} {'·'} {dateLabel(m.playedOn)}</p></div></section>
  <section className="panel"><div className="profile-section-heading"><h2>Score</h2><ShareLinkButton title={`${a} vs ${b} on Rally`} label="Share this result"/></div>
   <div className="public-stat-grid"><article><strong>{aGames}{'–'}{bGames}</strong><span>Games</span><small>{m.games.map(g=>`${g[0]}–${g[1]}`).join(' · ')}</small></article>
    {m.sides.map(s=><article key={s.ids.join('|')}><strong>{s.ids.map(id=>m.changes[id]).every(v=>v===undefined)?'—':<RatingDelta value={m.changes[s.ids[0]]}/>}</strong><span>{s.names.join(' & ')}</span><small>Doubles rating change</small></article>)}</div>
   <p className="footnote">{m.clubName}{m.tournament&&<> {'·'} <a href={`/tournaments/${m.tournament.id}`}>{m.tournament.name}</a></>} {'·'} Best of {m.bestOf}</p>
   <p className="public-note">Pairs: {m.sides.map((s,i)=><span key={i}>{i>0&&' · '}<a href={`/pairs/${s.ids[0]}/${s.ids[1]}`}>{s.names.join(' & ')}</a></span>)}</p>
   <p className="public-note">Players: {m.sides.flatMap(s=>s.ids.map((id,i)=>[id,s.names[i]] as const)).map(([id,name],i)=><span key={id}>{i>0&&' · '}<a href={`/players/${id}`}>{name}</a></span>)}</p>
  </section>
  <p className="public-note">Confirmed result from an approved club. Doubles ratings are separate from singles and from USATT ratings. <a href="/ratings">How ratings work</a></p>
 </div></main></>;
}
