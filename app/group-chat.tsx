'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Bell,BellOff,Flag,MoreHorizontal,Paperclip,Search,Trash2,Users} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import Avatar from './player-avatar';
import {AttachmentPreview,MediaView,prepareAttachment,type Attachment} from './chat-attach';
import {demoGroups,type RoomDetail} from './demo-groups';
import type {RoomMessage} from '@/lib/rooms';
type LocalMedia={id:string;kind:'image'|'video';contentType:string;bytes:number;src?:string};
type Found={id:string;name:string;photoVersion:string|null;clubs:string[]};
const stamp=(iso:string)=>{const d=new Date(iso),now=new Date(),t=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),day=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()-new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime())/86400000);return day===0?`Today ${t}`:day===1?`Yesterday ${t}`:day<7?`${d.toLocaleDateString('en-US',{weekday:'long'})} ${t}`:`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}, ${t}`;};
const gap=(a:string,b:string)=>Math.abs(Date.parse(b)-Date.parse(a));
export async function roomApi(payload:Record<string,unknown>){
 const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not complete that.');return body;
}
const photo=(p:{id:string;photoVersion:string|null})=>p.photoVersion?`/api/players/${p.id}/photo?v=${encodeURIComponent(p.photoVersion)}`:undefined;
// One group chat: messages, photos and videos, members and invitations. The chat list lives in the parent.
export default function GroupChat({roomId,demo=false,onBack,onChanged,onClosed}:{roomId:string;demo?:boolean;onBack:()=>void;onChanged:()=>void;onClosed:()=>void}){
 const [detail,setDetail]=useState<RoomDetail|null>(null),[text,setText]=useState(''),[sending,setSending]=useState(false),[attachment,setAttachment]=useState<Attachment|null>(null),[uploading,setUploading]=useState(false),[showMembers,setShowMembers]=useState(false),[query,setQuery]=useState(''),[found,setFound]=useState<Found[]>([]);
 const list=useRef<HTMLDivElement>(null),stick=useRef(true),meRef=useRef(demo?'alex':''),ownerRef=useRef(false),fileInput=useRef<HTMLInputElement>(null);
 const open=useCallback(async()=>{
  stick.current=true;setDetail(null);setAttachment(null);
  try{
   if(demo){const d=demoGroups.details[roomId]??null;setDetail(d);demoGroups.rooms=demoGroups.rooms.map(r=>r.id===roomId?{...r,unread:0}:r);onChanged();return;}
   const r=await fetch('/api/rooms?room='+encodeURIComponent(roomId),{cache:'no-store'}),b=await r.json() as RoomDetail&{error?:string};if(!r.ok)throw new Error(b.error||'Could not open this chat.');
   meRef.current=b.me;setDetail(b);void roomApi({action:'read',roomId}).then(onChanged).catch(()=>{});
  }catch(e){toast.error(e instanceof Error?e.message:'Could not open this chat.');onClosed();}
 },[demo,roomId,onChanged,onClosed]);
 useEffect(()=>{void open();},[open]);
 useEffect(()=>{ownerRef.current=!!detail?.room.owner;},[detail]);
 // Live messages for this chat, with a catch-up if the connection drops.
 useEffect(()=>{
  if(demo)return;
  let ws:WebSocket|null=null,closed=false,retry=0,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{fetch('/api/rooms?room='+encodeURIComponent(roomId),{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<RoomDetail>:null).then(b=>{if(b&&!closed)setDetail(b);}).catch(()=>{});};
  const connect=()=>{if(closed)return;ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/chat/ws?room=${encodeURIComponent(roomId)}`);
   ws.onopen=()=>{retry=0;};
   ws.onmessage=e=>{try{const ev=JSON.parse(String(e.data)) as {type:string;message?:RoomMessage;id?:string};
    if(ev.type==='message'&&ev.message){const m={...ev.message,mine:ev.message.authorId===meRef.current,canDelete:ownerRef.current||ev.message.authorId===meRef.current};setDetail(d=>d&&!d.messages.some(x=>x.id===m.id)?{...d,messages:[...d.messages,m]}:d);void roomApi({action:'read',roomId}).catch(()=>{});onChanged();}
    else if(ev.type==='delete'&&ev.id)setDetail(d=>d?{...d,messages:d.messages.filter(x=>x.id!==ev.id)}:d);}catch{/* ignore malformed events */}};
   ws.onclose=()=>{if(!closed){timer=setTimeout(()=>{refresh();connect();},Math.min(30000,1000*2**retry++));}};ws.onerror=()=>ws?.close();};
  connect();return()=>{closed=true;clearTimeout(timer);ws?.close();};
 },[demo,roomId,onChanged]);
 useEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[detail]);
 useEffect(()=>{if(!showMembers||!detail?.room.owner)return;const q=query.trim();if(q.length<2){setFound([]);return;}
  if(demo){setFound([{id:'taylor',name:'Taylor Park',photoVersion:null,clubs:['Metro Table Tennis']}].filter(p=>p.name.toLowerCase().includes(q.toLowerCase())));return;}
  const t=setTimeout(()=>{fetch(`/api/rooms?room=${encodeURIComponent(roomId)}&lookup=${encodeURIComponent(q)}`,{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{people?:Found[]}>:{people:[]}).then(b=>setFound(b.people??[])).catch(()=>setFound([]));},250);return()=>clearTimeout(t);},[query,showMembers,detail,demo,roomId]);
 const act=async(payload:Record<string,unknown>,done:string,after?:()=>void)=>{try{if(!demo)await roomApi(payload);toast.success(demo?done+' Sample data only.':done);after?.();}catch(e){toast.error(e instanceof Error?e.message:'Could not complete that.');}};
 async function attach(f:File|undefined){if(!f)return;if(fileInput.current)fileInput.current.value='';setUploading(true);try{setAttachment(await prepareAttachment(f,'/api/rooms/media?room='+encodeURIComponent(roomId),demo));}catch(e){toast.error(e instanceof Error?e.message:'The upload failed.');}finally{setUploading(false);}}
 async function send(){
  const body=text.trim();if((!body&&!attachment)||!detail||sending||uploading)return;setSending(true);const clientId=crypto.randomUUID();
  try{
   if(demo){const m:RoomMessage={id:'m-'+clientId,roomId,authorId:'alex',authorName:'Alex Morgan',body,createdAt:new Date().toISOString(),media:attachment?{id:attachment.id,kind:attachment.kind,contentType:attachment.contentType,bytes:attachment.bytes,src:attachment.preview} as LocalMedia as RoomMessage['media']:null,mine:true,canDelete:true};
    demoGroups.details[roomId]={...demoGroups.details[roomId],messages:[...demoGroups.details[roomId].messages,m]};demoGroups.rooms=demoGroups.rooms.map(r=>r.id===roomId?{...r,lastMessage:body||'Photo',lastAt:m.createdAt}:r);setDetail(demoGroups.details[roomId]);setText('');setAttachment(null);stick.current=true;onChanged();return;}
   const r=await roomApi({action:'send',roomId,text:body,mediaId:attachment?.id,clientId}) as {message:RoomMessage};
   stick.current=true;setDetail(d=>d&&!d.messages.some(x=>x.id===r.message.id)?{...d,messages:[...d.messages,{...r.message,mine:true}]}:d);setText('');setAttachment(null);onChanged();
  }catch(e){toast.error(e instanceof Error?e.message:'Could not send that.');}finally{setSending(false);}
 }
 const room=detail?.room;
 if(!detail||!room)return <p role="status" className="doubles-empty">Opening…</p>;
 const active=detail.members.filter(m=>m.status==='active');
 return <>
  <header className="msg-convo-head"><Button variant="ghost" size="icon" className="msg-back" aria-label="Back to chats" onClick={onBack}><ArrowLeft size={20}/></Button>
   <span className="room-icon" aria-hidden="true"><Users size={18}/></span><button type="button" className="msg-name room-title" onClick={()=>setShowMembers(true)}><b>{room.name}</b><small>{active.length} members</small></button>
   <Button variant="ghost" size="icon" aria-label={room.notify?'Turn off chat alerts':'Turn on chat alerts'} aria-pressed={room.notify} onClick={()=>void act({action:'notify',roomId,on:!room.notify},room.notify?'Chat alerts off.':'Chat alerts on.',()=>{if(demo)demoGroups.details[roomId].room.notify=!room.notify;setDetail(d=>d?{...d,room:{...d.room,notify:!room.notify}}:d);})}>{room.notify?<Bell size={18}/>:<BellOff size={18}/>}</Button>
   <details className="chat-menu"><summary aria-label="Chat options"><MoreHorizontal size={18}/></summary><div>
    <button type="button" onClick={()=>setShowMembers(true)}><Users size={14}/>Members</button>
    {room.owner&&<button type="button" onClick={()=>{const n=window.prompt('Chat name',room.name);if(n&&n.trim())void act({action:'update',roomId,name:n,description:''},'Chat renamed.',()=>{if(demo){demoGroups.details[roomId].room.name=n.trim();demoGroups.rooms=demoGroups.rooms.map(r=>r.id===roomId?{...r,name:n.trim()}:r);}setDetail(d=>d?{...d,room:{...d.room,name:n.trim()}}:d);onChanged();});}}>Rename</button>}
    {room.owner&&<button type="button" onClick={()=>{if(window.confirm('Archive this chat? Members will no longer see it.'))void act({action:'update',roomId,archived:true},'Chat archived.',()=>{if(demo)demoGroups.rooms=demoGroups.rooms.filter(r=>r.id!==roomId);onChanged();onClosed();});}}>Archive chat</button>}
    <button type="button" onClick={()=>{if(window.confirm('Leave this chat?'))void act({action:'leave',roomId},'You left the chat.',()=>{if(demo)demoGroups.rooms=demoGroups.rooms.filter(r=>r.id!==roomId);onChanged();onClosed();});}}>Leave chat</button>
   </div></details></header>
  <div className="msg-scroll" ref={list} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} role="log" aria-live="polite" aria-label={`${room.name} messages`}>
   {detail.messages.length===0?<div className="dm-empty"><span className="room-icon big" aria-hidden="true"><Users size={32}/></span><b>{room.name}</b><p>No messages yet. Say hello.</p></div>:detail.messages.map((m,i)=>{
    const prev=detail.messages[i-1],next=detail.messages[i+1],showTime=!prev||gap(prev.createdAt,m.createdAt)>3600000,sameAsPrev=!!prev&&prev.authorId===m.authorId&&prev.mine===m.mine&&!showTime&&gap(prev.createdAt,m.createdAt)<=300000,startsGroup=!sameAsPrev,endsGroup=!next||next.authorId!==m.authorId||gap(m.createdAt,next.createdAt)>300000;
    return <div key={m.id} className={`dm-row${m.mine?' is-mine':''}${startsGroup?' starts':''}${endsGroup?' ends':''}`}>
     {showTime&&<div className="dm-time">{stamp(m.createdAt)}</div>}
     {startsGroup&&!m.mine&&<div className="dm-author">{m.authorName}</div>}
     <div className="dm-line">{!m.mine&&<span className="dm-avatar">{endsGroup&&<Avatar name={m.authorName} photoUrl={undefined}/>}</span>}
      <div className={`dm-bubble${m.media&&!m.body?' media-only':''}`} title={stamp(m.createdAt)}>{m.media&&<MediaView kind={m.media.kind} src={(m.media as LocalMedia).src??`/api/rooms/media/${m.media.id}`} onSize={()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;}}/>}{m.body&&<span className="dm-text">{m.body}</span>}</div>
      <details className="chat-menu dm-menu"><summary aria-label="Message options"><MoreHorizontal size={16}/></summary><div>
       {m.canDelete&&<button type="button" onClick={()=>void act({action:'delete',id:m.id},'Message deleted.',()=>setDetail(d=>d?{...d,messages:d.messages.filter(x=>x.id!==m.id)}:d))}><Trash2 size={14}/>{m.mine?'Unsend':'Delete'}</button>}
       {!m.mine&&<button type="button" onClick={()=>{const reason=window.prompt('What is wrong with this message? (optional)');if(reason!==null)void act({action:'report',id:m.id,reason},'Reported. A Rally administrator will see this message and the ones before it.');}}><Flag size={14}/>Report</button>}
      </div></details></div></div>;})}
  </div>
  {room.archived?<p className="chat-muted">This chat is archived.</p>:<form className="dm-composer" onSubmit={e=>{e.preventDefault();void send()}}>{attachment&&<AttachmentPreview attachment={attachment} onRemove={()=>setAttachment(null)}/>}<div className="dm-pill"><input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={e=>void attach(e.target.files?.[0])}/><button type="button" className="dm-attach" aria-label="Attach a photo or video" disabled={uploading||!!attachment} onClick={()=>fileInput.current?.click()}><Paperclip size={20}/></button><textarea value={text} maxLength={2000} rows={1} placeholder={uploading?'Uploading…':'Message…'} aria-label="Message" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!/Mobi|Android/i.test(navigator.userAgent)){e.preventDefault();void send();}}}/><button type="submit" className="dm-send" disabled={sending||uploading||(!text.trim()&&!attachment)}>Send</button></div></form>}
  <Dialog open={showMembers} onOpenChange={o=>{setShowMembers(o);if(!o){setQuery('');setFound([]);}}}><DialogContent><DialogHeader><DialogTitle>{room.name}</DialogTitle><DialogDescription>{room.owner?'Invite people who share a club with you. Club organizers and board members can also invite leaders from other clubs.':'People in this chat.'}</DialogDescription></DialogHeader>
   {room.owner&&<><label className="msg-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Add people by name" aria-label="Add people"/></label>
    {query.trim().length>=2&&<ul className="msg-results">{found.length?found.map(p=><li key={p.id}><button type="button" onClick={()=>void act({action:'invite',roomId,personId:p.id},`${p.name} was invited.`,()=>{setQuery('');setFound([]);if(demo)setDetail(d=>d?{...d,members:[...d.members,{id:p.id,name:p.name,role:'member',status:'invited',photoVersion:null,clubs:p.clubs}]}:d);})}><Avatar name={p.name} photoUrl={photo(p)}/><span><b>{p.name}</b>{!!p.clubs.length&&<small>{p.clubs.join(', ')}</small>}</span></button></li>):<li className="doubles-empty">No one found by that name.</li>}</ul>}</>}
   <ul className="msg-results">{detail.members.map(m=><li key={m.id}><div className="msg-block-row"><Avatar name={m.name} photoUrl={photo(m)}/><span><b>{m.name}</b>{m.role==='owner'?' · owner':m.status==='invited'?' · invited':''}<small>{m.clubs.join(', ')}</small></span>{room.owner&&m.id!==detail.me&&<Button size="sm" variant="outline" onClick={()=>void act({action:'remove',roomId,personId:m.id},`${m.name} was removed.`,()=>setDetail(d=>d?{...d,members:d.members.filter(x=>x.id!==m.id)}:d))}>Remove</Button>}</div></li>)}</ul>
  </DialogContent></Dialog>
 </>;
}
