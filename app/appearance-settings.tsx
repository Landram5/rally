'use client';
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {PALETTES,PALETTE_STORAGE_KEY,isPalette,type PaletteId} from '@/lib/palettes';
export default function AppearanceSettings(){
 const {theme,setTheme}=useTheme(),[palette,setPalette]=useState<PaletteId>('forest');
 useEffect(()=>{try{const saved=localStorage.getItem(PALETTE_STORAGE_KEY);if(isPalette(saved))setPalette(saved)}catch{}},[]);
 const choose=(value:string)=>{if(!isPalette(value))return;setPalette(value);try{localStorage.setItem(PALETTE_STORAGE_KEY,value)}catch{}if(value==='forest')delete document.documentElement.dataset.palette;else document.documentElement.dataset.palette=value};
 return <section className="appearance-settings"><h2>Appearance</h2>
  <label htmlFor="rally-palette">Color</label>
  <select id="rally-palette" value={palette} onChange={e=>choose(e.target.value)}>{PALETTES.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
  <label htmlFor="rally-appearance">Mode</label>
  <select id="rally-appearance" value={theme??'light'} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select>
  <p className="profile-help">Saved in this browser and applied throughout Rally.</p></section>;
}