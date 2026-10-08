'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useMemo,useState} from 'react';
import CleanSelect from './clean-select';
import type {DoublesStandings} from '@/lib/doubles-view';
import {demoDoublesStandings} from '@/lib/demo-doubles';
import type {Data} from './rally-app';
import {ESTABLISHED_MATCHES} from '@/lib/seeding';
// Doubles leaderboard for one club or all of the viewer's clubs, plus the best partnerships.
export default function DoublesStandingsView({clubs,onProfile,demo}:{clubs:{id:string;name:string}[];onProfile?:(id:string)=>void;demo?:Data}){
 const [club,setClub]=useState('all'),[data,setData]=useState<DoublesStandings|null>(null),[error,setError]=useState(''),[established,setEstablished]=useState(false);
 const local=useMemo(()=>demo?demoDoublesStandings(demo,club):null,[demo,club]);
 useEffect(()=>{if(demo)return;let live=true;setData(null);setError('');fetch('/api/doubles?view=standings&club='+encodeURIComponent(club),{cache:'no-store'}).then(async r=>{const b=await r.json() as DoublesStandings&{error?:string};if(!r.ok)throw new Error(b.error||'Could not load doubles standings.');if(live)setData(b)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load doubles standings.')});return()=>{live=false};},[club,demo]);
 const shown=local??data,rows=(shown?.players??[]).filter(p=>!established||p.established);
 return <div className="doubles-standings"><div className="leaderboard-scope"><label>Club<CleanSelect value={club} onChange={e=>setClub(e.target.value)}><option value="all">All my clubs</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</CleanSelect></label><label className="notification-choice"><input type="checkbox" checked={established} onChange={e=>setEstablished(e.target.checked)}/>Established players only ({ESTABLISHED_MATCHES}+ matches)</label></div>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {!shown&&!error?<p role="status" className="doubles-empty">Loading standings…</p>:shown&&(rows.length?<><ol className="doubles-rank">{rows.map((p,i)=><li key={p.playerId}><span className="rank">{i+1}</span>{onProfile?<button className="person" onClick={()=>onProfile(p.playerId)}><b>{p.name}</b></button>:<b>{p.name}</b>}<span className="elo-cell">{Math.round(p.rating)}</span><small>{p.wins}–{p.played-p.wins}{p.established?'':' · provisional'}</small></li>)}</ol>
   {shown.pairs.length>0&&<><h4>Best partnerships</h4><ul className="doubles-partners">{shown.pairs.map(p=><li key={p.ids.join('|')}><span>{demo?<>{p.names[0]} &amp; {p.names[1]}</>:<a href={`/pairs/${p.ids[0]}/${p.ids[1]}`}>{p.names[0]} &amp; {p.names[1]}</a>}</span><span>{p.wins}–{p.played-p.wins}</span></li>)}</ul></>}</>:<p className="doubles-empty">No confirmed doubles results here yet.</p>)}
 </div>;
}
