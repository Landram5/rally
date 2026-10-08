'use client';
import QRCode from 'qrcode';
import {useId,useState} from 'react';
import {Share2,Copy,Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';

export default function ClubInvite({id,name,demo=false}:{id:string;name:string;demo?:boolean}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const panelId=useId(),url=`https://rallytt.net${demo?'/demo':''}/clubs/${encodeURIComponent(id)}`;
 const qr=QRCode.create(url,{errorCorrectionLevel:'M'}),size=qr.modules.size+8;
 const path=Array.from(qr.modules.data).flatMap((dark,i)=>dark?[`M${i%qr.modules.size+4} ${Math.floor(i/qr.modules.size)+4}h1v1h-1z`]:[]).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;
 async function copy(){try{await navigator.clipboard.writeText(url);setMessage('Club link copied.');}catch{setMessage('Copy the club link displayed below.');}}
 async function share(){setMessage('');if(!navigator.share){await copy();return;}try{await navigator.share({title:`${name} · Rally`,text:`View ${name} on Rally and request to join.`,url});}catch(e){if(e instanceof Error&&e.name==='AbortError')return;setMessage('Sharing is unavailable. Use Copy link or the QR code.');}}
 return <div className="club-invite"><Button variant="outline" aria-haspopup="dialog" aria-controls={panelId} onClick={()=>setOpen(true)}><Share2 size={18}/>Share club / invite members</Button><Dialog open={open} onOpenChange={o=>{setOpen(o);if(!o)setMessage('')}}><DialogContent id={panelId} className="club-invitation"><DialogHeader><DialogTitle>Invite someone to {name}</DialogTitle><DialogDescription>{demo?'This invitation opens the sample club. No real memberships are created.':'Scan to view the club. New members sign in and request to join; club approval is still required.'}</DialogDescription></DialogHeader><div className="invite-content"><svg role="img" aria-label={`Invitation QR code for ${name}`} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={path} fill="black"/></svg><div><a className="club-invite-url" href={url}>{url}</a><div className="club-buttons"><Button variant="outline" onClick={()=>void share()}><Share2 size={18}/>Share link</Button><Button variant="outline" onClick={()=>void copy()}><Copy size={18}/>Copy link</Button><a className="dashboard-link" download={`rally-club-${id}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}><Download size={18}/>Download QR code</a></div>{message&&<p role="status">{message}</p>}</div></div></DialogContent></Dialog></div>;
}
