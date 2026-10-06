'use client';
import {useEffect,useState} from 'react';
import {createDemoData} from '@/lib/demo-state';
import {stats,type Match} from '@/lib/rally';
import {outcome,standings} from '@/lib/tournament-engine';
import BracketView from '../bracket-view';
import PublicHeader from '../public-header';
import type {Data} from '../rally-app';
export default function SamplePublic({kind,id}:{kind:'player'|'tournament';id:string}){
 const [data,setData]=useState<Data>(createDemoData);
 // Browser session data becomes available after server-rendered sample content hydrates.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{try{const saved=sessionStorage.getItem('rally-demo-preview');if(saved)setData(JSON.parse(saved));}catch{/* Use the seeded sample if storage is unavailable. */}},[]);
 const name=(id:string|null)=>data.players.find(p=>p.id===id)?.name??'Awaiting player';
 const player=data.players.find(p=>p.id===id),event=data.tournaments.find(t=>t.id===id);
 const matches=data.matches.filter(m=>m.status==='confirmed'&&(m.a===id||m.b===id));
 const record=stats(id,matches.map(m=>({id:m.id,a:m.a,b:m.b,games:m.games,date:m.played_on,club:m.club_id,status:'confirmed',kind:m.tournament_id?'Tournament':'Club play'} as Match)));
 return <div className="sample-public"><PublicHeader/><div className="demo-note"><span>Sample public {kind} page</span><a href="/demo">Back to demo</a></div><main>{kind==='player'&&player?<><h1>{player.name}</h1><div className="stat-grid"><div className="stat-card"><span>Match record</span><strong>{record.wins}–{record.losses}</strong></div><div className="stat-card"><span>Win rate</span><strong>{record.winRate}%</strong></div><div className="stat-card"><span>Games won / lost</span><strong>{record.gamesWon} / {record.gamesLost}</strong></div></div><section className="panel"><h2>Confirmed results</h2>{matches.map(m=><div className="public-result" key={m.id}><div/><div><strong>{name(m.a)} vs {name(m.b)}</strong><small>{m.played_on}</small></div><div className="public-score"><b>{m.games.map(g=>g.join('–')).join(' · ')}</b>{m.tournament_id&&<a href={`/demo/tournaments/${m.tournament_id}`}>Tournament</a>}</div></div>)}</section></>:kind==='tournament'&&event?<><div className="page-heading"><h1>{event.name}</h1><span className="badge">{event.status==='completed'?'Completed':event.status==='active'?'In progress':'Registration open'}</span></div><p>{data.clubs.find(c=>c.id===event.club_id)?.name} · {event.date} · {event.format}</p>{event.state?<><section className="panel"><h2>{event.status==='completed'?`Winner: ${outcome(event.state).winners.map(name).join(' & ')}`:'Draw'}</h2><div className="public-draw">{event.format==='Round robin'?<div>{standings(event.state).map(r=><div className="detail-row" key={r.id}><a href={`/demo/players/${r.id}`}>{r.rank}. {name(r.id)}</a><b>{r.wins}–{r.losses}</b></div>)}</div>:<BracketView draw={event.state} name={name}/>}</div></section><section className="panel"><h2>Results</h2>{event.state.fixtures.filter(f=>f.status==='played').map(f=><div className="public-result" key={f.id}><div/><div><strong>{name(f.a)} vs {name(f.b)}</strong></div><div className="public-score"><b>{f.games.map(g=>g.join('–')).join(' · ')}</b></div></div>)}</section></>:<section className="panel"><h2>Registered players</h2>{data.entries.filter(e=>e.tournament_id===id).map(e=><div className="detail-row" key={e.player_id}><a href={`/demo/players/${e.player_id}`}>{name(e.player_id)}</a></div>)}</section>}</>:<><h1>Sample unavailable</h1><a href="/demo">Return to demo</a></>}</main></div>;
}

