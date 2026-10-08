'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {Eye,RefreshCw,Send,Users} from 'lucide-react';
import type {Announcement} from '@/lib/announcements';
import {Button} from '@/components/ui/button';
import {TimeLabel} from './time-label';
import {AnnouncementNotice} from './announcement-banner';
const TITLE_MAX=120,BODY_MAX=2000;
export default function AnnouncementsBoard({clubId,canPublish=false}:{clubId?:string;canPublish?:boolean}){
 const operation=useRef<string|null>(null);
 const [preview,setPreview]=useState(false);
 const [items,setItems]=useState<Announcement[]>([]),[admin,setAdmin]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{const r=await fetch('/api/announcements'+(clubId?'?club='+encodeURIComponent(clubId):''),{cache:'no-store'});if(r.status===401||r.status===403){setItems([]);return;}const data=await r.json() as {announcements:Announcement[];isSiteAdmin:boolean;error?:string};if(!r.ok)throw new Error(data.error||'Could not load announcements.');setItems(data.announcements);setAdmin(data.isSiteAdmin);},[clubId]);
 useEffect(()=>{let current=true;refresh().catch(e=>{if(current)setError(e.message);}).finally(()=>{if(current)setLoading(false);});const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},30000);return()=>{current=false;clearInterval(timer);};},[refresh]);
 async function publish(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/announcements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish',id:operation.current??(operation.current=crypto.randomUUID()),clubId:clubId??'',title,body})});const result=await r.json() as {error?:string};if(!r.ok)throw new Error(result.error||'Could not publish announcement.');operation.current=null;setTitle('');setBody('');setNotice('Announcement published.');setPreview(false);await refresh();window.dispatchEvent(new Event('rally-announcements-changed'));}catch(e){setError(e instanceof Error?e.message:'Could not publish.');}finally{setBusy(false);}}
 const canCompose=clubId?canPublish:admin,audience=clubId?'Active members of this club':'All Rally player accounts',empty=!title.trim()||!body.trim();
 return <><section className="announcements-board" id="announcements">
  <header className="announcements-head"><div><h2>{clubId?'Club announcements':'Your updates'}</h2><p>{clubId?'Updates for active club members':'Updates for your account'}</p></div><Button variant="outline" size="icon" aria-label="Refresh announcements" title="Refresh" disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}><RefreshCw size={16}/></Button></header>
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-success" role="status">{notice}</p>}
  {canCompose&&<form onSubmit={e=>void publish(e)} className="announcement-form">
   <div className="announcement-form-head"><h3>New announcement</h3><span className="announcement-audience-chip"><Users size={14} aria-hidden="true"/>{audience}</span></div>
   <label htmlFor="announcement-title">Title</label>
   <input id="announcement-title" required maxLength={TITLE_MAX} value={title} placeholder="What is this about?" onChange={e=>{operation.current=null;setTitle(e.target.value);}}/>
   <label htmlFor="announcement-body">Message</label>
   <textarea id="announcement-body" required maxLength={BODY_MAX} rows={5} value={body} placeholder="Write the update members will see." onChange={e=>{operation.current=null;setBody(e.target.value);}}/>
   <div className="announcement-form-foot"><p className="announcement-hint">Shown once as a popup, then kept in the inbox. <span className="announcement-count">{body.length}/{BODY_MAX}</span></p><div className="club-buttons"><Button type="button" variant="outline" disabled={busy||empty} onClick={()=>setPreview(true)}><Eye size={16}/>Preview</Button><Button type="submit" disabled={busy||empty}><Send size={16}/>{busy?'Publishing…':'Publish'}</Button></div></div>
  </form>}
  <div className="announcement-feed">{!loading&&<h3 className="announcement-feed-title">Published{items.length?` · ${items.length}`:''}</h3>}{loading?<p role="status" className="announcement-empty">Loading announcements…</p>:items.length?items.map(a=><article className="announcement-entry" key={a.id}><div className="announcement-entry-head"><span className="badge">{a.clubName??'Rally'}</span><small><TimeLabel value={a.created_at}/></small></div><h3>{a.title}</h3><p>{a.body}</p></article>):<p className="announcement-empty">No announcements yet.</p>}</div>
 </section>{preview&&<AnnouncementNotice preview announcement={{id:"preview",club_id:clubId??null,title,body,created_at:new Date().toISOString(),clubName:clubId?'This club':null,seen:false}} onClose={()=>setPreview(false)}/>}</>;
}
