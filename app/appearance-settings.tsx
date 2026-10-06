'use client';
import {useTheme} from 'next-themes';
export default function AppearanceSettings(){const {theme,setTheme}=useTheme();return <section className="appearance-settings"><h2>Appearance</h2><label htmlFor="rally-appearance">Color theme</label><select id="rally-appearance" value={theme??'light'} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select><p className="profile-help">Saved in this browser and applied throughout Rally.</p></section>;}
