import {fixtureLabel} from '@/lib/fixture-label';
/* eslint-disable @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {CalendarDays,MapPin,Trophy,Users} from 'lucide-react';
import PublicHeader from '@/app/public-header';
import {TimeLabel} from '@/app/time-label';
import {registrationClosed} from '@/lib/logistics';
import BracketView from '@/app/bracket-view';
import {getPublicTournament} from '@/lib/public-rally';
import {outcome,standings,TIE_RULES} from '@/lib/tournament-engine';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
async function tournament(id:string){return env.DB?getPublicTournament(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const t=await tournament((await params).id);
 return t?{title:`${t.name} · Rally tournament`,description:`Follow the field, draw, and results for ${t.name} at ${t.club.name}.`}:{title:'Tournament not found · Rally'};
}

export default async function PublicTournamentPage({params}:Props){
 const t=await tournament((await params).id);if(!t)notFound();
 const names=new Map(t.entrants.map(p=>[p.id,p.name])),name=(id:string|null)=>id?names.get(id)??'Unknown player':'Awaiting player';
 const result=t.state?outcome(t.state):null;
 const closed=registrationClosed({status:t.status,registration_closes_at:t.registrationClosesAt});
 const status=t.status==='registration'?'Registration open':t.status==='active'?'In progress':'Completed';
 return <><PublicHeader/><main className="public-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Tournaments</span><span>/</span><span>{t.name}</span></nav>
  <section className="public-event-hero"><div><span className="badge">{status}</span><p className="eyebrow">PUBLIC TOURNAMENT PAGE</p><h1>{t.name}</h1><p><a href={`/clubs/${t.club.id}`}>{t.club.name}</a></p></div>{result?.winners.length?<div className="public-winner"><Trophy size={26}/><span>Winner{result.winners.length>1?'s':''}</span><strong>{result.winners.map(name).join(' & ')}</strong></div>:null}</section>
  <div className="event-facts"><span><CalendarDays size={18}/><b>{dateLabel(t.date)}</b></span><span><MapPin size={18}/><b>{t.club.location}</b></span><span><Users size={18}/><b>{t.entrants.length} / {t.capacity} players</b></span><span><Trophy size={18}/><b>{t.format}{t.state?` · Best of ${t.state.bestOf}`:''}</b></span></div>
  {(t.startsAt||t.registrationClosesAt)&&<section className="registration-callout panel"><h2>Event times</h2>{t.startsAt&&<p>Starts <TimeLabel value={t.startsAt}/></p>}{t.registrationClosesAt&&<p>Registration closes <TimeLabel value={t.registrationClosesAt}/></p>}</section>}{t.fixturePlans?.some(p=>p.court||p.starts_at)&&<section className="registration-callout panel"><h2>Match schedule</h2>{t.fixturePlans.map(p=>{const f=t.state?.fixtures.find(f=>f.id===p.fixture_id);return f&&(p.court||p.starts_at)?<p key={p.fixture_id}><b>{fixtureLabel(f,t.format)}: {name(f.a)} vs {name(f.b)}</b> · {p.court}{p.starts_at&&<> · <TimeLabel value={p.starts_at}/></>}</p>:null})}</section>}
  {t.status==='registration'&&<section className="registration-callout panel"><h2>{closed?'Registration is closed':t.entrants.length>=t.capacity?'Registration is full':'Registration is open'}</h2><p>Active members of {t.club.name} can enter before the deadline or before the organizer starts the draw.</p><a className="primary-action registration-link" href={`/clubhouse?tab=tournaments&event=${t.id}`}>Manage registration / view my entry</a><a href={`/clubs/${t.club.id}`}>View club and membership</a></section>}
  {t.state?<section className="public-draw panel"><div className="panel-heading"><div><h2>{t.format==='Round robin'?'Standings and matches':'Tournament bracket'}</h2><p>The draw updates as official results are recorded.</p></div></div>{t.format==='Round robin'?<><div className="standings-wrap"><Table><TableHeader><TableRow><TableHead>Place</TableHead><TableHead>Player</TableHead><TableHead>W–L</TableHead><TableHead>Games</TableHead><TableHead>Point diff.</TableHead></TableRow></TableHeader><TableBody>{standings(t.state).map(r=><TableRow key={r.id}><TableCell>{r.withdrawn?'—':r.rank}</TableCell><TableCell><a href={`/players/${r.id}`}>{name(r.id)}</a>{r.withdrawn&&<small className="withdrawn-label">Withdrawn</small>}</TableCell><TableCell>{r.wins}–{r.losses}</TableCell><TableCell>{r.gamesFor}–{r.gamesAgainst}</TableCell><TableCell>{r.pointsFor-r.pointsAgainst}</TableCell></TableRow>)}</TableBody></Table><p className="footnote">{TIE_RULES}</p></div><div className="round-robin-grid public-fixtures">{t.state.fixtures.map(f=><article className={`bracket-match fixture-${f.status}`} key={f.id}><div className="fixture-label"><span>Match {f.slot+1}</span><span>{f.status==='played'?'Final':f.status==='forfeit'?'Forfeit':f.status==='ready'?'Ready':'Waiting'}</span></div>{[f.a,f.b].map((id,i)=><div className={`bracket-player ${id&&f.winner===id?'bracket-winner':''}`} key={i}><span>{id?<a href={`/players/${id}`}>{name(id)}</a>:'—'}</span><b>{f.status==='played'?f.games.filter(g=>g[i]>g[1-i]).length:id&&f.winner===id?'✓':''}</b></div>)}{f.games.length>0&&<p className="fixture-games">{f.games.map(g=>g.join('–')).join(' · ')}</p>}</article>)}</div></>:<BracketView draw={t.state} name={name}/>}</section>:<section className="panel public-registration"><div className="panel-heading"><div><h2>Registered players</h2><p>The organizer has not locked the draw yet.</p></div></div><div className="public-entrants">{t.entrants.map((p,i)=><a href={`/players/${p.id}`} key={p.id}><span>{i+1}</span><strong>{p.name}</strong>{p.isGuest&&<small>Guest</small>}</a>)}</div>{!t.entrants.length&&<p className="empty">No players are registered yet.</p>}</section>}
  <section className="public-event-bottom"><div><h2>Players</h2><div className="public-player-links">{t.entrants.map((p,i)=><a href={`/players/${p.id}`} key={p.id}><span>{i+1}</span>{p.name}</a>)}</div></div><aside className="rules-box"><h3>Competition rules</h3><p>{t.state?`Best of ${t.state.bestOf}. Games to 11, win by two.`:'Match format will be confirmed when the draw is locked.'}</p><p>{t.format==='Round robin'?TIE_RULES:t.format==='Double elimination'?'Two losses eliminate a player. The unbeaten finalist must be defeated twice, so a bracket-reset final is played only when needed.':'Single elimination with fixed seeds and automatic byes. Winners advance without reseeding.'}</p>{t.state?.thirdPlace&&<p>The two semifinal losers play an official third-place playoff.</p>}</aside></section>
 </main></>;
}
