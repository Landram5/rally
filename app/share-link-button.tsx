'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function ShareLinkButton({title,label='Share this page'}:{title:string;label?:string}){
 const [status,setStatus]=useState('');
 async function share(){
  const url=window.location.href;
  try{if(navigator.share){await navigator.share({title,url});return;}await navigator.clipboard.writeText(url);setStatus('Link copied.');}
  catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;setStatus('Copy this page address from your browser.');}
 }
 return <div className="share-link"><Button variant="outline" onClick={()=>void share()}>{label}</Button>{status&&<span role="status">{status}</span>}</div>;
}
