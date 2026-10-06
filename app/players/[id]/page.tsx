/* eslint-disable react-hooks/immutability, @next/next/no-html-link-for-pages */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {CircleDot,Trophy,Users} from 'lucide-react';
import PublicHeader from '@/app/public-header';
import PlayerAvatar from '@/app/player-avatar';
import {getPublicPlayer} from '@/lib/public-rally';
import {tally} from '@/lib/rally';
import PlayerPerformance from '@/app/player-performance';

export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
async function player(id:string){return env.DB?getPublicPlayer(env.DB,id):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const p=await player((await params).id);
 return p?{title:`${p.name} · Rally player`,description:`Confirmed table tennis results and statistics for ${p.name}.`}:{title:'Player not found · Rally'};
}

export default async function PublicPlayerPage({params}:Props){
 const p=await player((await params).id);if(!p)notFound();
 let wins=0,gamesWon=0,gamesLost=0,pointsWon=0,pointsLost=0;
 const results=p.matches.map(m=>{const score=tally(m.games),won=score[m.playerSide]>score[1-m.playerSide];if(won)wins++;gamesWon+=score[m.playerSide];gamesLost+=score[1-m.playerSide];for(const g of m.games){pointsWon+=g[m.playerSide];pointsLost+=g[1-m.playerSide]}return {...m,won,score}});
 const losses=results.length-wins,winRate=results.length?Math.round(wins/results.length*100):0;
 return <><PublicHeader/><main className="public-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Rally</a><span>/</span><span>Players</span><span>/</span><span>{p.name}</span></nav>
  {p.isGuest&&<p><a className="dashboard-link" href={`/records?guest=${encodeURIComponent(p.id)}`}>Is this your guest record? Request ownership</a></p>}<section className="public-hero"><PlayerAvatar name={p.name} photoUrl={p.photoUrl} publicProfile/><div><p className="eyebrow">PUBLIC PLAYER PROFILE</p><h1>{p.name}</h1><p>{p.isGuest?'Guest player':'Rally player'}{p.clubs.length?` · ${p.clubs.map(c=>c.name).join(', ')}`:''}</p>{p.bio&&<p className="player-bio">{p.bio}</p>}</div></section>
  <div className="public-stat-grid"><article><CircleDot size={19}/><strong>{results.length}</strong><span>Confirmed matches</span></article><article><Trophy size={19}/><strong>{wins}–{losses}</strong><span>Match record</span></article><article><Users size={19}/><strong>{results.length?`${winRate}%`:'—'}</strong><span>Win rate</span></article><article><strong>{gamesWon}–{gamesLost}</strong><span>Games won–lost</span><small>{pointsWon}–{pointsLost} points</small></article></div>
  <PlayerPerformance playerId={p.id} playerName={p.name}/>
  <div className="public-layout"><section className="panel"><div className="panel-heading"><div><h2>Recent results</h2><p>Confirmed matches only</p></div></div>{results.length?<div>{results.map(m=><article className="public-result" key={m.id}><span className={m.won?'result-win':'result-loss'}>{m.won?'W':'L'}</span><div><strong><a href={`/players/${m.opponentId}`}>{m.opponentName}</a></strong><small>{m.clubName} · {dateLabel(m.playedOn)}{m.tournamentId?' · Tournament':''}</small></div><div className="public-score"><b>{m.score[m.playerSide]}–{m.score[1-m.playerSide]}</b><small>{m.games.map(g=>`${g[m.playerSide]}–${g[1-m.playerSide]}`).join(' · ')}</small>{m.tournamentId&&<a href={`/tournaments/${m.tournamentId}`}>View tournament</a>}</div></article>)}</div>:<p className="empty">No confirmed matches yet.</p>}</section>
   <aside className="public-aside"><h2>Clubs</h2>{p.clubs.length?p.clubs.map(c=><div key={c.id}><strong>{c.name}</strong><span>{c.location}</span></div>):<p>No active club memberships.</p>}<p className="public-note">Statistics update when a result is confirmed. Pending and voided results never appear here.</p></aside></div>
 </main></>;
}
