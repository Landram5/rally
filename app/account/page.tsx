'use client';
import NotificationSettings from '@/app/notification-settings';
import type {NotificationPreferences} from '@/lib/notification-preferences';
import AppearanceSettings from '@/app/appearance-settings';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import PublicHeader from '../public-header';
import AccountProfileForm,{type AccountProfile} from '../account-profile-form';
import type {AccountPlan,DeletionMode} from '@/lib/account-deletion';

type Settings=AccountPlan&{preferences?:NotificationPreferences|null;email:string;deletionAvailable:boolean;profile:AccountProfile|null};
export default function AccountPage(){
 const [settings,setSettings]=useState<Settings|null>(null),[signedOut,setSignedOut]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState<DeletionMode>('keep_results'),[confirmation,setConfirmation]=useState(''),[selection,setSelection]=useState<Record<string,string>>({}),[transfer,setTransfer]=useState<{clubId:string;successorId:string;name:string}|null>(null);
 const load=useCallback(()=>fetch('/api/account',{cache:'no-store'}).then(async r=>{
  if(r.status===401){setSignedOut(true);return}
  const body=await r.json() as Settings&{error?:string};
  if(!r.ok)throw new Error(body.error);
  setSettings(body);setSignedOut(false);setError('');
 }).catch(()=>setError('Could not load account settings. Please try again.')).finally(()=>setLoading(false)),[]);
 useEffect(()=>{void load()},[load]);
 async function send(body:Record<string,unknown>){
  const r=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await r.json() as {error?:string;pending?:boolean};if(!r.ok)throw new Error(result.error||'Could not complete this request.');return result;
 }
 async function transferOwner(){
  if(!transfer||busy)return;setBusy(true);setError('');
  try {await send({action:'transfer',confirmation:'TRANSFER',clubId:transfer.clubId,successorId:transfer.successorId});setTransfer(null);await load()}
  catch(e){setError(e instanceof Error?e.message:'Could not transfer ownership.')}finally{setBusy(false)}
 }
 async function remove(event:React.FormEvent){
  event.preventDefault();if(busy||confirmation!=='DELETE')return;setBusy(true);setError('');
  try {const result=await send({action:'delete',mode,confirmation});window.location.replace(`/account/deleted${result.pending?'?pending=1':''}`)}
  catch(e){setError(e instanceof Error?e.message:'Could not delete your account.');setBusy(false)}
 }
 return <><PublicHeader/><main className="account-settings"><h1>Account settings</h1>
  <Link href="/clubhouse">Back to clubhouse</Link>
  {loading&&<p role="status">Loading account settings…</p>}
  {error&&<div className="auth-error" role="alert"><p>{error}</p>{!settings&&<button onClick={()=>void load()}>Try again</button>}</div>}
  {signedOut&&<p><Link href="/login">Sign in</Link> to manage or delete your account.</p>}
  {settings&&!loading&&!signedOut&&(settings.pending?<section><h2>Deletion is in progress</h2><p>Your Rally access has been removed. We are retrying the final sign-in account deletion automatically.</p><Link href="/account/deleted?pending=1">View deletion information</Link></section>:<>
   <AccountProfileForm key={settings.profile?.id??'new'} profile={settings.profile} disabled={busy} onSave={async(name,bio,photo)=>{await send({action:'save_profile',name,bio,...(photo!==undefined?{photo}:{})});await load();}}/>
   <section><h2>Sign-in details</h2><p>{settings.email}</p><Link href="/account/update-password">Change password</Link></section>
   {!!settings.clubs.length&&<section><h2>Transfer club ownership first</h2><p>Your clubs and other members’ records will remain. Choose a new owner for each club before deleting your account. You will remain an administrator until you delete your account.</p>
    {settings.clubs.map(club=><div className="account-club" key={club.id}><h3>{club.name}</h3>{club.successors.length?<>
     <label htmlFor={`owner-${club.id}`}>New owner</label><select id={`owner-${club.id}`} disabled={busy} value={selection[club.id]??''} onChange={e=>setSelection({...selection,[club.id]:e.target.value})}><option value="">Choose an active member</option>{club.successors.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <button type="button" className="primary-action" disabled={busy||!selection[club.id]} onClick={()=>setTransfer({clubId:club.id,successorId:selection[club.id],name:club.successors.find(p=>p.id===selection[club.id])!.name})}>Transfer ownership</button>
    </>:<p>No eligible new owner is available. Ask another person to create a Rally account and join your club, then approve their membership. They must not already own another club. <button onClick={()=>void load()} disabled={busy}>Refresh members</button></p>}</div>)}
    {transfer&&<div className="account-confirm" role="group" aria-label="Confirm ownership transfer"><p>Make <strong>{transfer.name}</strong> the new owner? They will control the club. You cannot take ownership back yourself.</p><button type="button" onClick={()=>void transferOwner()} disabled={busy}>{busy?'Transferring…':'Confirm transfer'}</button><button type="button" onClick={()=>setTransfer(null)} disabled={busy}>Cancel</button></div>}
   </section>}
   <NotificationSettings key={settings.profile?.id} initial={settings.preferences} disabled={busy||!settings.profile} onSave={async preferences=>{await send({action:'save_notification_preferences',...preferences});}}/><AppearanceSettings/><section className="account-danger"><h2>Delete account</h2><p>This permanently removes your sign-in account, display name and club memberships. Your public player profile will no longer be available. This cannot be undone.</p>
    <form onSubmit={remove}>
     <fieldset disabled={busy}><legend>What should happen to your player history?</legend>
      <label className="account-choice"><input type="radio" name="history" checked={mode==='keep_results'} onChange={()=>setMode('keep_results')}/><span><strong>Keep past results as “Deleted player”</strong><small>Retain the connection between your previous match and tournament results without your name or sign-in details.</small></span></label>
      <label className="account-choice"><input type="radio" name="history" checked={mode==='remove_history'} onChange={()=>setMode('remove_history')}/><span><strong>Remove my player history</strong><small>Delete your original player record and personal history links. Shared match scores and tournament draws remain for other players, using separate “Deleted player” placeholders for each match or tournament.</small></span></label>
     </fieldset>
     <p>Neither option deletes your clubs, other players’ accounts, or their shared competition records. Historical participants may still be recognizable from the context of an event.</p>
     <label className="account-confirm-label" htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" autoComplete="off" spellCheck={false} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} required pattern="DELETE"/>
     {!settings.deletionAvailable&&<p role="status">Account deletion is temporarily unavailable. Please try again later.</p>}
     {!!settings.clubs.length&&<p>Transfer club ownership above to enable deletion.</p>}
     <button className="account-delete" disabled={busy||confirmation!=='DELETE'||!!settings.clubs.length||!settings.deletionAvailable}>{busy?'Deleting account…':'Permanently delete my account'}</button>
    </form>
   </section>
  </>)}
 </main></>;
}
