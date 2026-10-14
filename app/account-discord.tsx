'use client';
import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
async function call(init?:RequestInit,query=''){
 const r=await fetch('/api/discord'+query,{cache:'no-store',...init}),b=await r.json().catch(()=>({})) as {error?:string;connected?:boolean;avatar?:boolean;code?:string};
 if(!r.ok)throw new Error(b.error||'Could not reach Discord.');return b;
}
// Account > Discord: connect your Discord account so messages you send in linked club channels show your Rally name.
export default function AccountDiscord(){
 const [connected,setConnected]=useState<boolean|null>(null),[avatar,setAvatar]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{call(undefined,'?account=1').then(b=>{setConnected(!!b.connected);setAvatar(!!b.avatar);}).catch(()=>setConnected(null));},[]);
 async function toggleAvatar(on:boolean){
  setAvatar(on);
  try{await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'avatar',on})});}catch(e){setAvatar(!on);toast.error(e instanceof Error?e.message:'Could not save.');}
 }
 async function act(action:'connect_code'|'disconnect'){
  setBusy(true);
  try{const b=await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});if(action==='connect_code')setCode(b.code??'');else{setConnected(false);setCode('');toast.success('Discord disconnected.');}}
  catch(e){toast.error(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}
 }
 if(connected===null)return null;
 return <section id="discord" className="account-discord"><h2>Discord</h2>
  {connected?<><p>Your Discord account is connected. Messages you send in a linked club channel show your Rally name.</p><Button variant="outline" disabled={busy} onClick={()=>void act('disconnect')}>Disconnect Discord</Button></>
  :code?<><p>In a Discord server with the Rally bot, run <code>/club connect</code> and enter this code. It works for 15 minutes.</p><p><b className="discord-code">{code}</b></p><Button variant="outline" onClick={()=>{setCode('');void call(undefined,'?account=1').then(b=>setConnected(!!b.connected)).catch(()=>{});}}>Done</Button></>
  :<><p>Connect your Discord account so your messages in linked club channels show your Rally name.</p><Button disabled={busy} onClick={()=>void act('connect_code')}>Connect Discord</Button></>}
 <label className="discord-announce"><input type="checkbox" checked={avatar} onChange={e=>void toggleAvatar(e.target.checked)}/> Show my Rally profile photo as my avatar when my club chat messages are posted to Discord. Discord fetches and keeps a copy of the photo, and messages already posted keep it if you turn this off.</label>
 </section>;
}
