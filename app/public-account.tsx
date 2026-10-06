'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import AccountMenu from './account-menu';

export default function PublicAccount(){
 const router=useRouter(),[name,setName]=useState<string|null|undefined>(undefined);
 useEffect(()=>{
  let current=true;const controller=new AbortController();
  const refresh=()=>{fetch('/api/auth/session',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)return;const body=await response.json() as {user:{displayName:string}|null};
   if(current)setName(body.user?.displayName??null);
  }).catch(()=>{/* A network error must not turn a known session into signed out. */});};
  const resume=()=>{if(document.visibilityState==='visible')refresh()};
  refresh();window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{current=false;controller.abort();window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
 },[]);
 return name?<><a className="public-member-link" href="/clubhouse">Clubhouse</a><AccountMenu name={name} onProfile={()=>router.push('/account')}/></>:name===null?<a className="public-signin" href="/login">Sign in</a>:<a className="public-member-link" href="/clubhouse">Clubhouse</a>;
}
