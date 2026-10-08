'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {X} from 'lucide-react';
import type {Data} from './rally-app';
const installationKey='rally-home-screen-installed';
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
const rememberInstallation=()=>{try{localStorage.setItem(installationKey,'yes')}catch{}window.dispatchEvent(new Event('rally-onboarding'))};
const subscribe=(callback:()=>void)=>{
 const display=window.matchMedia('(display-mode: standalone)');
 const changed=()=>{if(standalone())rememberInstallation();else callback()};
 window.addEventListener('rally-onboarding',callback);window.addEventListener('storage',callback);window.addEventListener('appinstalled',rememberInstallation);display.addEventListener('change',changed);
 return()=>{window.removeEventListener('rally-onboarding',callback);window.removeEventListener('storage',callback);window.removeEventListener('appinstalled',rememberInstallation);display.removeEventListener('change',changed)};
};
export default function OnboardingChecklist({data,demo}:{data:Data;demo:boolean}){
 const key='rally-onboarding-'+(demo?'demo':data.me?.id??'unknown');
 const hidden=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)==='hidden'||sessionStorage.getItem(key)==='hidden'}catch{return false}},()=>true);
 const installed=useSyncExternalStore(subscribe,()=>{if(standalone())return true;try{return localStorage.getItem(installationKey)==='yes'}catch{return false}},()=>false);
 useEffect(()=>{if(standalone())rememberInstallation()},[]);
 if(hidden||!data.me)return null;
 const player=data.players.find(p=>p.id===data.me!.id),profileComplete=data.me.profileComplete??!!(player?.photo_url&&player.bio?.trim());
 const member=data.memberships.some(m=>m.player_id===data.me!.id&&m.status==='active'),played=(data.summaries?.all.stats[data.me.id]?.played??0)>0||data.matches.some(m=>m.a===data.me!.id||m.b===data.me!.id),base=demo?'/demo':'/clubhouse';
 return <section className="panel onboarding-checklist"><div><h2>Get started with Rally</h2><button aria-label="Close getting started checklist for now" title="Close for now" onClick={()=>{try{sessionStorage.setItem(key,'hidden')}catch{}window.dispatchEvent(new Event('rally-onboarding'))}}><X size={20}/></button></div><ol><li>{profileComplete?'✓ Photo and bio added':<a href={demo?'/demo/account':'/account'}>Add your photo and bio</a>}</li><li>{member?'✓ Club membership active':<a href={base+'?tab=clubs'}>Join or create a club</a>}</li><li>{played?'✓ First match recorded':<a href={base+'?tab=matches'}>Record your first match</a>}</li><li>{installed?'✓ Rally added to your Home Screen':<a href="/install">Add Rally to your Home Screen</a>}</li></ol><div className="onboarding-foot"><a href="/help">How to use Rally</a><label className="onboarding-dismiss"><input type="checkbox" onChange={e=>{if(!e.target.checked)return;try{localStorage.setItem(key,'hidden')}catch{}if(!demo&&typeof fetch==='function')void fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_ui_preferences',onboardingHidden:true})}).catch(()=>{});window.dispatchEvent(new Event('rally-onboarding'))}}/>Don&rsquo;t show again</label></div></section>;
}
