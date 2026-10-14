'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Ban,Bell,BellOff,Flag,MoreHorizontal,Paperclip,Search,ShieldAlert,SquarePen,Trash2,UserX} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import Avatar from './player-avatar';
import {AttachmentPreview,MediaView,prepareAttachment,type Attachment} from './chat-attach';
import LeaderRooms from './leader-rooms';
import type {DmMessage,DmPerson,DmThread} from '@/lib/messages';
type LocalMedia={id:string;kind:'image'|'video';contentType:string;bytes:number;src?:string};
type Convo={other:DmPerson;canSend:boolean;hasMore:boolean;messages:DmMessage[]};
type Person=DmPerson&{clubs?:string[]};
type Report={id:string;kind:string;reason:string;createdAt:string;reporter:string;target:string;targetId:string;context:{author_name:string;body:string;created_at:string}[]};
const when=(iso:string)=>{const d=new Date(iso),now=new Date();return d.toDateString()===now.toDateString()?d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
async function api(payload:Record<string,unknown>){
 const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not complete that.');return body;
}
const stamp=(iso:string)=>{const d=new Date(iso),now=new Date(),t=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),day=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime())/86400000);return day===0?`Today ${t}`:day===1?`Yesterday ${t}`:day<7?`${d.toLocaleDateString('en-US',{weekday:'long'})} ${t}`:`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}, ${t}`;};
const gap=(a:string,b:string)=>Math.abs(Date.parse(b)-Date.parse(a));
const photo=(p:DmPerson)=>p.photoVersion?`/api/players/${p.id}/photo?v=${encodeURIComponent(p.photoVersion)}`:undefined;
const ago=(m:number)=>new Date(Date.now()-m*60000).toISOString();
// Sample conversations for the demo: nothing is sent anywhere.
const demoThreads=():{threads:DmThread[];convos:Record<string,Convo>}=>{
 const jordan:DmPerson={id:'jordan',name:'Jordan Lee',photoVersion:null,deleted:false},sam:DmPerson={id:'sam',name:'Sam Rivera',photoVersion:null,deleted:false};
 const msg=(id:string,threadId:string,author:string,body:string,m:number):DmMessage=>({id,threadId,authorId:author,body,createdAt:ago(m),mine:author==='alex',media:null});
 const convos:Record<string,Convo>={
  't-jordan':{other:jordan,canSend:true,hasMore:false,messages:[msg('a1','t-jordan','jordan','Are you up for doubles Thursday?',50),msg('a2','t-jordan','alex','Yes! I will bring the score sheets.',44),msg('a3','t-jordan','jordan','Perfect, see you at 6.',12)]},
  't-sam':{other:sam,canSend:true,hasMore:false,messages:[msg('b1','t-sam','sam','Thanks for the game last week.',1500)]},
 };
 return {convos,threads:[{id:'t-jordan',other:jordan,lastMessage:'Perfect, see you at 6.',lastAt:ago(12),unread:1,canSend:true},{id:'t-sam',other:sam,lastMessage:'Thanks for the game last week.',lastAt:ago(1500),unread:0,canSend:true}]};
};
export default function MessagesTab({demo=false,people=[],initialWith,initialThread,initialRoom,onUnread}:{demo?:boolean;people?:{id:string;name:string;is_guest?:number}[];initialWith?:string;initialThread?:string;initialRoom?:string;onUnread?:(n:number)=>void}){
 const [pane,setPane]=useState<'direct'|'rooms'>(initialRoom?'rooms':'direct'),[showRooms,setShowRooms]=useState(demo),[dmCount,setDmCount]=useState(0),[roomCount,setRoomCount]=useState(0);
 const onDm=useCallback((n:number)=>setDmCount(n),[]),onRooms=useCallback((unread:number,invites:number)=>{setRoomCount(unread+invites);if(invites>0)setShowRooms(true);},[]);
 useEffect(()=>{onUnread?.(dmCount+roomCount);},[dmCount,roomCount,onUnread]);
 useEffect(()=>{if(demo)return;let live=true;fetch('/api/rooms',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{leader:boolean;rooms:{unread:number}[];invitations:unknown[]}>:null).then(b=>{if(live&&b){setShowRooms(b.leader||b.invitations.length>0);setRoomCount(b.rooms.reduce((n,r)=>n+r.unread,0)+b.invitations.length);}}).catch(()=>{});return()=>{live=false};},[demo]);
 const [threads,setThreads]=useState<DmThread[]>([]),[admin,setAdmin]=useState(false),[notify,setNotify]=useState(true),[blocked,setBlocked]=useState<DmPerson[]|null>(null);
 const [activeId,setActiveId]=useState<string|null>(null),[convo,setConvo]=useState<Convo|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[text,setText]=useState(''),[sending,setSending]=useState(false),[attachment,setAttachment]=useState<Attachment|null>(null),[uploading,setUploading]=useState(false);
 const [newOpen,setNewOpen]=useState(false),[query,setQuery]=useState(''),[results,setResults]=useState<Person[]>([]),[searching,setSearching]=useState(false),[showBlocks,setShowBlocks]=useState(false),[reports,setReports]=useState<Report[]|null>(null),[showReports,setShowReports]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null),local=useRef(demo?demoThreads():null),list=useRef<HTMLDivElement>(null),stick=useRef(true),activeRef=useRef<string|null>(null),meRef=useRef(demo?'alex':'');
 const setActive=useCallback((id:string|null)=>{activeRef.current=id;setActiveId(id);},[]);
 const loadThreads=useCallback(async()=>{
  if(demo){const l=local.current!;setThreads([...l.threads].sort((a,b)=>b.lastAt.localeCompare(a.lastAt)));onDm(l.threads.reduce((n,t)=>n+t.unread,0));return;}
  const r=await fetch('/api/messages',{cache:'no-store'}),b=await r.json() as {error?:string;me:string;admin:boolean;notify:boolean;threads:DmThread[]};
  if(!r.ok)throw new Error(b.error||'Could not load messages.');
  meRef.current=b.me;setAdmin(b.admin);setNotify(b.notify);setThreads(b.threads);onDm(b.threads.reduce((n,t)=>n+t.unread,0));
 },[demo,onDm]);
 const openThread=useCallback(async(id:string)=>{
  setActive(id);stick.current=true;setConvo(null);setAttachment(null);
  try{
   if(demo){const l=local.current!;setConvo(l.convos[id]);l.threads=l.threads.map(t=>t.id===id?{...t,unread:0}:t);await loadThreads();return;}
   const r=await fetch('/api/messages?thread='+encodeURIComponent(id),{cache:'no-store'}),b=await r.json() as Convo&{error?:string};if(!r.ok)throw new Error(b.error||'Could not open this conversation.');
   setConvo(b);void api({action:'read',threadId:id}).then(()=>loadThreads()).catch(()=>{});
  }catch(e){toast.error(e instanceof Error?e.message:'Could not open this conversation.');setActive(null);}
 },[demo,loadThreads,setActive]);
 const startWith=useCallback(async(personId:string)=>{
  try{
   if(demo){const l=local.current!,existing=l.threads.find(t=>t.other.id===personId);if(existing){await openThread(existing.id);return;}
    const p=people.find(x=>x.id===personId);if(!p)return;const id='t-'+personId,other:DmPerson={id:personId,name:p.name,photoVersion:null,deleted:false};
    l.convos[id]={other,canSend:true,hasMore:false,messages:[]};l.threads=[{id,other,lastMessage:'',lastAt:new Date().toISOString(),unread:0,canSend:true},...l.threads];await openThread(id);return;}
   const r=await api({action:'start',personId}) as {threadId:string};await openThread(r.threadId);
  }catch(e){toast.error(e instanceof Error?e.message:'Could not start a conversation.');}
 },[demo,openThread,people]);
 useEffect(()=>{let gone=false;loadThreads().then(()=>{if(gone)return;setError('');if(initialThread)void openThread(initialThread);else if(initialWith)void startWith(initialWith);}).catch(e=>{if(!gone)setError(e instanceof Error?e.message:'Could not load messages.')}).finally(()=>{if(!gone)setLoading(false)});return()=>{gone=true};},[]);// eslint-disable-line react-hooks/exhaustive-deps
 // Live updates from a private room per person; falls back to checking again when the tab regains focus.
 useEffect(()=>{
  if(demo)return;
  let ws:WebSocket|null=null,closed=false,retry=0,timer:ReturnType<typeof setTimeout>|undefined;
  const connect=()=>{if(closed)return;ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/chat/ws?inbox=1`);
   ws.onopen=()=>{retry=0;void loadThreads().catch(()=>{});};
   ws.onmessage=e=>{try{const ev=JSON.parse(String(e.data)) as {type:string;message?:DmMessage;id?:string;threadId?:string};
    if(ev.type==='dm'&&ev.message){const m={...ev.message,mine:ev.message.authorId===meRef.current};if(activeRef.current===m.threadId){setConvo(c=>c&&!c.messages.some(x=>x.id===m.id)?{...c,messages:[...c.messages,m]}:c);if(!m.mine)void api({action:'read',threadId:m.threadId}).catch(()=>{});}void loadThreads().catch(()=>{});}
    else if(ev.type==='dm_delete'&&ev.id){setConvo(c=>c?{...c,messages:c.messages.filter(x=>x.id!==ev.id)}:c);void loadThreads().catch(()=>{});}}catch{/* ignore malformed events */}};
   ws.onclose=()=>{if(!closed)timer=setTimeout(connect,Math.min(30000,1000*2**retry++));};ws.onerror=()=>ws?.close();};
  connect();const visible=()=>{if(document.visibilityState==='visible'){void loadThreads().catch(()=>{});if(ws&&ws.readyState>1){clearTimeout(timer);connect();}}};document.addEventListener('visibilitychange',visible);
  return()=>{closed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);ws?.close();};
 },[demo,loadThreads]);
 useEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[convo]);
 useEffect(()=>{if(!newOpen)return;const q=query.trim();if(q.length<2){setResults([]);return;}
  if(demo){setResults(people.filter(p=>!p.is_guest&&p.id!=='alex'&&p.name.toLowerCase().includes(q.toLowerCase())).map(p=>({id:p.id,name:p.name,photoVersion:null,deleted:false,clubs:[]})));return;}
  setSearching(true);const t=setTimeout(()=>{fetch('/api/messages?lookup='+encodeURIComponent(q),{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{people?:Person[]}>:{people:[]}).then(b=>setResults(b.people??[])).catch(()=>setResults([])).finally(()=>setSearching(false));},250);return()=>clearTimeout(t);},[query,newOpen,demo,people]);
 async function attach(f:File|undefined){if(!f||!activeId)return;if(fileInput.current)fileInput.current.value='';setUploading(true);try{setAttachment(await prepareAttachment(f,'/api/messages/media?thread='+encodeURIComponent(activeId),demo));}catch(e){toast.error(e instanceof Error?e.message:'The upload failed.');}finally{setUploading(false);}}
 async function send(){
  const body=text.trim();if((!body&&!attachment)||!activeId||!convo||sending||uploading)return;setSending(true);
  const clientId=crypto.randomUUID();
  try{
   if(demo){const l=local.current!,m:DmMessage={id:'m-'+clientId,threadId:activeId,authorId:'alex',body,createdAt:new Date().toISOString(),mine:true,media:attachment?{id:attachment.id,kind:attachment.kind,contentType:attachment.contentType,bytes:attachment.bytes,src:attachment.preview} as LocalMedia as DmMessage['media']:null};
    l.convos[activeId]={...l.convos[activeId],messages:[...l.convos[activeId].messages,m]};l.threads=l.threads.map(t=>t.id===activeId?{...t,lastMessage:body||(attachment?.kind==='video'?'Video':'Photo'),lastAt:m.createdAt}:t);setConvo(l.convos[activeId]);setText('');setAttachment(null);stick.current=true;await loadThreads();
    const tid=activeId;setTimeout(()=>{const r:DmMessage={id:'r-'+clientId,threadId:tid,authorId:l.convos[tid].other.id,body:'Sounds good!',createdAt:new Date().toISOString(),mine:false,media:null};l.convos[tid]={...l.convos[tid],messages:[...l.convos[tid].messages,r]};l.threads=l.threads.map(t=>t.id===tid?{...t,lastMessage:r.body,lastAt:r.createdAt}:t);if(activeRef.current===tid)setConvo(l.convos[tid]);void loadThreads();},1800);return;}
   const r=await api({action:'send',threadId:activeId,text:body,mediaId:attachment?.id,clientId}) as {message:DmMessage};
   stick.current=true;setConvo(c=>c&&!c.messages.some(x=>x.id===r.message.id)?{...c,messages:[...c.messages,{...r.message,mine:true}]}:c);setText('');setAttachment(null);void loadThreads().catch(()=>{});
  }catch(e){toast.error(e instanceof Error?e.message:'Could not send that.');}finally{setSending(false);}
 }
 const act=async(payload:Record<string,unknown>,done:string,after?:()=>void)=>{try{if(!demo)await api(payload);toast.success(demo?done+' Sample data only.':done);after?.();}catch(e){toast.error(e instanceof Error?e.message:'Could not complete that.');}};
 const other=convo?.other;
 return <section className="messages" aria-label="Messages">
  {showRooms&&<div className="msg-switch" role="tablist" aria-label="Message type"><button type="button" role="tab" aria-selected={pane==='direct'} className={pane==='direct'?'active':''} onClick={()=>setPane('direct')}>Direct{dmCount>0&&<span className="badge">{dmCount}</span>}</button><button type="button" role="tab" aria-selected={pane==='rooms'} className={pane==='rooms'?'active':''} onClick={()=>setPane('rooms')}>Leader rooms{roomCount>0&&<span className="badge">{roomCount}</span>}</button></div>}
  {pane==='rooms'&&<LeaderRooms demo={demo} initialRoom={initialRoom} onCounts={onRooms}/>}
  <div hidden={pane==='rooms'}>
  <div className={`msg-layout${activeId?' has-thread':''}`}>
   <aside className="msg-list" aria-label="Conversations">
    <div className="msg-list-head"><h2>Messages</h2><div className="msg-tools">
     <Button variant="ghost" size="icon" aria-label={notify?'Turn off message alerts':'Turn on message alerts'} aria-pressed={notify} title={notify?'Alerts on':'Alerts off'} onClick={()=>void act({action:'notify',on:!notify},notify?'Message alerts off.':'Message alerts on.',()=>setNotify(!notify))}>{notify?<Bell size={18}/>:<BellOff size={18}/>}</Button>
     <Button variant="ghost" size="icon" aria-label="Blocked people" title="Blocked people" onClick={()=>{setShowBlocks(true);if(!demo)void fetch('/api/messages?blocks=1',{cache:'no-store'}).then(r=>r.json() as Promise<{blocked?:DmPerson[]}>).then(b=>setBlocked(b.blocked??[])).catch(()=>setBlocked([]));else setBlocked([]);}}><UserX size={18}/></Button>
     {admin&&<Button variant="ghost" size="icon" aria-label="Safety reports" title="Safety reports" onClick={()=>{setShowReports(true);void fetch('/api/messages?reports=1',{cache:'no-store'}).then(r=>r.json() as Promise<{reports?:Report[]}>).then(b=>setReports(b.reports??[])).catch(()=>setReports([]));}}><ShieldAlert size={18}/></Button>}
     <Button variant="ghost" size="icon" aria-label="New message" title="New message" onClick={()=>{setQuery('');setResults([]);setNewOpen(true);}}><SquarePen size={20}/></Button></div></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    {loading?<p role="status" className="doubles-empty">Loading messages…</p>:!threads.length?<p className="doubles-empty">No conversations yet. Tap New to message someone from your clubs.</p>:<ul>{threads.map(t=><li key={t.id}><button type="button" className={`msg-thread${t.id===activeId?' is-active':''}${t.unread>0?' has-unread':''}`} onClick={()=>void openThread(t.id)}>
     <Avatar name={t.other.name} photoUrl={photo(t.other)} large/><span className="msg-thread-main"><b>{t.other.name}</b><small>{t.unread>0&&t.unread>1?`${t.unread} new messages`:(t.lastMessage||'No messages yet')}{t.lastAt?` · ${when(t.lastAt)}`:''}</small></span>{t.unread>0&&<span className="msg-dot" role="img" aria-label={`${t.unread} unread`}/>}</button></li>)}</ul>}
   </aside>
   <div className="msg-convo">
    {!activeId?<p className="doubles-empty msg-empty">Select a conversation or start a new one.</p>:!convo||!other?<p role="status" className="doubles-empty">Opening…</p>:<>
     <header className="msg-convo-head"><Button variant="ghost" size="icon" className="msg-back" aria-label="Back to conversations" onClick={()=>{setActive(null);setConvo(null);void loadThreads().catch(()=>{});}}><ArrowLeft size={20}/></Button>
      <Avatar name={other.name} photoUrl={photo(other)}/><a className="msg-name" href={other.deleted?undefined:`${demo?'/demo':''}/players/${other.id}`}><b>{other.name}</b></a>
      {!other.deleted&&<details className="chat-menu"><summary aria-label="Conversation options"><MoreHorizontal size={18}/></summary><div>
       <button type="button" onClick={()=>{if(window.confirm(`Block ${other.name}? They will not be able to message you and this conversation will be hidden. You can unblock them any time.`))void act({action:'block',personId:other.id,blocked:true},`${other.name} is blocked.`,()=>{setActive(null);setConvo(null);if(demo){const l=local.current!;l.threads=l.threads.filter(t=>t.other.id!==other.id);}void loadThreads().catch(()=>{});});}}><Ban size={14}/>Block</button>
       <button type="button" onClick={()=>{const reason=window.prompt(`Why are you reporting ${other.name}? (optional)`);if(reason!==null)void act({action:'report_user',personId:other.id,reason},'Thanks. A Rally administrator will review your report.');}}><Flag size={14}/>Report person</button>
      </div></details>}</header>
     <div className="msg-scroll" ref={list} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} role="log" aria-live="polite" aria-label={`Conversation with ${other.name}`}>
      {convo.messages.length===0?<div className="dm-empty"><Avatar name={other.name} photoUrl={photo(other)} large/><b>{other.name}</b><p>Say hello to start the conversation.</p></div>:convo.messages.map((m,i)=>{
       const prev=convo.messages[i-1],next=convo.messages[i+1],showTime=!prev||gap(prev.createdAt,m.createdAt)>3600000,startsGroup=showTime||prev.mine!==m.mine||gap(prev.createdAt,m.createdAt)>300000,endsGroup=!next||next.mine!==m.mine||gap(m.createdAt,next.createdAt)>300000||gap(m.createdAt,next.createdAt)>3600000;
       return <div key={m.id} className={`dm-row${m.mine?' is-mine':''}${startsGroup?' starts':''}${endsGroup?' ends':''}`}>
        {showTime&&<div className="dm-time">{stamp(m.createdAt)}</div>}
        <div className="dm-line">{!m.mine&&<span className="dm-avatar">{endsGroup&&<Avatar name={other.name} photoUrl={photo(other)}/>}</span>}
         <div className={`dm-bubble${m.media&&!m.body?' media-only':''}`} title={stamp(m.createdAt)}>{m.media&&<MediaView kind={m.media.kind} src={(m.media as LocalMedia).src??`/api/messages/media/${m.media.id}`} onSize={()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;}}/>}{m.body&&<span className="dm-text">{m.body}</span>}</div>
         <details className="chat-menu dm-menu"><summary aria-label="Message options"><MoreHorizontal size={16}/></summary><div>
          {m.mine?<button type="button" onClick={()=>void act({action:'delete',id:m.id},'Message deleted.',()=>setConvo(c=>c?{...c,messages:c.messages.filter(x=>x.id!==m.id)}:c))}><Trash2 size={14}/>Unsend</button>
           :<button type="button" onClick={()=>{const reason=window.prompt('What is wrong with this message? (optional)');if(reason!==null)void act({action:'report_dm',id:m.id,reason},'Reported. An administrator will see this message and the ones before it.');}}><Flag size={14}/>Report</button>}
         </div></details></div></div>;})}
     </div>
     {convo.canSend?<form className="dm-composer" onSubmit={e=>{e.preventDefault();void send()}}>{attachment&&<AttachmentPreview attachment={attachment} onRemove={()=>setAttachment(null)}/>}<div className="dm-pill"><input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={e=>void attach(e.target.files?.[0])}/><button type="button" className="dm-attach" aria-label="Attach a photo or video" disabled={uploading||!!attachment} onClick={()=>fileInput.current?.click()}><Paperclip size={20}/></button><textarea value={text} maxLength={2000} rows={1} placeholder={uploading?'Uploading…':'Message…'} aria-label="Message" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!/Mobi|Android/i.test(navigator.userAgent)){e.preventDefault();void send();}}}/><button type="submit" className="dm-send" disabled={sending||uploading||(!text.trim()&&!attachment)}>Send</button></div></form>
      :<p className="chat-muted">You can no longer message this person. You still have this conversation.</p>}
    </>}
   </div>
  </div>
  <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogHeader><DialogTitle>New message</DialogTitle><DialogDescription>You can message people who share a club with you.</DialogDescription></DialogHeader>
   <label className="msg-search"><Search size={16}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name" aria-label="Search people"/></label>
   <ul className="msg-results">{query.trim().length<2?<li className="doubles-empty">Type at least two letters.</li>:searching&&!results.length?<li className="doubles-empty">Searching…</li>:results.length?results.map(p=><li key={p.id}><button type="button" onClick={()=>{setNewOpen(false);void startWith(p.id);}}><Avatar name={p.name} photoUrl={photo(p)}/><span><b>{p.name}</b>{!!p.clubs?.length&&<small>{p.clubs.join(', ')}</small>}</span></button></li>):<li className="doubles-empty">No one found. You can only message people who share a club with you.</li>}</ul>
  </DialogContent></Dialog>
  <Dialog open={showBlocks} onOpenChange={setShowBlocks}><DialogContent><DialogHeader><DialogTitle>Blocked people</DialogTitle><DialogDescription>Blocked people cannot message you, and you will not see their messages in clubs or conversations.</DialogDescription></DialogHeader>
   <ul className="msg-results">{blocked===null?<li className="doubles-empty">Loading…</li>:!blocked.length?<li className="doubles-empty">You have not blocked anyone.</li>:blocked.map(p=><li key={p.id}><div className="msg-block-row"><Avatar name={p.name} photoUrl={photo(p)}/><b>{p.name}</b><Button size="sm" variant="outline" onClick={()=>void act({action:'block',personId:p.id,blocked:false},`${p.name} is unblocked.`,()=>{setBlocked(b=>b?.filter(x=>x.id!==p.id)??null);void loadThreads().catch(()=>{});})}>Unblock</Button></div></li>)}</ul>
  </DialogContent></Dialog>
  <Dialog open={showReports} onOpenChange={setShowReports}><DialogContent><DialogHeader><DialogTitle>Safety reports</DialogTitle><DialogDescription>Reports from people about messages and profiles. Only Rally administrators see this.</DialogDescription></DialogHeader>
   <div className="chat-reports">{reports===null?<p className="doubles-empty">Loading…</p>:!reports.length?<p className="doubles-empty">No open reports.</p>:reports.map(r=><div key={r.id} className="chat-report"><p><b>{r.kind==='dm'?'Message':r.kind==='room'?'Leader room message':'Profile'} report</b> · {r.target}</p><small>Reported by {r.reporter}{r.reason?` · “${r.reason}”`:''}</small>
    {r.context.map((c,i)=><p key={i} className="msg-context"><b>{c.author_name}:</b> {c.body}</p>)}
    <div><Button size="sm" variant="outline" onClick={()=>void act({action:'resolve_report',id:r.id},'Report closed.',()=>setReports(p=>p?.filter(x=>x.id!==r.id)??null))}>Mark reviewed</Button></div></div>)}</div>
  </DialogContent></Dialog>
 </div>
 </section>;
}
