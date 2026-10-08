'use client';
import {useState} from 'react';
import {Share2} from 'lucide-react';
import {Button} from '@/components/ui/button';
export default function ShareLinkButton({title,label='Share this page',iconOnly=false}:{title:string;label?:string;iconOnly?:boolean}){
 const [status,setStatus]=useState('');
 async function share(){
  const url=window.location.href;
  try{if(navigator.share){await navigator.share({title,url});return;}await navigator.clipboard.writeText(url);setStatus('Link copied.');setTimeout(()=>setStatus(''),2500);}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;setStatus('Copy this page address from your browser.');}
 }
 return <div className="share-link">{iconOnly?<Button variant="outline" size="icon" aria-label={label} title={label} onClick={()=>void share()}><Share2 size={16}/></Button>:<Button variant="outline" onClick={()=>void share()}>{label}</Button>}{status&&<span role="status">{status}</span>}</div>;
}