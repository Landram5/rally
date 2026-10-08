'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function ClubExports({clubId}:{clubId:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(kind:string){setBusy(true);setError('');try{
  const response=await fetch(`/api/clubs/${encodeURIComponent(clubId)}/export?kind=${kind}`,{cache:'no-store'});
  if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error??'Export unavailable.');}
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`rally-${kind}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }catch(error){setError(error instanceof Error?error.message:'Export unavailable.');}finally{setBusy(false);}}
 return <section><h3>Export club data</h3><div className="club-buttons">{['roster','results','ratings'].map(kind=><Button key={kind} variant="outline" disabled={busy} onClick={()=>void download(kind)}>Export {kind} CSV</Button>)}</div>{error&&<p role="alert" className="auth-error">{error}</p>}</section>;
}
