'use client';
import {useEffect,useMemo,useState} from 'react';
import type {DoublesProfile} from '@/lib/doubles-view';
import {ESTABLISHED_MATCHES} from '@/lib/seeding';
import {demoDoublesProfile} from '@/lib/demo-doubles';
import type {Data} from './rally-app';
const dateLabel=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
// Simple trend of a player's doubles rating after each of their latest results.
function Trend({history}:{history:DoublesProfile['history']}){
 const [pick,setPick]=useState(history.length-1);
 if(history.length<2)return null;
 const W=320,H=150,PL=36,PR=12,T=12,B=22,values=history.map(h=>h.value),min=Math.floor(Math.min(...values)/25)*25-25,max=Math.ceil(Math.max(...values)/25)*25+25,x=(i:number)=>PL+i/(history.length-1)*(W-PL-PR),y=(v:number)=>T+(1-(v-min)/(max-min))*(H-T-B),sel=history[Math.min(pick,history.length-1)];
 return <figure className="doubles-trend"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Doubles rating over the last ${history.length} matches`}><text x="0" y={T+4}>{max}</text><text x="0" y={H-B+4}>{min}</text><line x1={PL} x2={W-PR} y1={H-B} y2={H-B} stroke="currentColor" opacity=".2"/><polyline points={history.map((h,i)=>`${x(i)},${y(h.value)}`).join(' ')} fill="none" stroke="var(--brand-600)" strokeWidth="2" strokeLinejoin="round"/>{history.map((h,i)=><circle key={i} cx={x(i)} cy={y(h.value)} r={i===pick?5:3} fill={h.won?'var(--brand-600)':'var(--surface)'} stroke="var(--brand-600)" strokeWidth="1.5" tabIndex={0} role="button" aria-label={`${dateLabel(h.date)}, ${h.won?'win':'loss'}, rating ${h.value}`} onClick={()=>setPick(i)} onFocus={()=>setPick(i)}/>)}</svg>
  <figcaption><strong>{Math.round(sel.value)}</strong> · {dateLabel(sel.date)} · {sel.won?'Won':'Lost'} with {sel.partner} vs {sel.opponents}</figcaption></figure>;
}
// A player's doubles summary: rating, record, partners and history. Renders nothing when the viewer cannot see it or there are no results.
export default function DoublesProfileCard({playerId,self=false,demo}:{playerId:string;self?:boolean;demo?:Data}){
 const [data,setData]=useState<DoublesProfile|null>(null),[state,setState]=useState<'loading'|'ready'|'hidden'>('loading');
 const local=useMemo(()=>demo?demoDoublesProfile(demo,playerId):null,[demo,playerId]);
 useEffect(()=>{if(demo)return;let live=true;fetch('/api/doubles?view=profile&player='+encodeURIComponent(playerId),{cache:'no-store'}).then(async r=>{const body=await r.json().catch(()=>null);if(!live)return;if(r.ok&&body){setData(body as DoublesProfile);setState('ready')}else setState('hidden')}).catch(()=>{if(live)setState('hidden')});return()=>{live=false};},[playerId,demo]);
 const shown=local??data;
 if(!local&&state==='loading')return self?<p role="status" className="doubles-empty">Loading doubles rating…</p>:null;
 if(!shown)return null;
 if(!shown.played)return self?<p className="doubles-empty">No confirmed doubles matches yet. Your doubles rating appears after your first confirmed result.</p>:null;
 return <section className="panel doubles-profile" aria-label="Doubles rating"><div className="profile-section-heading"><h3>Doubles rating</h3><p>Separate from the singles rating</p></div>
  <div className="rating-summary"><strong>{Math.round(shown.rating??0)}</strong><span>{shown.established?`Established · ${shown.played} matches`:`Provisional · ${shown.played}/${ESTABLISHED_MATCHES} matches`}</span><span>{shown.wins}–{shown.played-shown.wins} · {shown.partners.length} {shown.partners.length===1?'partner':'partners'}</span></div>
  <Trend history={shown.history}/>
  {shown.partners.length>0&&<><h4>Partners</h4><ul className="doubles-partners">{shown.partners.map(p=><li key={p.id}><span>{p.name}</span><span>{p.wins}–{p.played-p.wins}</span></li>)}</ul></>}
 </section>;
}
