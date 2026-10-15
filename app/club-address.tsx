'use client';
import {useState} from 'react';
import {Copy} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {checkSlug,slugify} from '@/lib/club-slugs';
// Manage > Web address: the short link people can type or print, for example rallytt.net/c/umbc.
export default function ClubAddress({clubId,clubName,slug,demo,act,refresh}:{clubId:string;clubName:string;slug?:string|null;demo:boolean;act:(p:Record<string,unknown>,message:string)=>Promise<boolean>;refresh:()=>Promise<void>|void}){
 const suggestion=slugify(clubName),[value,setValue]=useState(slug??suggestion),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const origin=typeof window==='undefined'?'https://rallytt.net':window.location.origin,changed=value.trim().toLowerCase()!==(slug??'');
 async function save(e:React.FormEvent){
  e.preventDefault();setError('');
  let clean:string;try{clean=checkSlug(value);}catch(err){setError(err instanceof Error?err.message:'Choose another address.');return;}
  if(slug&&clean!==slug&&!window.confirm(`Change the address to /c/${clean}? Links to /c/${slug} will keep working.`))return;
  setBusy(true);
  try{
   if(demo){await act({action:'set_club_slug',clubId,slug:clean},'Web address saved.');}
   else{
    const r=await fetch('/api/rally',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_club_slug',clubId,slug:clean})}),b=await r.json().catch(()=>({})) as {error?:string};
    if(!r.ok)throw new Error(b.error||'Could not save the address.');
    toast.success('Web address saved.');await refresh();
   }
   setValue(clean);
  }catch(err){setError(err instanceof Error?err.message:'Could not save the address.');}finally{setBusy(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(`https://rallytt.net/c/${slug}`);toast.success('Address copied.');}catch{toast.error('Copy the address shown above.');}}
 return <section className="panel club-detail-section club-address"><h2>Web address</h2>
  <p>A short link people can type, print on a flyer or put in a bio. It opens your club page, and people can ask to join from there.</p>
  {slug&&<p className="address-current"><b>rallytt.net/c/{slug}</b><Button variant="ghost" size="sm" onClick={()=>void copy()}><Copy size={14}/>Copy</Button></p>}
  <form onSubmit={e=>void save(e)}><label htmlFor="club-slug">{slug?'Change address':'Choose an address'}</label>
   <div className="address-field"><span aria-hidden="true">{origin.replace(/^https?:\/\//,'')}/c/</span><input id="club-slug" value={value} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="club-slug-help" onChange={e=>{setValue(e.target.value);setError('');}}/></div>
   <p id="club-slug-help" className="profile-help">3 to 30 letters, numbers or hyphens. {slug?'Your old address keeps working after you change it.':'You can change it later.'}</p>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   <Button type="submit" disabled={busy||!changed||!value.trim()}>{busy?'Saving…':slug?'Save new address':'Save address'}</Button></form>
 </section>;
}
