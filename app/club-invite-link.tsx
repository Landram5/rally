'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import QRCode from 'qrcode';
import {useCallback,useEffect,useState} from 'react';
import {Copy,Download,Share2} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import CleanSelect from './clean-select';
import type {InviteState} from '@/lib/club-invites';
async function call(init?:RequestInit,query=''){
 const r=await fetch('/api/invites'+query,{cache:'no-store',...init}),b=await r.json().catch(()=>({})) as {error?:string;invite?:InviteState};
 if(!r.ok)throw new Error(b.error||'Could not reach the invite link.');return b;
}
const when=(iso:string)=>new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
// Manage > Invite link: a link that adds people to the club straight away, without waiting for approval.
export default function ClubInviteLink({clubId,clubName,demo=false}:{clubId:string;clubName:string;demo?:boolean}){
 const [invite,setInvite]=useState<InviteState|undefined>(demo?{token:'SAMPLE-DEMO-LINK-xxxxx',createdAt:new Date().toISOString(),expiresAt:null,uses:3}:undefined),[days,setDays]=useState('7'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setInvite((await call(undefined,'?club='+encodeURIComponent(clubId))).invite??null);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load the invite link.');}},[clubId]);
 useEffect(()=>{if(!demo)void load();},[demo,load]);
 async function make(){
  if(invite&&!window.confirm('Make a new link? The current one will stop working.'))return;
  setBusy(true);setError('');
  try{if(demo){setInvite({token:'SAMPLE-DEMO-LINK-xxxxx',createdAt:new Date().toISOString(),expiresAt:days==='0'?null:new Date(Date.now()+Number(days)*86400000).toISOString(),uses:0});return;}setInvite((await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',clubId,days:Number(days)})})).invite??null);}
  catch(e){setError(e instanceof Error?e.message:'Could not make the link.');}finally{setBusy(false);}
 }
 async function turnOff(){
  if(!window.confirm('Turn off the invite link? People who have it will no longer be able to join with it.'))return;
  setBusy(true);setError('');
  try{if(!demo)await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',clubId})});setInvite(null);toast.success('Invite link turned off.');}
  catch(e){setError(e instanceof Error?e.message:'Could not turn it off.');}finally{setBusy(false);}
 }
 const url=invite?`${typeof window==='undefined'?'https://rallytt.net':window.location.origin}/join/${invite.token}`:'';
 let svg='',size=0,path='';
 if(invite){const qr=QRCode.create(url,{errorCorrectionLevel:'M'});size=qr.modules.size+8;path=Array.from(qr.modules.data).flatMap((dark,i)=>dark?[`M${i%qr.modules.size+4} ${Math.floor(i/qr.modules.size)+4}h1v1h-1z`]:[]).join('');svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;}
 async function copy(){try{await navigator.clipboard.writeText(url);toast.success('Invite link copied.');}catch{toast.error('Copy the link shown above.');}}
 async function share(){if(!navigator.share){await copy();return;}try{await navigator.share({title:`Join ${clubName} on Rally`,text:`Join ${clubName} on Rally.`,url});}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))await copy();}}
 return <section className="panel club-detail-section club-invite-link"><h2>Invite link</h2>
  <p>Anyone with this link joins the club right away, with no approval needed. Share it in your group chat or print the QR code. If it spreads further than you wanted, turn it off or make a new one.</p>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {invite===undefined?!error&&<p role="status">Loading…</p>
   :invite===null?<div className="invite-create"><label>Link works for<CleanSelect value={days} onChange={e=>setDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="0">Until I turn it off</option></CleanSelect></label><Button disabled={busy} onClick={()=>void make()}>Create invite link</Button></div>
   :<div className="invite-active"><div className="invite-content"><svg role="img" aria-label={`Invite QR code for ${clubName}`} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={path} fill="black"/></svg>
    <div><input readOnly aria-label="Invite link" value={url} onFocus={e=>e.currentTarget.select()}/><div className="club-buttons"><Button variant="outline" onClick={()=>void copy()}><Copy size={16}/>Copy link</Button><Button variant="outline" onClick={()=>void share()}><Share2 size={16}/>Share</Button><a className="dashboard-link" download={`rally-invite-${clubId}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}><Download size={16}/>Download QR code</a></div>
    <p className="invite-meta">{invite.expiresAt?`Works until ${when(invite.expiresAt)}.`:'Works until you turn it off.'} {invite.uses?`${invite.uses} ${invite.uses===1?'person has':'people have'} joined with it.`:'Nobody has used it yet.'}</p></div></div>
    <div className="club-buttons"><Button variant="outline" disabled={busy} onClick={()=>void make()}>Make a new link</Button><Button variant="ghost" disabled={busy} onClick={()=>void turnOff()}>Turn off link</Button></div>
    <label className="invite-next">When you make a new link, it works for<CleanSelect value={days} onChange={e=>setDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="0">Until I turn it off</option></CleanSelect></label></div>}
 </section>;
}
