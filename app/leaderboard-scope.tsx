'use client';
import CleanSelect from './clean-select';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import type {SeasonView} from '@/lib/club-seasons';
import {demoSeasons} from '@/lib/demo-state';
import {ESTABLISHED_MATCHES} from '@/lib/seeding';
import type {Data} from './rally-app';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
// Scope controls for the Players leaderboard. Display only: ratings use the unchanged model.
export default function LeaderboardScope({clubId,data,demo,season,onSeason,establishedOnly,onEstablished,onProfile}:{clubId:string;data:Data;demo:boolean;season:string;onSeason:(id:string)=>void;establishedOnly:boolean;onEstablished:(on:boolean)=>void;onProfile:(id:string)=>void}){
 const [seasons,setSeasons]=useState<SeasonView[]>([]),demoData=demo?data:null;
 useEffect(()=>{let current=true;setSeasons([]);if(clubId==='all')return;if(demoData){setSeasons(demoSeasons(demoData,clubId));return;}fetch('/api/rally?view=seasons&club='+encodeURIComponent(clubId),{cache:'no-store'}).then(r=>r.ok?r.json():[]).then(body=>{if(current&&Array.isArray(body))setSeasons(body as SeasonView[]);}).catch(()=>{});return()=>{current=false};},[clubId,demoData]);
 const selected=season==='current'?null:seasons.find(s=>s.id===season)??null,rows=selected?selected.players.filter(p=>p.rank!==null&&(!establishedOnly||p.played>=ESTABLISHED_MATCHES)):[];
 return <><div className="leaderboard-scope">{clubId!=='all'&&seasons.length>0&&<label>Ranking period<CleanSelect value={selected?season:'current'} onChange={e=>onSeason(e.target.value)}><option value="current">All-time (last 24 months)</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.closed_at||s.ends_on<new Date().toISOString().slice(0,10)?' (finished)':''}</option>)}</CleanSelect></label>}<label className="notification-choice"><input type="checkbox" checked={establishedOnly} onChange={e=>onEstablished(e.target.checked)}/>Established players only ({ESTABLISHED_MATCHES}+ verified matches)</label></div>
 {selected&&<section className="panel"><div className="profile-section-heading"><h2>{selected.name}</h2><p>{selected.starts_on} to {selected.ends_on} · ratings from this season&rsquo;s matches only</p></div>{rows.length?<Table className="club-standings"><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead>Player</TableHead><TableHead>Season rating</TableHead><TableHead>Matches</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.map((p,i)=><TableRow key={p.player_id}><TableCell className="rank-col">{i+1}</TableCell><TableCell><button className="person" onClick={()=>onProfile(p.player_id)}><b>{p.name}</b></button></TableCell><TableCell className="elo-cell">{p.played?Math.round(p.rating):'—'}</TableCell><TableCell>{p.played}</TableCell><TableCell>{p.played<ESTABLISHED_MATCHES?`Provisional ${p.played}/${ESTABLISHED_MATCHES}`:'Established'}</TableCell></TableRow>)}</TableBody></Table>:<p className="empty">{establishedOnly?'No established players this season yet. Turn off the filter to see everyone.':'No players in this season yet.'}</p>}</section>}</>;
}
