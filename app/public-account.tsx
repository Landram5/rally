'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import AccountMenu from './account-menu';

export default function PublicAccount(){
 const router=useRouter(),[account,setAccount]=useState<{displayName:string;profileId:string|null}|null|undefined>(undefined);
 useEffect(()=>{
  let current=true,version=0;const controller=new AbortController();
  const refresh=()=>{const requestVersion=++version;fetch('/api/auth/session',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)return;const body=await response.json() as {user:{displayName:string;profileId:string|null}|null};
   if(current&&requestVersion===version)setAccount(body.user);
  }).catch(()=>{/* A network error must not turn a known session into signed out. */});};
  const resume=()=>{if(document.visibilityState==='visible')refresh()};
  refresh();window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{current=false;controller.abort();window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
 },[]);
 return account?<AccountMenu name={account.displayName} profileHref={account.profileId?`/players/${account.profileId}`:undefined} onProfile={()=>router.push('/account')}/>:<AccountMenu anonymous={account===null} pending={account===undefined}/>;
}
