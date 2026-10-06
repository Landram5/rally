'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import QRCode from 'qrcode';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
export default function TournamentInvite({id,base='/tournaments'}:{id:string;base?:string}){
 const [copied,setCopied]=useState(false),[error,setError]=useState(''),[canShare,setCanShare]=useState(false);
 useEffect(()=>{setCanShare(typeof navigator.share==='function');},[]);
 const url=`https://rallytt.net${base}/${encodeURIComponent(id)}`,qr=QRCode.create(url,{errorCorrectionLevel:'M'}),size=qr.modules.size+8;
 const path=Array.from(qr.modules.data).flatMap((dark,i)=>dark?[`M${i%qr.modules.size+4} ${Math.floor(i/qr.modules.size)+4}h1v1h-1z`]:[]).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;
 return <details className="tournament-invite"><summary>Share tournament / QR invitation</summary><div className="invite-content"><svg role="img" aria-label="Tournament invitation QR code" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={path} fill="black"/></svg><div><p>Scan to view this event and open registration. Signing in is required to enter.</p><a href={url}>{url}</a><div className="club-buttons"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setError('');}catch{setError('Copy the link displayed above.');}}}>{copied?'Link copied':'Copy link'}</Button>{canShare&&<Button variant="outline" onClick={async()=>{try{await navigator.share({title:'Rally tournament',url});setError('');}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Use Copy link or download the QR code to share.');}}}>Share</Button>}<a className="dashboard-link" download={`rally-tournament-${id}.svg`} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}>Download QR code</a></div>{error&&<p role="status">{error}</p>}</div></div></details>;
}
