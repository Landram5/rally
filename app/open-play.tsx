'use client';
import CleanSelect from './clean-select';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import Avatar from './player-avatar';
import type {OpenPlayEntry} from '@/lib/open-play';
const clock=(value:string)=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const DURATIONS=[[60,'1 hour'],[120,'2 hours'],[180,'3 hours'],[240,'4 hours']] as const;
function demoSeed(clubId:string):OpenPlayEntry[]{
 const now=Date.now();return [{id:'demo-op-1',clubId,playerId:'demo-jordan',name:'Jordan Lee',photoUrl:null,note:'Warm-up rallies, then a best of 3',startedAt:new Date(now-20*60000).toISOString(),expiresAt:new Date(now+100*60000).toISOString(),rating:1405,isMe:false},{id:'demo-op-2',clubId,playerId:'demo-sam',name:'Sam Rivera',photoUrl:null,note:'Happy to play anyone',startedAt:new Date(now-5*60000).toISOString(),expiresAt:new Date(now+55*60000).toISOString(),rating:1202,isMe:false}];
}
// "I'm at the club, who wants a game?" Visible to active club members only; entries expire on their own.
export default function OpenPlay({clubId,me,demo=false,meName='You'}:{clubId:string;me:string|null;demo?:boolean;meName?:string}){
 const [players,setPlayers]=useState<OpenPlayEntry[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[minutes,setMinutes]=useState(120),busyRef=useRef(false),storeKey='rally-demo-open-play-'+clubId;
 const refresh=useCallback(async()=>{
  if(demo){let list:OpenPlayEntry[];try{const saved=sessionStorage.getItem(storeKey);list=saved?JSON.parse(saved):demoSeed(clubId);}catch{list=demoSeed(clubId);}setPlayers(list.filter(p=>Date.parse(p.expiresAt)>Date.now()).map(p=>({...p,isMe:p.playerId===me})));return;}
  const response=await fetch('/api/open-play?club='+encodeURIComponent(clubId),{cache:'no-store'}),body=await response.json() as {players?:OpenPlayEntry[];error?:string};
  if(!response.ok)throw new Error(body.error||'Could not load open play.');setPlayers(body.players??[]);
 },[clubId,demo,me,storeKey]);
 useEffect(()=>{let current=true;void refresh().catch(e=>{if(current)setError(e.message)}).finally(()=>{if(current)setLoading(false)});const timer=setInterval(()=>{if(!busyRef.current&&document.visibilityState==='visible')void refresh().catch(()=>{});},30000);return()=>{current=false;clearInterval(timer)};},[refresh]);
 async function act(payload:Record<string,unknown>){
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{
   if(demo){const rest=players.filter(p=>p.playerId!==me),next=payload.action==='check_in'?[...rest,{id:'demo-op-me',clubId,playerId:me??'demo-me',name:meName,photoUrl:null,note:String(payload.note??''),startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+Number(payload.minutes)*60000).toISOString(),rating:null,isMe:true}]:rest;sessionStorage.setItem(storeKey,JSON.stringify(next));setPlayers(next);}
   else{const r=await fetch('/api/open-play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,clubId})}),b=await r.json() as {error?:string};if(!r.ok)throw new Error(b.error||'Could not update open play.');await refresh();}
   if(payload.action==='check_in')setNote('');
  }catch(e){setError(e instanceof Error?e.message:'Could not update open play.');}finally{busyRef.current=false;setBusy(false);}
 }
 const mine=players.find(p=>p.isMe),others=players.filter(p=>!p.isMe);
 return <section className="open-play" aria-label="Open play"><div className="session-heading"><h2>Open play</h2></div><p>Let club members know you&rsquo;re at the club and up for a game. Only active members see this, and it clears by itself.</p>
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {mine?<div className="open-play-me" role="status"><p><strong>You&rsquo;re listed as looking for a game</strong> until {clock(mine.expiresAt)}{mine.note?` \u00b7 \u201c${mine.note}\u201d`:''}</p><Button variant="outline" disabled={busy} onClick={()=>void act({action:'check_out'})}>I&rsquo;m done</Button></div>
  :<form className="open-play-form" onSubmit={e=>{e.preventDefault();void act({action:'check_in',note,minutes});}}><label>Note (optional)<input value={note} maxLength={120} placeholder="Anyone, best of 3, working on backhand" onChange={e=>setNote(e.target.value)}/></label><label>For<CleanSelect value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{DURATIONS.map(([m,label])=><option key={m} value={m}>{label}</option>)}</CleanSelect></label><Button type="submit" disabled={busy||!me}>I&rsquo;m here and want a game</Button></form>}
  {loading?<p role="status">Checking who is here&hellip;</p>:others.length?<ul className="open-play-list" aria-label="Members looking for a game">{others.map(p=><li key={p.id}><Avatar name={p.name} photoUrl={p.photoUrl}/><div><strong>{p.name}</strong>{p.rating!==null&&<small>Rally rating {p.rating}</small>}{p.note&&<span>{p.note}</span>}<small>Here since {clock(p.startedAt)} {'\u00b7'} until {clock(p.expiresAt)}</small></div></li>)}</ul>:<p className="empty">Nobody else is looking for a game right now.</p>}
 </section>;
}
