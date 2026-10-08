'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import CleanSelect from './clean-select';
import {saveUiPreference} from './ui-preferences-client';
import {PALETTES,PALETTE_STORAGE_KEY,isPalette,type PaletteId} from '@/lib/palettes';
export default function AppearanceSettings(){
 const {theme,setTheme}=useTheme(),[palette,setPalette]=useState<PaletteId>('forest');
 useEffect(()=>{try{const saved=localStorage.getItem(PALETTE_STORAGE_KEY);if(isPalette(saved))setPalette(saved)}catch{}},[]);
 const choose=(value:string)=>{if(!isPalette(value))return;setPalette(value);saveUiPreference({palette:value});try{localStorage.setItem(PALETTE_STORAGE_KEY,value)}catch{}if(value==='forest')delete document.documentElement.dataset.palette;else document.documentElement.dataset.palette=value};
 return <section id="appearance" className="appearance-settings"><h2>Appearance</h2>
  <label htmlFor="rally-palette">Color</label>
  <CleanSelect id="rally-palette" value={palette} onChange={e=>choose(e.target.value)}>{PALETTES.map(p=><option key={p.id} value={p.id} data-colors={p.colors.join(',')}>{p.label}</option>)}</CleanSelect>
  <label htmlFor="rally-appearance">Mode</label>
  <CleanSelect id="rally-appearance" value={theme??'light'} onChange={e=>{setTheme(e.target.value);saveUiPreference({appearance:e.target.value})}}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></CleanSelect>
  <p className="profile-help">Saved to your account and applied on every device you sign in on.</p></section>;
}