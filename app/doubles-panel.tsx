'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Plus,X} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import CleanSelect from './clean-select';
import LivePointsTracker from './live-points-tracker';
import PlayerSearchPicker from './player-search-picker';
import type {DoublesFeedItem} from '@/lib/doubles';
import {demoDoublesFeed} from '@/lib/demo-doubles';
import type {Data} from './rally-app';
import DoublesProfileCard from './doubles-profile';
import DoublesStandingsView from './doubles-standings';
type Person={id:string;name:string};
const today=()=>new Date().toLocaleDateString('en-CA');
const dateLabel=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
async function post(payload:Record<string,unknown>){
 const r=await fetch('/api/rally',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not save your changes.');return body;
}
// Doubles results: two players per side. Singles ratings and statistics are never affected by these matches.
export default function DoublesPanel({me,clubs,membersOf,onProfile,demo}:{me:string;clubs:{id:string;name:string}[];membersOf:(clubId:string)=>Person[];onProfile?:(id:string)=>void;demo?:{data:Data;act:(payload:Record<string,unknown>,message:string)=>Promise<boolean>}}){
 const [view,setView]=useState<'matches'|'standings'|'mine'>('matches'),[live,setLive]=useState(false),[liveDone,setLiveDone]=useState(false);
 const [filter,setFilter]=useState('all'),[items,setItems]=useState<DoublesFeedItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [club,setClub]=useState(clubs[0]?.id??''),[a1,setA1]=useState(me),[a2,setA2]=useState(''),[b1,setB1]=useState(''),[b2,setB2]=useState(''),[date,setDate]=useState(today()),[bestOf,setBestOf]=useState('3'),[games,setGames]=useState<[string,string][]>([['',''],['','']]),[formError,setFormError]=useState('');
 const requestId=useRef('');
 const send=async(payload:Record<string,unknown>,message='Doubles match saved.')=>{if(demo){if(!await demo.act(payload,message))throw new Error('Could not save your changes.');return {status:'confirmed'};}return post(payload);};
 const load=useCallback(async()=>{
  if(demo){setItems(demoDoublesFeed(demo.data,filter));setError('');setLoading(false);return;}
  try{const r=await fetch('/api/doubles?club='+encodeURIComponent(filter),{cache:'no-store'});const body=await r.json() as {matches?:DoublesFeedItem[];error?:string};if(!r.ok)throw new Error(body.error||'Could not load doubles matches.');setItems(body.matches??[]);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Could not load doubles matches.');}finally{setLoading(false);}
 },[filter,demo]);
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{setLoading(true);void load();},[load]);
 const people=membersOf(club);
 function begin(){setLive(false);setLiveDone(false);requestId.current=crypto.randomUUID();setClub(clubs[0]?.id??'');setA1(me);setA2('');setB1('');setB2('');setDate(today());setBestOf('3');setGames([['',''],['','']]);setFormError('');setOpen(true);}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;setFormError('');
  if(new Set([a1,a2,b1,b2]).size!==4||[a1,a2,b1,b2].some(p=>!p)){setFormError('Choose four different players, two on each side.');return;}
  if(live&&!liveDone){setFormError('Finish the match, or switch to entering the scores by hand.');return;}
  if(games.some(g=>g.some(v=>!v.trim()))){setFormError('Enter both scores for each game, or remove unused games.');return;}
  setBusy(true);
  try{const result=await send({action:'record_doubles_match',id:requestId.current,clubId:club,a1,a2,b1,b2,games:games.map(g=>g.map(Number)),bestOf:Number(bestOf),date}) as {status?:string};if(!demo)toast.success(result.status==='confirmed'?'Doubles match saved.':'Doubles match saved. An opponent needs to confirm it.');setOpen(false);await load();}
  catch(err){setFormError(err instanceof Error?err.message:'Could not save the match.');}finally{setBusy(false);}
 }
 async function act(action:'confirm_doubles_match'|'void_doubles_match',id:string,message:string){try{await send({action,id},message);if(!demo)toast.success(message);await load();}catch(err){toast.error(err instanceof Error?err.message:'Could not update the match.');}}
 const side=(m:DoublesFeedItem,which:'a'|'b')=>(which==='a'?[m.a1,m.a2]:[m.b1,m.b2]).map(id=>m.names[id]??'Player').join(' & ');
 const tally=(m:DoublesFeedItem)=>m.games.reduce<[number,number]>((t,g)=>{t[g[0]>g[1]?0:1]++;return t},[0,0]);
 return <section className="panel doubles-panel" aria-label="Doubles matches">
  <div className="panel-heading"><div><h2>Doubles</h2><p>Two players per side. Doubles results have their own rating and never change your singles rating.</p></div><Button onClick={begin} disabled={!clubs.length}><Plus size={16}/>Record doubles</Button></div>
  <div className="doubles-views" role="tablist" aria-label="Doubles sections">{([['matches','Matches'],['standings','Standings'],['mine','My rating']] as const).map(([v,l])=><button key={v} type="button" role="tab" aria-selected={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{l}</button>)}</div>`n  {view==="standings"&&<DoublesStandingsView clubs={clubs} onProfile={onProfile} demo={demo?.data}/>}{view==="mine"&&<DoublesProfileCard playerId={me} self demo={demo?.data}/>}`n  {view==="matches"&&<>`n  <div className="doubles-filter"><CleanSelect aria-label="Doubles club" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All my clubs</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</CleanSelect></div>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {loading?<p role="status" className="doubles-empty">Loading doubles matches…</p>:items.length?<ul className="doubles-list">{items.map(m=>{const t=tally(m),aWon=t[0]>t[1];return <li key={m.id} className={`doubles-row status-${m.status}`}>
   <div className="doubles-sides"><span className={aWon?'doubles-winner':''}>{side(m,'a')}</span><span className="versus">vs</span><span className={!aWon?'doubles-winner':''}>{side(m,'b')}</span></div>
   <div className="doubles-score"><strong>{t[0]} : {t[1]}</strong><small>{m.games.map(g=>g.join('–')).join(' · ')}</small></div>
   <div className="doubles-meta"><span>{dateLabel(m.played_on)} · {m.clubName}</span><small className={'status-'+m.status}>{m.status==='confirmed'?'Confirmed':m.status==='voided'?'Voided':'Awaiting confirmation'}</small></div>
   {m.status==='confirmed'&&!demo&&<a className="doubles-link" href={`/doubles/${encodeURIComponent(m.id)}`}>Public result</a>}{(m.canConfirm||m.canVoid)&&<div className="doubles-actions">{m.canConfirm&&<Button size="sm" onClick={()=>void act('confirm_doubles_match',m.id,'Result confirmed.')}>Confirm result</Button>}{m.canVoid&&<Button size="sm" variant="ghost" onClick={()=>void act('void_doubles_match',m.id,'Result voided.')}>{m.status==='pending'?'Withdraw':'Void'}</Button>}</div>}
  </li>})}</ul>:<p className="doubles-empty">No doubles matches yet. Record one after you play.</p>}</>}
  <Dialog open={open} onOpenChange={o=>{if(!busy)setOpen(o)}}><DialogContent><DialogHeader><DialogTitle>Record a doubles match</DialogTitle><DialogDescription>Side A is your team. An opponent confirms the result before it counts.</DialogDescription></DialogHeader>
   <form className="form-stack doubles-form" onSubmit={e=>void submit(e)}>
    <label>Club<CleanSelect value={club} onChange={e=>{setClub(e.target.value);setA2('');setB1('');setB2('')}}>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</CleanSelect></label>
    <div className="doubles-teams"><fieldset><legend>Side A</legend><PlayerSearchPicker label="Side A, player 1" value={a1} onChange={setA1} options={people}/><PlayerSearchPicker label="Side A, player 2" value={a2} onChange={setA2} options={people.filter(p=>p.id!==a1&&p.id!==b1&&p.id!==b2)} placeholder="Partner"/></fieldset><fieldset><legend>Side B</legend><PlayerSearchPicker label="Side B, player 1" value={b1} onChange={setB1} options={people.filter(p=>p.id!==a1&&p.id!==a2&&p.id!==b2)} placeholder="Opponent"/><PlayerSearchPicker label="Side B, player 2" value={b2} onChange={setB2} options={people.filter(p=>p.id!==a1&&p.id!==a2&&p.id!==b1)} placeholder="Opponent"/></fieldset></div>
    <div className="doubles-meta-fields"><label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} required/></label><label>Format<CleanSelect value={bestOf} onChange={e=>setBestOf(e.target.value)}>{[['1','Single game'],['3','Best of 3'],['5','Best of 5'],['7','Best of 7']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</CleanSelect></label></div>
    <div className="doubles-live">{live?<><LivePointsTracker key={bestOf+a1+a2+b1+b2} names={[[a1,a2].map(id=>people.find(p=>p.id===id)?.name??'Side A').join(' & '),[b1,b2].map(id=>people.find(p=>p.id===id)?.name??'Side B').join(' & ')]} bestOf={Number(bestOf)} onChange={state=>{setGames(state.games.map(g=>g.map(String) as [string,string]));setLiveDone(state.complete)}}/><Button type="button" variant="ghost" onClick={()=>{setLive(false);setLiveDone(false);setGames([['',''],['','']])}}>Enter scores by hand instead</Button></>:<Button type="button" variant="outline" onClick={()=>{setLive(true);setLiveDone(false);setGames([])}}>Score live, point by point</Button>}</div>
    <div className={live?'doubles-games is-hidden':'doubles-games'} role="group" aria-label="Game scores">{games.map((g,i)=><div key={i} className="doubles-game"><span>Game {i+1}</span><input inputMode="numeric" aria-label={`Game ${i+1}, side A`} value={g[0]} onChange={e=>setGames(games.map((x,j)=>j===i?[e.target.value,x[1]]:x))}/><span aria-hidden="true">–</span><input inputMode="numeric" aria-label={`Game ${i+1}, side B`} value={g[1]} onChange={e=>setGames(games.map((x,j)=>j===i?[x[0],e.target.value]:x))}/>{games.length>1&&<Button type="button" size="icon" variant="ghost" aria-label={`Remove game ${i+1}`} onClick={()=>setGames(games.filter((_,j)=>j!==i))}><X size={16}/></Button>}</div>)}{games.length<Number(bestOf)&&<Button type="button" variant="ghost" onClick={()=>setGames([...games,['','']])}><Plus size={16}/>Add game</Button>}</div>
    {formError&&<p className="error" role="alert">{formError}</p>}
    <Button disabled={busy}>{busy?'Saving…':'Save doubles match'}</Button>
   </form>
  </DialogContent></Dialog>
 </section>;
}
