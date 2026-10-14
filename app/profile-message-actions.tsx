'use client';
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-location-assign-relative-destination */
import {useEffect,useState} from 'react';
import {Ban,Flag,MessageCircle,MoreHorizontal} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
async function post(payload:Record<string,unknown>){
 const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(body.error||'Could not complete that.');return body;
}
// Message / block / report controls on someone else's player page. Hidden when signed out, for yourself, and when the two of you share no club.
export default function ProfileMessageActions({personId,name,demo=false}:{personId:string;name:string;demo?:boolean}){
 const [can,setCan]=useState(false),[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{
  if(demo){setCan(personId!=='alex'&&personId!=='riley'&&personId!=='visiting-guest');setSignedIn(true);return;}
  let live=true;fetch('/api/messages?can='+encodeURIComponent(personId),{cache:'no-store'}).then(async r=>{if(!live)return;if(!r.ok){setSignedIn(false);return;}setSignedIn(true);setCan(!!((await r.json()) as {canMessage?:boolean}).canMessage);}).catch(()=>{});
  return()=>{live=false};
 },[personId,demo]);
 if(!signedIn||(demo&&personId==='alex'))return null;
 const act=async(payload:Record<string,unknown>,done:string)=>{try{if(!demo)await post(payload);toast.success(demo?done+' Sample data only.':done);}catch(e){toast.error(e instanceof Error?e.message:'Could not complete that.');}};
 return <div className="profile-message-actions">
  {can&&<Button size="sm" onClick={()=>window.location.assign(`${demo?'/demo':'/clubhouse'}?tab=messages&with=${encodeURIComponent(personId)}`)}><MessageCircle size={16}/>Message</Button>}
  <details className="chat-menu"><summary aria-label={`More options for ${name}`}><MoreHorizontal size={18}/></summary><div>
   <button type="button" onClick={()=>{if(window.confirm(`Block ${name}? They will not be able to message you and you will not see their messages. You can unblock them in Messages.`))void act({action:'block',personId,blocked:true},`${name} is blocked.`);}}><Ban size={14}/>Block</button>
   <button type="button" onClick={()=>{const reason=window.prompt(`Why are you reporting ${name}? (optional)`);if(reason!==null)void act({action:'report_user',personId,reason},'Thanks. A Rally administrator will review your report.');}}><Flag size={14}/>Report</button>
  </div></details>
 </div>;
}
