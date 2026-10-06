import {env} from 'cloudflare:workers';
import Link from 'next/link';
import PublicHeader from './public-header';
import PlayerAvatar from './player-avatar';
import {getPublicDirectory} from '@/lib/public-rally';
import {tally} from '@/lib/rally';

export const dynamic='force-dynamic';
type Params={view?:string;q?:string;page?:string};
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export default async function Home({searchParams}:{searchParams:Promise<Params>}){
 const params=await searchParams,view=params.view==='players'?'players':params.view==='matches'?'matches':'tournaments',search=(params.q??'').slice(0,80),page=Math.max(1,Math.min(1000,Number.parseInt(params.page??'1')||1));
 const data=env.DB?await getPublicDirectory(env.DB,view,search,page):null;
 const url=(nextView:string,nextPage=1)=>'/?'+new URLSearchParams({view:nextView,...(search?{q:search}:{}),...(nextPage>1?{page:String(nextPage)}:{})}).toString();
 const labels={tournaments:'Tournaments',players:'Players',matches:'Matches'};
 return <><PublicHeader/><main className="public-page public-directory">{!params.view&&!search&&page===1&&<section className="rally-intro"><div><p className="eyebrow">TABLE TENNIS CLUBS & COMPETITION</p><h1>Table tennis for clubs and players</h1><p>Rally brings club players, verified results and tournaments together. Record a match, follow your progress, or organize the next club event.</p><div className="intro-actions"><a className="primary-action" href="/login">Sign in / create an account</a><a className="intro-secondary" href="/demo">Try the sample demo</a><Link href="/clubs">Find a club</Link></div></div><div className="intro-features"><article><h2>Play & track</h2><p>Live point tracking, player profiles and opponent-weighted Rally ratings.</p></article><article><h2>Run club events</h2><p>Brackets, visiting-player registration, waitlists and club season ladders.</p></article><article><h2>Browse freely</h2><p>View public clubs, players, tournaments and verified matches without signing in.</p></article></div><p className="intro-install">Use Rally in your browser or <a href="/install">add it to your Home Screen</a>. Rally ratings are separate from USATT ratings.</p></section>}<div className="directory-heading"><div>{!params.view&&!search&&page===1?<h2>Public clubhouse</h2>:<h1>Public clubhouse</h1>}<p>Browse tournaments, players and verified matches.</p></div><a className="directory-member-link" href="/clubhouse">Member clubhouse</a></div>
  <nav className="directory-tabs" aria-label="Browse Rally">{(['tournaments','players','matches'] as const).map(v=><a key={v} href={url(v)} aria-current={v===view?'page':undefined}>{labels[v]}</a>)}</nav>
  <form className="directory-search" action="/"><input type="hidden" name="view" value={view}/><label htmlFor="public-search">Search {view}</label><div><input id="public-search" name="q" defaultValue={search} maxLength={80} placeholder={view==='tournaments'?'Tournament or club name':view==='players'?'Player name':'Player or club name'}/><button className="primary-action" type="submit">Search</button>{search&&<a href={'/?view='+view}>Clear</a>}</div></form>
  <section aria-label={labels[view]}><h2>{labels[view]}</h2>{!data?<p role="status">Public records are temporarily unavailable. Please try again.</p>:<>
   {view==='tournaments'&&<div className="directory-grid">{data.tournaments.map(t=><a className="directory-card" href={'/tournaments/'+t.id} key={t.id}><span className="badge">{t.status==='active'?'In progress':t.status==='completed'?'Completed':'Registration open'}</span><h3>{t.name}</h3><p>{t.clubName}</p><small>{dateLabel(t.date)} · {t.format} · {t.entrants} players</small><span className="directory-view">View tournament →</span></a>)}</div>}
   {view==='players'&&<div className="directory-grid">{data.players.map(p=><a className="directory-card directory-player" href={'/players/'+p.id} key={p.id}><PlayerAvatar name={p.name} photoUrl={p.photoUrl} publicProfile/><div><h3>{p.name}</h3><p>{p.played} verified {p.played===1?'match':'matches'}</p><span className="directory-view">View player →</span></div></a>)}</div>}
   {view==='matches'&&<div className="directory-matches">{data.matches.map(m=><article className="directory-card" key={m.id}><div className="directory-match-players"><a href={'/players/'+m.a}>{m.aName}</a><span>vs</span><a href={'/players/'+m.b}>{m.bName}</a></div><strong className="directory-score">{tally(m.games).join(' – ')}</strong><p>{m.games.map(g=>g.join('–')).join(' · ')}</p><small>{m.clubName} · {dateLabel(m.playedOn)} · Verified</small>{m.tournamentId&&<a className="directory-view" href={'/tournaments/'+m.tournamentId}>View tournament →</a>}</article>)}</div>}
   {!data[view].length&&<div className="directory-empty"><p>{search?'No '+view+' match your search.':'No public '+view+' yet.'}</p>{!search&&<a href="/demo">Explore the sample demo</a>}</div>}
   <nav className="directory-pagination" aria-label="Results pages">{page>1&&<a href={url(view,page-1)}>← Previous</a>}{(page>1||data.hasMore)&&<span>Page {page}</span>}{data.hasMore&&page<1000&&<a href={url(view,page+1)}>Next →</a>}</nav>
  </>}</section>
 </main></>;
}
