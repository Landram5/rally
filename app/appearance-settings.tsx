'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import CleanSelect from './clean-select';
import {applyPalette,applyTextSize,currentTextSize,saveUiPreference} from './ui-preferences-client';
import {PALETTES,PALETTE_STORAGE_KEY,isPalette,type PaletteId} from '@/lib/palettes';
export default function AppearanceSettings(){
 const {theme,setTheme}=useTheme(),[palette,setPalette]=useState<PaletteId>('forest'),[large,setLarge]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(PALETTE_STORAGE_KEY);if(isPalette(saved))setPalette(saved)}catch{}setLarge(currentTextSize()==='large');},[]);
 const choose=(value:string)=>{if(!isPalette(value))return;setPalette(value);applyPalette(value)};
 return <section id="appearance" className="appearance-settings"><h2>Appearance</h2>
  <label htmlFor="rally-palette">Color</label>
  <CleanSelect id="rally-palette" value={palette} onChange={e=>choose(e.target.value)}>{PALETTES.map(p=><option key={p.id} value={p.id} data-colors={p.colors.join(',')}>{p.label}</option>)}</CleanSelect>
  <label htmlFor="rally-appearance">Mode</label>
  <CleanSelect id="rally-appearance" value={theme??'light'} onChange={e=>{setTheme(e.target.value);saveUiPreference({appearance:e.target.value})}}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></CleanSelect>
  <label className="notification-choice"><span><strong>Larger text and buttons</strong><small>Bigger text, taller buttons and easier tapping. Off keeps Rally as it looks now.</small></span><input type="checkbox" checked={large} onChange={e=>{setLarge(e.target.checked);applyTextSize(e.target.checked?'large':'standard');}}/></label>
  <p className="profile-help">Saved to your account and applied on every device you sign in on.</p></section>;
}