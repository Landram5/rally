'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {InvitePreview} from '@/lib/club-invites';
// Opened from a club's invite link: one tap joins. People without an account sign up first and come straight back.
export default function JoinInvite({token,club,signedIn}:{token:string;club:InvitePreview;signedIn:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const back=encodeURIComponent('/join/'+token);
 async function join(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/invites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'accept',token})});
   const b=await r.json().catch(()=>({})) as {error?:string;clubId?:string};
   if(r.status===401){router.push('/login?next='+back);return;}
   if(!r.ok)throw new Error(b.error||'Could not join. Try again.');
   // First time on Rally: finish setting up the profile, then land on the club.
   const club_=`/clubs/${encodeURIComponent(b.clubId??club.clubId)}`;
   const done=await fetch('/api/account?view=preferences',{cache:'no-store'}).then(x=>x.ok?x.json() as Promise<{ui:{onboardingHidden:boolean}|null}>:null).catch(()=>null);
   router.push(done?.ui?.onboardingHidden?club_:'/welcome?next='+encodeURIComponent(club_));router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Could not join. Try again.');setBusy(false);}
 }
 return <section className="join-card">
  <span className="room-icon club" aria-hidden="true">{club.name.slice(0,1).toUpperCase()}</span>
  <p className="eyebrow">You are invited to join</p>
  <h1>{club.name}</h1>
  <p className="join-meta">{club.location} · <Users size={14} aria-hidden="true"/> {club.memberCount} {club.memberCount===1?'member':'members'}</p>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {signedIn
   ?<Button size="lg" disabled={busy} onClick={()=>void join()}>{busy?'Joining…':`Join ${club.name}`}</Button>
   :<div className="join-actions"><Button asChild size="lg"><a href={`/login?mode=signup&next=${back}`}>Create an account to join</a></Button><Button asChild size="lg" variant="outline"><a href={`/login?next=${back}`}>I already have an account</a></Button></div>}
  <p className="join-note">Joining adds you to the club right away.</p>
 </section>;
}
