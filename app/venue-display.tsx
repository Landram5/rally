'use client';
import BracketView from './bracket-view';
const clock=(value:string)=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
import VenueControls from './venue-controls';
import {standings} from '@/lib/tournament-engine';
import {venueBoard,type VenueItem} from '@/lib/venue-board';
import type {PublicTournament} from '@/lib/public-rally';
function MatchCard({m,upcoming=false}:{m:VenueItem;upcoming?:boolean}){
 return <li className="venue-match"><div className="venue-court">{m.court||'Table TBA'}</div><div className="venue-players"><strong>{m.a}</strong><span>vs</span><strong>{m.b}</strong></div><div className="venue-detail"><span>{m.label}</span>{upcoming&&m.startsAt&&<span suppressHydrationWarning>{clock(m.startsAt)}</span>}</div></li>;
}
// Full-screen tournament board for a TV or projector. Presentational so the live page and the demo share it.
export default function VenueDisplay({t,exitHref}:{t:PublicTournament;exitHref:string}){
 const board=venueBoard(t),names=new Map(t.entrants.map(p=>[p.id,p.name])),name=(id:string|null)=>id?names.get(id)??'Unknown player':'To be decided';
 const status=t.status==='registration'?'Registration open':t.status==='active'?'In progress':'Completed',robin=t.format==='Round robin';
 return <div className="venue-display">
  <header className="venue-header"><div><p className="venue-eyebrow">{t.club.name}</p><h1>{t.name}</h1></div><div className="venue-meta"><span className="venue-status">{status}</span><VenueControls/></div></header>
  {t.status==='completed'&&board.winners.length>0&&<div className="venue-champion"><span>Champion{board.winners.length>1?'s':''}</span><strong>{board.winners.join(' & ')}</strong></div>}
  {!t.state?<section className="venue-panel"><h2>Registered players ({t.entrants.length} / {t.capacity})</h2>{t.entrants.length?<ol className="venue-roster">{t.entrants.map(p=><li key={p.id}>{p.name}</li>)}</ol>:<p className="venue-empty">No players are registered yet.</p>}<p className="venue-empty">The draw appears here when the organizer starts the tournament.</p></section>:
  <div className="venue-grid">
   <section className="venue-panel venue-now"><h2>Now playing</h2>{board.nowPlaying.length?<ul>{board.nowPlaying.map(m=><MatchCard key={m.id} m={m}/>)}</ul>:<p className="venue-empty">{t.status==='completed'?'The tournament is complete.':'No matches have been called yet.'}</p>}</section>
   <section className="venue-panel venue-next"><h2>Up next</h2>{board.upNext.length?<ul>{board.upNext.slice(0,8).map(m=><MatchCard key={m.id} m={m} upcoming/>)}</ul>:<p className="venue-empty">{t.status==='completed'?'All matches are finished.':'No matches are waiting.'}</p>}{board.upNext.length>8&&<p className="venue-empty">+ {board.upNext.length-8} more ready</p>}</section>
   <section className="venue-panel venue-draw"><h2>{robin?'Standings':'Draw'}</h2>{robin?<table className="venue-standings"><thead><tr><th>#</th><th>Player</th><th>W{'\u2013'}L</th></tr></thead><tbody>{standings(t.state).map(r=><tr key={r.id}><td>{r.withdrawn?'\u2014':r.rank}</td><td>{name(r.id)}</td><td>{r.wins}{'\u2013'}{r.losses}</td></tr>)}</tbody></table>:<div className="venue-bracket"><BracketView draw={t.state} name={name}/></div>}</section>
   <section className="venue-panel venue-recent"><h2>Latest results</h2>{board.recent.length?<ul>{board.recent.map(m=><li className="venue-result" key={m.id}><span><strong>{m.winner??'\u2014'}</strong> {m.score==='Forfeit'?'won by forfeit':`won ${m.score}`}</span><small>{m.a} vs {m.b}</small></li>)}</ul>:<p className="venue-empty">No results yet.</p>}</section>
  </div>}
  <footer className="venue-footer"><span>Updates automatically every 10 seconds</span><span><a href={exitHref}>Exit display</a> {'\u00b7'} rallytt.net</span></footer>
 </div>;
}
