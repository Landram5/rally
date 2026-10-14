'use client';
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,BellOff,Flag,MoreHorizontal,Paperclip,Send,Trash2,VolumeX,X} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import type {ChatMedia,ChatMessage} from '@/lib/chat';
type Report={id:string;messageId:string;reason:string;body:string;authorName:string;reporter:string;createdAt:string};
type Attachment=ChatMedia&{preview:string};
const MAX_VIDEO_SECONDS=35,MAX_VIDEO=50*1024*1024;
const time=(iso:string)=>new Date(iso).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const day=(iso:string)=>new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
async function api(payload:Record<string,unknown>){
 const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not complete that.');return body;
}
// Photos are shrunk on the phone before upload (max 1600px, JPEG); GIFs and small photos are sent as they are.
async function shrinkImage(file:File):Promise<Blob>{
 if(file.type==='image/gif'||file.size<400_000)return file;
 try{
  const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(res=>canvas.toBlob(res,'image/jpeg',0.82));return blob&&blob.size<file.size?blob:file;
 }catch{return file;}
}
function videoSeconds(file:File):Promise<number>{
 return new Promise(resolve=>{const v=document.createElement('video'),url=URL.createObjectURL(file);v.preload='metadata';v.onloadedmetadata=()=>{resolve(v.duration);URL.revokeObjectURL(url)};v.onerror=()=>{resolve(NaN);URL.revokeObjectURL(url)};v.src=url;});
}
function Media({m,onSize}:{m:LocalMedia;onSize:()=>void}){
 const src=m.src??`/api/chat/media/${m.id}`;
 return m.kind==='image'?<a href={src} target="_blank" rel="noreferrer"><img className="chat-media" src={src} alt="Shared photo" loading="lazy" onLoad={onSize}/></a>:<video className="chat-media" src={src} controls playsInline preload="metadata" onLoadedMetadata={onSize}/>;
}
type LocalMedia=ChatMedia&{src?:string};
const photo=(a:string,b:string)=>`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><circle cx="470" cy="150" r="46" fill="#fdb515"/><rect x="150" y="260" width="340" height="14" rx="7" fill="rgba(255,255,255,.7)"/></svg>`)}`;
// Sample chat for the demo: nothing is sent anywhere.
const demoSeed=(clubId:string):ChatMessage[]=>{const at=(m:number)=>new Date(Date.now()-m*60000).toISOString(),base={clubId,mine:false,canDelete:true};return [
 {...base,id:'d1',authorId:'jordan',authorName:'Jordan Lee',body:'Anyone up for doubles on Thursday? We have two tables booked until 9.',createdAt:at(190),media:null},
 {...base,id:'d2',authorId:'sam',authorName:'Sam Rivera',body:'In. Bringing the new paddle.',createdAt:at(172),media:null},
 {...base,id:'d3',authorId:null,authorName:'Deleted User (Riley Chen)',body:'Good luck on Thursday everyone.',createdAt:at(150),media:null},
 {...base,id:'d4',authorId:'jordan',authorName:'Jordan Lee',body:'Photo from last week’s round robin.',createdAt:at(95),media:{id:'demo-photo',kind:'image',contentType:'image/jpeg',bytes:1,src:photo('#1c352d','#4c7d63')} as LocalMedia},
 {...base,id:'d5',authorId:'alex',authorName:'Alex Morgan',body:'Nice. I will bring the score sheets.',createdAt:at(40),mine:true,media:null},
];};
export default function ClubChat({clubId,clubName,onRead,demo=false}:{clubId:string;clubName:string;onRead?:()=>void;demo?:boolean}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[me,setMe]=useState(''),[admin,setAdmin]=useState(false),[muted,setMuted]=useState(false),[notify,setNotify]=useState(false),[hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[live,setLive]=useState(false),[text,setText]=useState(''),[attachment,setAttachment]=useState<Attachment|null>(null),[uploading,setUploading]=useState(false),[sending,setSending]=useState(false);
 const [reports,setReports]=useState<Report[]|null>(null),[showReports,setShowReports]=useState(false);
 const list=useRef<HTMLDivElement>(null),stick=useRef(true),lastId=useRef(''),meRef=useRef(''),adminRef=useRef(false),file=useRef<HTMLInputElement>(null);
 const personal=useCallback((m:ChatMessage):ChatMessage=>({...m,mine:m.authorId!==null&&m.authorId===meRef.current,canDelete:adminRef.current||(m.authorId!==null&&m.authorId===meRef.current)}),[]);
 const known=useRef(new Set<string>()),[fresh,setFresh]=useState<Set<string>>(()=>new Set());
 const merge=useCallback((incoming:ChatMessage[],animate=true)=>{const added=incoming.filter(m=>!known.current.has(m.id)).map(m=>m.id);for(const m of incoming)known.current.add(m.id);if(animate&&added.length)setFresh(f=>new Set([...f,...added]));setMessages(prev=>{const seen=new Map(prev.map(m=>[m.id,m]));for(const m of incoming)seen.set(m.id,personal(m));const next=[...seen.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));lastId.current=next.filter(m=>!m.id.startsWith('pending-')).at(-1)?.id??'';return next;});},[personal]);
 const markRead=useCallback(()=>{if(!demo&&document.visibilityState==='visible'){void api({action:'read',clubId}).then(()=>onRead?.()).catch(()=>{});}},[clubId,onRead,demo]);
 const load=useCallback(async(opts:{before?:string;after?:string}={})=>{
  const q=new URLSearchParams({club:clubId,...(opts.before?{before:opts.before}:{}),...(opts.after?{after:opts.after}:{})});
  const r=await fetch('/api/chat?'+q,{cache:'no-store'}),body=await r.json() as {error?:string;me:string;messages:ChatMessage[];hasMore:boolean;admin:boolean;muted:boolean;notify:boolean};
  if(!r.ok)throw new Error(body.error||'Could not load the chat.');
  meRef.current=body.me;adminRef.current=body.admin;setMe(body.me);setAdmin(body.admin);setMuted(body.muted);setNotify(body.notify);
  return body;
 },[clubId]);
 useEffect(()=>{if(demo){meRef.current='alex';adminRef.current=true;setMe('alex');setAdmin(true);{const seed=demoSeed(clubId);seed.forEach(m=>known.current.add(m.id));setMessages(seed.map(personal));}setLive(true);setLoading(false);return;}let gone=false;setLoading(true);load().then(b=>{if(gone)return;b.messages.forEach(m=>known.current.add(m.id));setMessages(b.messages.map(personal));lastId.current=b.messages.at(-1)?.id??'';setHasMore(b.hasMore);setError('');markRead();}).catch(e=>{if(!gone)setError(e instanceof Error?e.message:'Could not load the chat.')}).finally(()=>{if(!gone)setLoading(false)});return()=>{gone=true};},[load,personal,markRead,demo,clubId]);
 // Live connection, with a polling fallback while it is down. Connections renew every 15 minutes (the server re-checks membership).
 useEffect(()=>{
  if(demo)return;
  let ws:WebSocket|null=null,closed=false,retry=0,timer:ReturnType<typeof setTimeout>|undefined;
  const catchUp=()=>{if(!lastId.current)return;void load({after:lastId.current}).then(b=>{if(b.messages.length){merge(b.messages);markRead();}}).catch(()=>{});};
  const connect=()=>{
   if(closed)return;
   ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/chat/ws?club=${encodeURIComponent(clubId)}`);
   ws.onopen=()=>{retry=0;setLive(true);catchUp();};
   ws.onmessage=e=>{try{const ev=JSON.parse(String(e.data)) as {type:string;message?:ChatMessage;id?:string};if(ev.type==='message'&&ev.message){merge([ev.message]);markRead();}else if(ev.type==='delete'&&ev.id)setMessages(p=>p.filter(m=>m.id!==ev.id));}catch{/* ignore malformed events */}};
   ws.onclose=()=>{setLive(false);if(!closed){timer=setTimeout(connect,Math.min(30000,1000*2**retry++));}};
   ws.onerror=()=>ws?.close();
  };
  connect();const poll=setInterval(()=>{if(!ws||ws.readyState!==WebSocket.OPEN)catchUp();},8000);
  const ping=setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send('ping');},30000);
  const visible=()=>{if(document.visibilityState==='visible'){catchUp();if(!ws||ws.readyState>1){clearTimeout(timer);connect();}}};
  document.addEventListener('visibilitychange',visible);
  return()=>{closed=true;clearTimeout(timer);clearInterval(poll);clearInterval(ping);document.removeEventListener('visibilitychange',visible);ws?.close();};
 },[clubId,load,merge,markRead,demo]);
 useEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[messages]);
 async function older(){if(demo||!messages.length)return;const el=list.current,before=el?.scrollHeight??0;try{const b=await load({before:messages[0].id});setHasMore(b.hasMore);stick.current=false;merge(b.messages,false);requestAnimationFrame(()=>{if(el)el.scrollTop=el.scrollHeight-before;});}catch(e){toast.error(e instanceof Error?e.message:'Could not load earlier messages.');}}
 async function attach(f:File|undefined){
  if(!f)return;if(file.current)file.current.value='';
  const isVideo=f.type.startsWith('video/'),isImage=f.type.startsWith('image/');
  if(!isVideo&&!isImage){toast.error('Choose a photo or a video.');return;}
  if(isVideo){if(f.size>MAX_VIDEO){toast.error('Videos can be up to 50 MB.');return;}const s=await videoSeconds(f);if(Number.isFinite(s)&&s>MAX_VIDEO_SECONDS){toast.error('Videos can be about 30 seconds long.');return;}}
  if(demo){const media:LocalMedia={id:'demo-'+Date.now(),kind:isVideo?'video':'image',contentType:f.type,bytes:f.size,src:URL.createObjectURL(f)};setAttachment({...media,preview:media.src!});return;}
  setUploading(true);
  try{
   const blob=isImage?await shrinkImage(f):f,r=await fetch('/api/chat/media?club='+encodeURIComponent(clubId),{method:'POST',body:blob}),body=await r.json() as ChatMedia&{error?:string};
   if(!r.ok)throw new Error(body.error||'The upload failed.');setAttachment({...body,preview:URL.createObjectURL(blob)});
  }catch(e){toast.error(e instanceof Error?e.message:'The upload failed.');}finally{setUploading(false);}
 }
 async function send(){
  const body=text.trim();if((!body&&!attachment)||sending||uploading||muted)return;
  const clientId=crypto.randomUUID(),mediaId=attachment?.id;setSending(true);
  if(demo){const mine:ChatMessage={id:'demo-'+clientId,clubId,authorId:'alex',authorName:'Alex Morgan',body,createdAt:new Date().toISOString(),mine:true,canDelete:true,media:attachment?{id:attachment.id,kind:attachment.kind,contentType:attachment.contentType,bytes:attachment.bytes,src:attachment.preview} as LocalMedia:null};
   stick.current=true;merge([mine]);setText('');setAttachment(null);setSending(false);
   setTimeout(()=>{merge([{id:'demo-reply-'+clientId,clubId,authorId:'jordan',authorName:'Jordan Lee',body:attachment?'Nice one!':'Got it. See you there.',createdAt:new Date().toISOString(),mine:false,canDelete:true,media:null}]);},1800);return;}
  try{const r=await api({action:'send',clubId,text:body,mediaId,clientId}) as {message:ChatMessage};stick.current=true;merge([r.message]);setText('');setAttachment(null);}
  catch(e){toast.error(e instanceof Error?e.message:'Could not send that.');}finally{setSending(false);}
 }
 const act=async(payload:Record<string,unknown>,done:string,after?:()=>void)=>{try{if(!demo)await api(payload);toast.success(done);after?.();}catch(e){toast.error(e instanceof Error?e.message:'Could not complete that.');}};
 async function openReports(){setShowReports(v=>!v);if(demo){setReports([{id:'r1',messageId:'d3',reason:'Off topic',body:'Good luck on Thursday everyone.',authorName:'Deleted User (Riley Chen)',reporter:'Sam Rivera',createdAt:new Date().toISOString()}]);return;}if(!showReports){try{const r=await fetch('/api/chat?reports=1&club='+encodeURIComponent(clubId),{cache:'no-store'}),b=await r.json() as {reports?:Report[];error?:string};if(!r.ok)throw new Error(b.error);setReports(b.reports??[]);}catch{toast.error('Could not load reports.');}}}
 let lastDay='';
 return <section className="panel club-chat" aria-label={`${clubName} chat`}>
  <div className="chat-head"><div><h2>Club chat</h2><p><span className={live?'chat-dot is-live':'chat-dot'} aria-hidden="true"/>{live?'Live':'Reconnecting…'} · members of {clubName} only</p></div>
   <div className="chat-tools"><Button variant="ghost" size="icon" aria-label={notify?'Turn off chat alerts':'Turn on chat alerts'} aria-pressed={notify} title={notify?'Alerts on':'Alerts off'} onClick={()=>void act({action:'notify',clubId,on:!notify},notify?'Chat alerts off.':'You will get an alert when members post while you are away.',()=>setNotify(!notify))}>{notify?<Bell size={18}/>:<BellOff size={18}/>}</Button>
    {admin&&<Button variant="outline" size="sm" onClick={()=>void openReports()}>Reports</Button>}</div></div>
  {showReports&&<div className="chat-reports">{reports?.length?reports.map(r=><div key={r.id} className="chat-report"><p><b>{r.authorName}</b>: {r.body||'Photo or video'}</p><small>Reported by {r.reporter}{r.reason?` · ${r.reason}`:''}</small><div><Button size="sm" variant="outline" onClick={()=>void act({action:'delete',id:r.messageId},'Message removed.',()=>{setMessages(p=>p.filter(m=>m.id!==r.messageId));setReports(p=>p?.filter(x=>x.id!==r.id)??null)})}>Remove message</Button><Button size="sm" variant="ghost" onClick={()=>void act({action:'resolve_report',id:r.id},'Report dismissed.',()=>setReports(p=>p?.filter(x=>x.id!==r.id)??null))}>Dismiss</Button></div></div>):<p className="doubles-empty">No open reports.</p>}</div>}
  {error&&<p className="auth-error" role="alert">{error}</p>}
  <div className="chat-list" ref={list} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} role="log" aria-live="polite" aria-label="Chat messages">
   {hasMore&&<Button variant="ghost" size="sm" className="chat-older" onClick={()=>void older()}>Load earlier messages</Button>}
   {loading?<p role="status" className="doubles-empty">Loading chat…</p>:!messages.length?<p className="doubles-empty">No messages yet. Say hello to the club.</p>:messages.map(m=>{const d=day(m.createdAt),sep=d!==lastDay;lastDay=d;return <div key={m.id}>
    {sep&&<div className="chat-day">{d}</div>}
    <article className={`chat-msg${m.mine?' is-mine':''}${fresh.has(m.id)?' is-new':''}`}>
     <header><b className={m.authorId?'':'is-deleted'}>{m.mine?'You':m.authorName}</b><time dateTime={m.createdAt}>{time(m.createdAt)}</time>
      {(m.canDelete||!m.mine)&&<details className="chat-menu"><summary aria-label="Message options"><MoreHorizontal size={16}/></summary><div>
       {m.canDelete&&<button type="button" onClick={()=>void act({action:'delete',id:m.id},'Message deleted.',()=>setMessages(p=>p.filter(x=>x.id!==m.id)))}><Trash2 size={14}/>Delete</button>}
       {!m.mine&&<button type="button" onClick={()=>{const reason=window.prompt('What is wrong with this message? (optional)')??null;if(reason!==null)void act({action:'report',id:m.id,reason},'Reported to the club organizers.');}}><Flag size={14}/>Report</button>}
       {admin&&!m.mine&&m.authorId&&<button type="button" onClick={()=>{if(window.confirm(`Mute ${m.authorName} in this chat?`))void act({action:'mute',clubId,playerId:m.authorId,muted:true},`${m.authorName} was muted.`);}}><VolumeX size={14}/>Mute member</button>}
      </div></details>}
     </header>
     {m.body&&<p>{m.body}</p>}{m.media&&<Media m={m.media} onSize={()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;}}/>}
    </article></div>;})}
  </div>
  {muted?<p className="chat-muted">An organizer has muted you in this chat. You can still read messages.</p>:<form className="chat-composer" onSubmit={e=>{e.preventDefault();void send()}}>
   {attachment&&<div className="chat-attachment">{attachment.kind==='image'?<img src={attachment.preview} alt="Attachment preview"/>:<video src={attachment.preview} muted playsInline/>}<Button type="button" size="icon" variant="ghost" aria-label="Remove attachment" onClick={()=>setAttachment(null)}><X size={16}/></Button></div>}
   <div className="chat-row"><input ref={file} type="file" accept="image/*,video/*" hidden onChange={e=>void attach(e.target.files?.[0])}/>
    <Button type="button" variant="ghost" size="icon" aria-label="Attach a photo or video" disabled={uploading||!!attachment} onClick={()=>file.current?.click()}><Paperclip size={20}/></Button>
    <textarea value={text} maxLength={2000} rows={1} placeholder={uploading?'Uploading…':'Message the club'} aria-label="Message" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!/Mobi|Android/i.test(navigator.userAgent)){e.preventDefault();void send();}}}/>
    <Button disabled={sending||uploading||(!text.trim()&&!attachment)} aria-label="Send message"><Send size={18}/></Button></div>
  </form>}
  {me?null:null}
 </section>;
}
