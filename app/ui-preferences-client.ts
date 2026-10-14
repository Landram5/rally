import {PALETTE_STORAGE_KEY} from '@/lib/palettes';
// Fire-and-forget save of interface preferences to the signed-in account (no-ops in the sample demo and when signed out).
export function saveUiPreference(partial:{palette?:string;appearance?:string;onboardingHidden?:boolean}){
 try{
  if(typeof fetch!=='function'||location.pathname==='/demo'||location.pathname.startsWith('/demo/'))return;
  void fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_ui_preferences',...partial})}).catch(()=>{});
 }catch{/* preferences still apply on this device */}
}
// Applies a colorway on this device and saves it to the account. Used by the settings picker and the UMBC offer.
export function applyPalette(id:string){
 saveUiPreference({palette:id});
 try{localStorage.setItem(PALETTE_STORAGE_KEY,id)}catch{}
 if(id==='forest')delete document.documentElement.dataset.palette;else document.documentElement.dataset.palette=id;
}
export const currentPalette=()=>document.documentElement.dataset.palette||'forest';
