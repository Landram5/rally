'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Bell,BellOff,Flag,MoreHorizontal,Paperclip,Plus,Search,Send,Trash2,Users} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import Avatar from './player-avatar';
import {AttachmentPreview,MediaView,prepareAttachment,type Attachment} from './chat-attach';
import type {RoomMember,RoomMessage} from '@/lib/rooms';
type RoomItem={id:string;name:string;description:string;role:'owner'|'member';members:number;lastMessage:string;lastAt:string;unread:number;notify:boolean;invitedBy:string|null};
type Detail={me:string;room:{id:string;name:string;archived:boolean;owner:boolean;notify:boolean};hasMore:boolean;messages:RoomMessage[];members:RoomMember[]};
type LocalMedia={id:string;kind:'image'|'video';contentType:string;bytes:number;src?:string};
type Found={id:string;name:string;photoVersion:string|null;clubs:string[]};
const when=(iso:string)=>{if(!iso)return '';const d=new Date(iso),now=new Date();return d.toDateString()===now.toDateString()?d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
async function api(payload:Record<string,unknown>){
 const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not complete that.');return body;
}
const photo=(p:{id:string;photoVersion:string|null})=>p.photoVersion?`/api/players/${p.id}/photo?v=${encodeURIComponent(p.photoVersion)}`:undefined;
const ago=(m:number)=>new Date(Date.now()-m*60000).toISOString();
// Sample rooms for the demo: nothing is sent anywhere.
const demoRooms=():{rooms:RoomItem[];invitations:RoomItem[];details:Record<string,Detail>}=>{
 const members:RoomMember[]=[{id:'alex',name:'Alex Morgan',role:'owner',status:'active',photoVersion:null,clubs:['Harbor Table Tennis','Metro Table Tennis']},{id:'casey',name:'Casey Brooks',role:'member',status:'active',photoVersion:null,clubs:['Metro Table Tennis']},{id:'jamie',name:'Jamie Patel',role:'member',status:'active',photoVersion:null,clubs:['Campus Table Tennis']}];
 const m=(id:string,a:string,body:string,min:number):RoomMessage=>({id,roomId:'r1',authorId:a,authorName:members.find(x=>x.id===a)!.name,body,createdAt:ago(min),media:null,mine:a==='alex',canDelete:true});
 const msgs=[m('x1','casey','Can we align on league nights for November? Metro has Tuesdays free.',300),m('x2','jamie','Campus can do Wednesdays. Happy to host the first joint night.',240),m('x3','alex','Great. I will draft a schedule and share it here.',60)];
 const base={description:'',role:'owner' as const,notify:false,invitedBy:null};
 return {rooms:[{...base,id:'r1',name:'Maryland league leaders',description:'Scheduling and joint events',members:3,lastMessage:msgs[2].body,lastAt:msgs[2].createdAt,unread:1}],invitations:[{...base,id:'r2',name:'Tournament directors',role:'member',members:5,lastMessage:'',lastAt:'',unread:0,invitedBy:'Taylor Park'}],
  details:{r1:{me:'alex',room:{id:'r1',name:'Maryland league leaders',archived:false,owner:true,notify:false},hasMore:false,messages:msgs,members}}};
};
export default function LeaderRooms({demo=false,initialRoom,onCounts}:{demo?:boolean;initialRoom?:string;onCounts?:(unread:number,invites:number)=>void}){
 const [rooms,setRooms]=useState<RoomItem[]>([]),[invites,setInvites]=useState<RoomItem[]>([]),[leader,setLeader]=useState(true),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [activeId,setActiveId]=useState<string|null>(null),[detail,setDetail]=useState<Detail|null>(null),[text,setText]=useState(''),[sending,setSending]=useState(false),[attachment,setAttachment]=useState<Attachment|null>(null),[uploading,setUploading]=useState(false);
 const [newOpen,setNewOpen]=useState(false),[name,setName]=useState(''),[desc,setDesc]=useState(''),[showMembers,setShowMembers]=useState(false),[query,setQuery]=useState(''),[found,setFound]=useState<Found[]>([]);
 const local=useRef(demo?demoRooms():null),list=useRef<HTMLDivElement>(null),stick=useRef(true),activeRef=useRef<string|null>(null),meRef=useRef(demo?'alex':''),fileInput=useRef<HTMLInputElement>(null),detailOwner=useRef(false);
 const setActive=useCallback((id:string|null)=>{activeRef.current=id;setActiveId(id);},[]);
 const loadRooms=useCallback(async()=>{
  if(demo){const l=local.current!;setRooms([...l.rooms]);setInvites([...l.invitations]);onCounts?.(l.rooms.reduce((n,r)=>n+r.unread,0),l.invitations.length);return;}
  const r=await fetch('/api/rooms',{cache:'no-store'}),b=await r.json() as {error?:string;leader:boolean;rooms:RoomItem[];invitations:RoomItem[]};
  if(!r.ok)throw new Error(b.error||'Could not load leader rooms.');setLeader(b.leader);setRooms(b.rooms);setInvites(b.invitations);onCounts?.(b.rooms.reduce((n,x)=>n+x.unread,0),b.invitations.length);
 },[demo,onCounts]);
 const openRoom=useCallback(async(id:string)=>{
  setActive(id);stick.current=true;setDetail(null);setAttachment(null);
  try{
   if(demo){const l=local.current!;setDetail(l.details[id]??null);l.rooms=l.rooms.map(r=>r.id===id?{...r,unread:0}:r);await loadRooms();return;}
   const r=await fetch('/api/rooms?room='+encodeURIComponent(id),{cache:'no-store'}),b=await r.json() as Detail&{error?:string};if(!r.ok)throw new Error(b.error||'Could not open this room.');
   meRef.current=b.me;setDetail(b);void api({action:'read',roomId:id}).then(()=>loadRooms()).catch(()=>{});
  }catch(e){toast.error(e instanceof Error?e.message:'Could not open this room.');setActive(null);}
 },[demo,loadRooms,setActive]);
 useEffect(()=>{let gone=false;loadRooms().then(()=>{if(!gone&&initialRoom)void openRoom(initialRoom);}).catch(e=>{if(!gone)setError(e instanceof Error?e.message:'Could not load leader rooms.')}).finally(()=>{if(!gone)setLoading(false)});return()=>{gone=true};},[]);// eslint-disable-line react-hooks/exhaustive-deps
 // Live updates for the open room, with a catch-up on reconnect.
 useEffect(()=>{
  if(demo||!activeId)return;
  let ws:WebSocket|null=null,closed=false,retry=0,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{fetch('/api/rooms?room='+encodeURIComponent(activeId),{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<Detail>:null).then(b=>{if(b&&activeRef.current===activeId)setDetail(b);}).catch(()=>{});};
  const connect=()=>{if(closed)return;ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/chat/ws?room=${encodeURIComponent(activeId)}`);
   ws.onopen=()=>{retry=0;};
   ws.onmessage=e=>{try{const ev=JSON.parse(String(e.data)) as {type:string;message?:RoomMessage;id?:string};
    if(ev.type==='message'&&ev.message){const m={...ev.message,mine:ev.message.authorId===meRef.current,canDelete:!!detailOwner.current||ev.message.authorId===meRef.current};setDetail(d=>d&&!d.messages.some(x=>x.id===m.id)?{...d,messages:[...d.messages,m]}:d);void api({action:'read',roomId:activeId}).catch(()=>{});void loadRooms().catch(()=>{});}
    else if(ev.type==='delete'&&ev.id)setDetail(d=>d?{...d,messages:d.messages.filter(x=>x.id!==ev.id)}:d);}catch{/* ignore malformed events */}};
   ws.onclose=()=>{if(!closed){timer=setTimeout(()=>{refresh();connect();},Math.min(30000,1000*2**retry++));}};ws.onerror=()=>ws?.close();};
  connect();return()=>{closed=true;clearTimeout(timer);ws?.close();};
 },[demo,activeId,loadRooms]);
 useEffect(()=>{detailOwner.current=!!detail?.room.owner;},[detail]);
 useEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[detail]);
 useEffect(()=>{if(!showMembers||!detail?.room.owner)return;const q=query.trim();if(q.length<2){setFound([]);return;}
  if(demo){setFound([{id:'taylor',name:'Taylor Park',photoVersion:null,clubs:['Metro Table Tennis']}].filter(p=>p.name.toLowerCase().includes(q.toLowerCase())));return;}
  const t=setTimeout(()=>{fetch(`/api/rooms?room=${encodeURIComponent(detail.room.id)}&lookup=${encodeURIComponent(q)}`,{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{people?:Found[]}>:{people:[]}).then(b=>setFound(b.people??[])).catch(()=>setFound([]));},250);return()=>clearTimeout(t);},[query,showMembers,detail,demo]);
 const act=async(payload:Record<string,unknown>,done:string,after?:()=>void)=>{try{if(!demo)await api(payload);toast.success(demo?done+' Sample data only.':done);after?.();}catch(e){toast.error(e instanceof Error?e.message:'Could not complete that.');}};
 async function attach(f:File|undefined){if(!f||!activeId)return;if(fileInput.current)fileInput.current.value='';setUploading(true);try{setAttachment(await prepareAttachment(f,'/api/rooms/media?room='+encodeURIComponent(activeId),demo));}catch(e){toast.error(e instanceof Error?e.message:'The upload failed.');}finally{setUploading(false);}}
 async function send(){
  const body=text.trim();if((!body&&!attachment)||!activeId||!detail||sending||uploading)return;setSending(true);const clientId=crypto.randomUUID();
  try{
   if(demo){const l=local.current!,m:RoomMessage={id:'m-'+clientId,roomId:activeId,authorId:'alex',authorName:'Alex Morgan',body,createdAt:new Date().toISOString(),media:attachment?{id:attachment.id,kind:attachment.kind,contentType:attachment.contentType,bytes:attachment.bytes,src:attachment.preview} as LocalMedia as RoomMessage['media']:null,mine:true,canDelete:true};
    l.details[activeId]={...l.details[activeId],messages:[...l.details[activeId].messages,m]};l.rooms=l.rooms.map(r=>r.id===activeId?{...r,lastMessage:body||'Photo',lastAt:m.createdAt}:r);setDetail(l.details[activeId]);setText('');setAttachment(null);stick.current=true;await loadRooms();return;}
   const r=await api({action:'send',roomId:activeId,text:body,mediaId:attachment?.id,clientId}) as {message:RoomMessage};
   stick.current=true;setDetail(d=>d&&!d.messages.some(x=>x.id===r.message.id)?{...d,messages:[...d.messages,{...r.message,mine:true}]}:d);setText('');setAttachment(null);void loadRooms().catch(()=>{});
  }catch(e){toast.error(e instanceof Error?e.message:'Could not send that.');}finally{setSending(false);}
 }
 async function createRoom(){
  try{
   if(demo){const l=local.current!,id='r-'+Date.now(),item:RoomItem={id,name:name.trim(),description:desc.trim(),role:'owner',members:1,lastMessage:'',lastAt:'',unread:0,notify:false,invitedBy:null};l.rooms=[item,...l.rooms];l.details[id]={me:'alex',room:{id,name:item.name,archived:false,owner:true,notify:false},hasMore:false,messages:[],members:[{id:'alex',name:'Alex Morgan',role:'owner',status:'active',photoVersion:null,clubs:['Harbor Table Tennis']}]};setNewOpen(false);setName('');setDesc('');await openRoom(id);return;}
   const r=await api({action:'create',name,description:desc}) as {roomId:string};setNewOpen(false);setName('');setDesc('');await loadRooms();await openRoom(r.roomId);
  }catch(e){toast.error(e instanceof Error?e.message:'Could not create the room.');}
 }
 const room=detail?.room;
 if(!loading&&!leader&&!invites.length)return <p className="doubles-empty">Leader rooms are for club organizers and board members.</p>;
 return <div className={`msg-layout${activeId?' has-thread':''}`}>
  <aside className="msg-list" aria-label="Leader rooms">
   <div className="msg-list-head"><h2>Leader rooms</h2><div className="msg-tools">{leader&&<Button size="sm" onClick={()=>setNewOpen(true)}><Plus size={16}/>New</Button>}</div></div>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   {invites.length>0&&<div className="room-invites"><h3>Invitations</h3>{invites.map(i=><div key={i.id} className="room-invite"><span><b>{i.name}</b><small>Invited by {i.invitedBy??'a leader'}</small></span><span><Button size="sm" onClick={()=>void act({action:'respond',roomId:i.id,accept:true},'You joined the room.',()=>{if(demo){const l=local.current!;l.invitations=l.invitations.filter(x=>x.id!==i.id);l.rooms=[{...i,lastAt:new Date().toISOString()},...l.rooms];l.details[i.id]={me:'alex',room:{id:i.id,name:i.name,archived:false,owner:false,notify:false},hasMore:false,messages:[],members:[{id:'alex',name:'Alex Morgan',role:'member',status:'active',photoVersion:null,clubs:[]},{id:'taylor',name:i.invitedBy??'Taylor Park',role:'owner',status:'active',photoVersion:null,clubs:[]}]};}void loadRooms().catch(()=>{});})}>Join</Button><Button size="sm" variant="ghost" onClick={()=>void act({action:'respond',roomId:i.id,accept:false},'Invitation declined.',()=>{if(demo){const l=local.current!;l.invitations=l.invitations.filter(x=>x.id!==i.id);}void loadRooms().catch(()=>{});})}>Decline</Button></span></div>)}</div>}
   {loading?<p role="status" className="doubles-empty">Loading rooms…</p>:!rooms.length?<p className="doubles-empty">No rooms yet. Create one and invite leaders from other clubs.</p>:<ul>{rooms.map(r=><li key={r.id}><button type="button" className={`msg-thread${r.id===activeId?' is-active':''}`} onClick={()=>void openRoom(r.id)}>
    <span className="room-icon" aria-hidden="true"><Users size={18}/></span><span className="msg-thread-main"><b>{r.name}</b><small>{r.lastMessage||`${r.members} members`}</small></span><span className="msg-thread-meta"><time>{when(r.lastAt)}</time>{r.unread>0&&<span className="badge" aria-label={`${r.unread} unread`}>{r.unread}</span>}</span></button></li>)}</ul>}
  </aside>
  <div className="msg-convo">
   {!activeId?<p className="doubles-empty msg-empty">Select a room or create a new one.</p>:!detail||!room?<p role="status" className="doubles-empty">Opening…</p>:<>
    <header className="msg-convo-head"><Button variant="ghost" size="icon" className="msg-back" aria-label="Back to rooms" onClick={()=>{setActive(null);setDetail(null);void loadRooms().catch(()=>{});}}><ArrowLeft size={20}/></Button>
     <span className="room-icon" aria-hidden="true"><Users size={18}/></span><button type="button" className="msg-name room-title" onClick={()=>setShowMembers(true)}><b>{room.name}</b><small>{detail.members.filter(m=>m.status==='active').length} members</small></button>
     <Button variant="ghost" size="icon" aria-label={room.notify?'Turn off room alerts':'Turn on room alerts'} aria-pressed={room.notify} onClick={()=>void act({action:'notify',roomId:room.id,on:!room.notify},room.notify?'Room alerts off.':'Room alerts on.',()=>{if(demo){local.current!.details[room.id].room.notify=!room.notify;}setDetail(d=>d?{...d,room:{...d.room,notify:!room.notify}}:d);})}>{room.notify?<Bell size={18}/>:<BellOff size={18}/>}</Button>
     <details className="chat-menu"><summary aria-label="Room options"><MoreHorizontal size={18}/></summary><div>
      <button type="button" onClick={()=>setShowMembers(true)}><Users size={14}/>Members</button>
      {room.owner&&<button type="button" onClick={()=>{const n=window.prompt('Room name',room.name);if(n&&n.trim())void act({action:'update',roomId:room.id,name:n,description:''},'Room renamed.',()=>{setDetail(d=>d?{...d,room:{...d.room,name:n.trim()}}:d);void loadRooms().catch(()=>{});});}}>Rename</button>}
      {room.owner&&<button type="button" onClick={()=>{if(window.confirm('Archive this room? Members will no longer see it.'))void act({action:'update',roomId:room.id,archived:true},'Room archived.',()=>{setActive(null);setDetail(null);if(demo){const l=local.current!;l.rooms=l.rooms.filter(r=>r.id!==room.id);}void loadRooms().catch(()=>{});});}}>Archive room</button>}
      <button type="button" onClick={()=>{if(window.confirm('Leave this room?'))void act({action:'leave',roomId:room.id},'You left the room.',()=>{setActive(null);setDetail(null);if(demo){const l=local.current!;l.rooms=l.rooms.filter(r=>r.id!==room.id);}void loadRooms().catch(()=>{});});}}>Leave room</button>
     </div></details></header>
    <div className="msg-scroll" ref={list} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} role="log" aria-live="polite" aria-label={`${room.name} messages`}>
     {detail.messages.length===0?<p className="doubles-empty">No messages yet. Say hello to the other leaders.</p>:detail.messages.map(m=><article key={m.id} className={m.mine?'chat-msg is-mine':'chat-msg'}>
      <header><b className={m.authorId?'':'is-deleted'}>{m.mine?'You':m.authorName}</b><time dateTime={m.createdAt}>{when(m.createdAt)}</time><details className="chat-menu"><summary aria-label="Message options"><MoreHorizontal size={16}/></summary><div>
       {m.canDelete&&<button type="button" onClick={()=>void act({action:'delete',id:m.id},'Message deleted.',()=>setDetail(d=>d?{...d,messages:d.messages.filter(x=>x.id!==m.id)}:d))}><Trash2 size={14}/>Delete</button>}
       {!m.mine&&<button type="button" onClick={()=>{const reason=window.prompt('What is wrong with this message? (optional)');if(reason!==null)void act({action:'report',id:m.id,reason},'Reported. A Rally administrator will see this message and the ones before it.');}}><Flag size={14}/>Report</button>}
      </div></details></header>{m.body&&<p>{m.body}</p>}{m.media&&<MediaView kind={m.media.kind} src={(m.media as LocalMedia).src??`/api/rooms/media/${m.media.id}`} onSize={()=>{const el=list.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;}}/>}</article>)}
    </div>
    {room.archived?<p className="chat-muted">This room is archived.</p>:<form className="chat-composer" onSubmit={e=>{e.preventDefault();void send()}}>{attachment&&<AttachmentPreview attachment={attachment} onRemove={()=>setAttachment(null)}/>}<div className="chat-row"><input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={e=>void attach(e.target.files?.[0])}/><Button type="button" variant="ghost" size="icon" aria-label="Attach a photo or video" disabled={uploading||!!attachment} onClick={()=>fileInput.current?.click()}><Paperclip size={20}/></Button><textarea value={text} maxLength={2000} rows={1} placeholder={uploading?'Uploading…':`Message ${room.name}`} aria-label="Message" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!/Mobi|Android/i.test(navigator.userAgent)){e.preventDefault();void send();}}}/><Button disabled={sending||uploading||(!text.trim()&&!attachment)} aria-label="Send message"><Send size={18}/></Button></div></form>}
   </>}
  </div>
  <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogHeader><DialogTitle>New leader room</DialogTitle><DialogDescription>A private room for organizers and board members. You can invite leaders from any club after you create it.</DialogDescription></DialogHeader>
   <form className="form-stack" onSubmit={e=>{e.preventDefault();void createRoom()}}><label>Room name<input value={name} maxLength={80} required onChange={e=>setName(e.target.value)} placeholder="e.g. Regional league leaders"/></label><label>Description (optional)<input value={desc} maxLength={300} onChange={e=>setDesc(e.target.value)}/></label><Button disabled={!name.trim()}>Create room</Button></form>
  </DialogContent></Dialog>
  <Dialog open={showMembers} onOpenChange={o=>{setShowMembers(o);if(!o){setQuery('');setFound([]);}}}><DialogContent><DialogHeader><DialogTitle>{room?.name??'Members'}</DialogTitle><DialogDescription>Everyone here leads a club. People who stop leading a club lose access to leader rooms.</DialogDescription></DialogHeader>
   {room?.owner&&<><label className="msg-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Invite a leader by name" aria-label="Invite a leader"/></label>
    {query.trim().length>=2&&<ul className="msg-results">{found.length?found.map(p=><li key={p.id}><button type="button" onClick={()=>void act({action:'invite',roomId:room.id,personId:p.id},`${p.name} was invited.`,()=>{setQuery('');setFound([]);if(demo)setDetail(d=>d?{...d,members:[...d.members,{id:p.id,name:p.name,role:'member',status:'invited',photoVersion:null,clubs:p.clubs}]}:d);})}><Avatar name={p.name} photoUrl={photo(p)}/><span><b>{p.name}</b>{!!p.clubs.length&&<small>{p.clubs.join(', ')}</small>}</span></button></li>):<li className="doubles-empty">No leaders found by that name.</li>}</ul>}</>}
   <ul className="msg-results">{detail?.members.map(m=><li key={m.id}><div className="msg-block-row"><Avatar name={m.name} photoUrl={photo(m)}/><span><b>{m.name}</b>{m.role==='owner'?' · owner':m.status==='invited'?' · invited':''}<small>{m.clubs.join(', ')}</small></span>{room?.owner&&m.id!==detail.me&&<Button size="sm" variant="outline" onClick={()=>void act({action:'remove',roomId:room.id,personId:m.id},`${m.name} was removed.`,()=>setDetail(d=>d?{...d,members:d.members.filter(x=>x.id!==m.id)}:d))}>Remove</Button>}</div></li>)}</ul>
  </DialogContent></Dialog>
 </div>;
}
