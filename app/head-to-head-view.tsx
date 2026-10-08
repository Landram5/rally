import Avatar from './player-avatar';
import ShareLinkButton from './share-link-button';
import {headToHeadSummary,type H2HMeeting} from '@/lib/head-to-head';
type Person={id:string;name:string;photoUrl?:string|null};
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export function headToHeadHeadline(a:string,b:string,meetings:H2HMeeting[]){
 const s=headToHeadSummary(meetings);if(!s.played)return `${a} and ${b} have not played each other yet.`;
 return s.aWins===s.bWins?`${a} and ${b} are tied ${s.aWins}\u2013${s.bWins} in confirmed matches.`:`${s.aWins>s.bWins?a:b} leads ${Math.max(s.aWins,s.bWins)}\u2013${Math.min(s.aWins,s.bWins)} in confirmed matches.`;
}
export default function HeadToHeadView({a,b,meetings,base=''}:{a:Person;b:Person;meetings:H2HMeeting[];base?:string}){
 const s=headToHeadSummary(meetings),shown=s.meetings.slice(0,50),name=(side:'a'|'b'|null)=>side==='a'?a.name:side==='b'?b.name:'';
 const margin=s.marginPerGame>0?a.name:b.name;
 return <div className="player-profile head-to-head">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href={base||'/'}>Rally</a><span>/</span><a href={`${base}/players/${a.id}`}>{a.name}</a><span>/</span><span>vs {b.name}</span></nav>
  <section className="public-hero head-to-head-hero"><div className="h2h-players"><a href={`${base}/players/${a.id}`}><Avatar name={a.name} photoUrl={a.photoUrl??null} publicProfile/><strong>{a.name}</strong></a><span className="versus">vs</span><a href={`${base}/players/${b.id}`}><Avatar name={b.name} photoUrl={b.photoUrl??null} publicProfile/><strong>{b.name}</strong></a></div><div><p className="eyebrow">HEAD-TO-HEAD</p><h1>{a.name} vs {b.name}</h1><p>{headToHeadHeadline(a.name,b.name,meetings)}</p></div></section>
  {s.played>0&&<div className="public-stat-grid"><article><strong>{s.aWins}{'\u2013'}{s.bWins}</strong><span>Match record</span><small>{a.name} first</small></article><article><strong>{s.aGames}{'\u2013'}{s.bGames}</strong><span>Games won</span><small>{s.aPoints}{'\u2013'}{s.bPoints} points</small></article><article><strong>{s.marginPerGame===0?'Even':`+${Math.abs(s.marginPerGame).toFixed(1)}`}</strong><span>Average margin</span><small>{s.marginPerGame===0?'points per game':`${margin} · points per game`}</small></article><article><strong>{s.streak.length}</strong><span>Current streak</span><small>{name(s.streak.holder)}</small></article></div>}
  <section className="panel"><div className="profile-section-heading"><h2>{s.played?'Meetings':'No meetings yet'}</h2><ShareLinkButton title={`${a.name} vs ${b.name} on Rally`}/></div>{shown.length?shown.map(m=>{const aGames=m.games.filter(g=>g[0]>g[1]).length,bGames=m.games.length-aGames,aWon=aGames>bGames;return <article className="public-result" key={m.id}><span className={aWon?'result-win':'result-loss'}>{aWon?a.name[0]:b.name[0]}</span><div><strong>{aWon?a.name:b.name} won</strong><small>{m.clubName} {'\u00b7'} {dateLabel(m.playedOn)}</small></div><div className="public-score"><b>{aGames}{'\u2013'}{bGames}</b><small>{m.games.map(g=>`${g[0]}\u2013${g[1]}`).join(' \u00b7 ')}</small>{m.tournamentId&&<a href={`${base}/tournaments/${m.tournamentId}`}>View tournament</a>}</div></article>}):<p className="empty">Once these players meet and the result is confirmed, it will appear here.</p>}{s.played>50&&<p className="footnote">Showing the 50 most recent of {s.played} meetings.</p>}</section>
  <p className="public-note">Confirmed results from approved clubs only. Scores are listed with {a.name} first. Separate from USATT records.</p>
 </div>;
}
