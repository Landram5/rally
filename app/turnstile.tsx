'use client';
import {useEffect,useRef,useState} from 'react';
type TurnstileAPI={render:(node:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global {interface Window {turnstile?:TurnstileAPI}}
let script:Promise<void>|undefined;
function loadScript(){return script??=new Promise<void>((resolve,reject)=>{const tag=document.createElement('script');tag.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';tag.async=true;tag.onload=()=>resolve();tag.onerror=()=>{tag.remove();script=undefined;reject(new Error());};document.head.appendChild(tag);});}
export default function Turnstile({action,onToken}:{action:'auth'|'feedback';onToken:(token:string)=>void}){
 const container=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false,id:string|undefined;onToken('');
  async function mount(){try{
   const response=await fetch('/api/turnstile',{cache:'no-store'}),config=await response.json() as {siteKey?:string};
   if(!response.ok||!config.siteKey)throw new Error();await loadScript();
   if(cancelled||!container.current)return;
   id=window.turnstile!.render(container.current,{sitekey:config.siteKey,action,theme:'auto',size:'flexible',callback:(token:string)=>{setError('');onToken(token);},'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');setError('Security check failed. Reload this page to retry.');}});
  }catch{if(!cancelled)setError('Security check unavailable. Reload this page to retry.');}}
  void mount();return()=>{cancelled=true;if(id)window.turnstile?.remove(id);};
 },[action,onToken]);
 return <div style={{minWidth:0,maxWidth:'100%',marginBlock:'12px'}}><div ref={container}/>{error&&<p className="auth-error" role="alert">{error}</p>}</div>;
}
