'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {useTheme} from 'next-themes';
import {PALETTE_STORAGE_KEY,isPalette} from '@/lib/palettes';
import {saveUiPreference} from './ui-preferences-client';
type Remote={playerId:string|null;ui:{palette:string;appearance:string;onboardingHidden:boolean}|null};
const syncedKey='rally-prefs-synced';
const applyPalette=(id:string)=>{try{localStorage.setItem(PALETTE_STORAGE_KEY,id)}catch{}if(id==='forest')delete document.documentElement.dataset.palette;else document.documentElement.dataset.palette=id};
// Once per browser session, signed-in players get their saved colour, mode and dismissed hints on this device.
// A player with nothing saved yet uploads this device's choices, so existing preferences carry over.
export default function PreferenceSync(){
 const pathname=usePathname()??'/',{setTheme}=useTheme();
 useEffect(()=>{
  if(pathname==='/demo'||pathname.startsWith('/demo/'))return;
  try{if(sessionStorage.getItem(syncedKey))return}catch{return}
  let current=true;
  fetch('/api/account?view=preferences',{cache:'no-store'}).then(async r=>{
   if(!r.ok||!current)return;
   const remote=await r.json() as Remote;if(!remote.playerId)return;
   try{sessionStorage.setItem(syncedKey,'1')}catch{}
   const hintKey='rally-onboarding-'+remote.playerId;
   if(remote.ui){
    if(isPalette(remote.ui.palette))applyPalette(remote.ui.palette);
    setTheme(remote.ui.appearance);
    if(remote.ui.onboardingHidden){try{localStorage.setItem(hintKey,'hidden')}catch{}window.dispatchEvent(new Event('rally-onboarding'))}
    return;
   }
   const seed:{palette?:string;appearance?:string;onboardingHidden?:boolean}={};
   try{const p=localStorage.getItem(PALETTE_STORAGE_KEY),a=localStorage.getItem('rally-appearance');if(isPalette(p))seed.palette=p;if(a==='light'||a==='dark'||a==='system')seed.appearance=a;if(localStorage.getItem(hintKey)==='hidden')seed.onboardingHidden=true}catch{}
   if(Object.keys(seed).length)saveUiPreference(seed);
  }).catch(()=>{});
  return()=>{current=false};
 },[pathname,setTheme]);
 return null;
}