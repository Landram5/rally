'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {ArrowLeft,Check,CircleDot,Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {safeNextPath} from '@/lib/auth-rules';
import type {JoinClub} from '@/lib/join-clubs';
import {PALETTES,PALETTE_STORAGE_KEY,isPalette,type PaletteId} from '@/lib/palettes';
import {defaultPreferences,type NotificationPreferences} from '@/lib/notification-preferences';
import Avatar from './player-avatar';
import PhotoCropper from './photo-cropper';
import {applyPalette,saveUiPreference} from './ui-preferences-client';
import {isUmbcClub,offerUmbcColorway} from './umbc-offer';
type Settings={email:string;preferences?:NotificationPreferences|null;profile:{id:string;name:string;bio:string;photo_url?:string|null}|null};
const STEPS=['name','photo','bio','alerts','look','clubs','done'] as const;
const ALERTS:[keyof NotificationPreferences,string,string][]=[
 ['match_updates','Match results','When a match you played is confirmed or needs your review.'],
 ['tournament_updates','Tournaments','Draws, results and call-ups for events you entered.'],
 ['registration_updates','Registrations and clubs','Waitlist spots and club membership decisions.'],
 ['session_reminders','Reminders','A heads-up before club sessions and tournaments.'],
];
async function send(body:Record<string,unknown>,endpoint='/api/account'){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw new Error(result.error||'Could not save. Try again.');return result;
}
// First-run setup, one short screen at a time (name, photo, bio, alerts, look). Every step except the name can be skipped.
export default function OnboardingFlow(){
 const {theme,setTheme}=useTheme();
 const [loading,setLoading]=useState(true),[step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [profileId,setProfileId]=useState(''),[name,setName]=useState(''),[bio,setBio]=useState(''),[savedPhoto,setSavedPhoto]=useState<string|null>(null);
 const [photo,setPhoto]=useState<string|null>(null),[original,setOriginal]=useState<string|undefined>(),[cropFile,setCropFile]=useState<File|null>(null);
 const [clubQuery,setClubQuery]=useState(''),[clubs,setClubs]=useState<JoinClub[]|null>(null),[clubsError,setClubsError]=useState(''),[joining,setJoining]=useState(''),[retry,setRetry]=useState(0),[requested,setRequested]=useState<{id:string;name:string}[]>([]);
 const [prefs,setPrefs]=useState<NotificationPreferences>(defaultPreferences),[palette,setPalette]=useState<PaletteId>('forest'),[next,setNext]=useState('/clubhouse');
 useEffect(()=>{
  const target=safeNextPath(new URLSearchParams(window.location.search).get('next')??'/clubhouse');setNext(target);
  try{const saved=localStorage.getItem(PALETTE_STORAGE_KEY);if(isPalette(saved))setPalette(saved)}catch{/* the default colour stays */}
  let live=true;
  (async()=>{
   try{
    const r=await fetch('/api/account',{cache:'no-store'});
    if(r.status===401){window.location.replace('/login?next='+encodeURIComponent('/welcome'));return}
    const s=await r.json() as Settings;if(!r.ok||!live)throw new Error();
    // People who finished or skipped this once go straight on.
    const remote=await fetch('/api/account?view=preferences',{cache:'no-store'}).then(x=>x.ok?x.json() as Promise<{ui:{onboardingHidden:boolean}|null}>:null).catch(()=>null);
    if(remote?.ui?.onboardingHidden){try{if(s.profile?.id)localStorage.setItem('rally-onboarding-'+s.profile.id,'hidden')}catch{/* optional */}window.location.replace(target);return}
    if(!live)return;
    setProfileId(s.profile?.id??'');setName(s.profile?.name??'');setBio(s.profile?.bio??'');setSavedPhoto(s.profile?.photo_url??null);setPrefs({...defaultPreferences,...s.preferences});
   }catch{if(live)setError('Could not load your account. Refresh to try again.')}
   finally{if(live)setLoading(false)}
  })();
  return()=>{live=false};
 },[]);
 // The clubs step: search the approved clubs (debounced); a newer search always wins over an older one.
 const onClubs=STEPS[step]==='clubs';
 useEffect(()=>{
  if(!onClubs)return;
  let live=true;setClubsError('');
  const timer=setTimeout(()=>{
   fetch('/api/rally?view=join-clubs&q='+encodeURIComponent(clubQuery.trim()),{cache:'no-store'})
    .then(async r=>{const b=await r.json() as {clubs?:JoinClub[];error?:string};if(!r.ok)throw new Error(b.error);if(live)setClubs(b.clubs??[]);})
    .catch(()=>{if(live){setClubs(null);setClubsError('Could not load clubs. Check your connection and try again.')}});
  },clubQuery?250:0);
  return()=>{live=false;clearTimeout(timer)};
 },[onClubs,clubQuery,retry]);
 async function requestJoin(club:JoinClub){
  if(joining)return;setJoining(club.id);setError('');
  try{
   await send({action:'request_join',clubId:club.id},'/api/rally');
   setClubs(list=>list&&list.map(c=>c.id===club.id?{...c,mine:'pending'}:c));
   setRequested(prev=>prev.some(c=>c.id===club.id)?prev:[...prev,{id:club.id,name:club.name}]);
   if(isUmbcClub(club.name))offerUmbcColorway();
  }catch(e){setError(e instanceof Error?e.message:'Could not send the request. Try again.')}
  finally{setJoining('')}
 }
 async function finish(destination:string){
  setBusy(true);
  try{await send({action:'save_ui_preferences',onboardingHidden:true})}catch{/* the checklist flag is local too */}
  try{if(profileId)localStorage.setItem('rally-onboarding-'+profileId,'hidden')}catch{/* optional */}
  window.location.assign(destination);
 }
 async function advance(){
  setError('');
  const id=STEPS[step];
  if(id==='name'&&!name.trim()){setError('Enter the name other players will see.');return}
  setBusy(true);
  try{
   if(id==='name'||id==='bio')await send({action:'save_profile',name:name.trim(),bio});
   if(id==='photo'&&photo){
    await send({action:'save_profile',name:name.trim(),bio,photo});
    if(original){try{await send({action:'save_photo_original',original})}catch{/* the cropped photo is saved; only re-cropping is unavailable */}}
    setSavedPhoto(photo);setPhoto(null);
   }
   if(id==='alerts')await send({action:'save_notification_preferences',...prefs,tournament_reminders:prefs.session_reminders});
   setStep(step+1);
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.')}
  finally{setBusy(false)}
 }
 if(loading)return <main className="onboarding"><p role="status">Loading…</p></main>;
 const id=STEPS[step],last=id==='done',shownPhoto=photo??savedPhoto,mode=theme??'light';
 return <main className="onboarding"><div className="onboarding-card">
  <header className="onboarding-top">
   {step>0&&!last?<Button variant="ghost" size="icon" aria-label="Back" onClick={()=>{setError('');setStep(step-1)}}><ArrowLeft size={20}/></Button>:<span className="brand-mark" aria-hidden="true"><CircleDot size={22}/></span>}
   {!last&&<div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length-1} aria-valuenow={step+1} aria-label="Setup progress"><span style={{width:`${((step+1)/(STEPS.length-1))*100}%`}}/></div>}
   {!last&&<Button variant="ghost" size="sm" onClick={()=>void finish(next)} disabled={busy}>Skip setup</Button>}
  </header>
  {error&&<p className="auth-error" role="alert">{error}</p>}

  {id==='name'&&<section className="onboarding-step"><h1>Welcome to Rally</h1><p>What should other players call you? This is the name on rosters, results and your public profile.</p>
   <label className="onboarding-field">Your name<input value={name} maxLength={60} autoFocus autoComplete="nickname" onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void advance()}}/></label></section>}

  {id==='photo'&&<section className="onboarding-step"><h1>Add a profile photo</h1><p>A clear photo of your face helps people at your club recognize you.</p>
   <div className="onboarding-avatar"><Avatar name={name||'Player'} photoUrl={shownPhoto??undefined} large/></div>
   <label className="photo-picker onboarding-pick">{shownPhoto?'Choose a different photo':'Choose a photo'}<input type="file" aria-label="Upload profile photo" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)setCropFile(file)}}/></label>
   <small>JPG, PNG or WebP, up to 10 MB. You can change it any time in account settings.</small></section>}

  {id==='bio'&&<section className="onboarding-step"><h1>Tell people about you</h1><p>A line or two about how you play, your club or what you are looking for. Optional.</p>
   <label className="onboarding-field">Bio<textarea value={bio} maxLength={500} rows={5} placeholder="Penhold, loves long rallies, usually at the Thursday session." onChange={e=>setBio(e.target.value)}/></label><small>{bio.length}/500</small></section>}

  {id==='alerts'&&<section className="onboarding-step"><h1>Stay in the loop</h1><p>Choose what shows up in your Rally inbox. You can change this later in account settings.</p>
   <div className="onboarding-toggles">{ALERTS.map(([key,title,detail])=><label key={key} className="notification-choice"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={!!prefs[key]} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/></label>)}</div></section>}

  {id==='look'&&<section className="onboarding-step"><h1>Make it yours</h1><p>Pick a colour and a mode. It follows your account to every device.</p>
   <div className="onboarding-palettes" role="radiogroup" aria-label="Colour">{PALETTES.map(p=><button key={p.id} type="button" role="radio" aria-checked={palette===p.id} className={palette===p.id?'is-on':''} onClick={()=>{setPalette(p.id);applyPalette(p.id)}}><span className="onboarding-swatch" style={{background:`linear-gradient(135deg, ${p.colors[0]} 50%, ${p.colors[1]} 50%)`}}>{palette===p.id&&<Check size={16}/>}</span><span>{p.label}</span></button>)}</div>
   <div className="onboarding-modes" role="radiogroup" aria-label="Mode">{([['light','Light'],['dark','Dark'],['system','Device']] as const).map(([value,label])=><button key={value} type="button" role="radio" aria-checked={mode===value} className={mode===value?'is-on':''} onClick={()=>{setTheme(value);saveUiPreference({appearance:value})}}>{label}</button>)}</div></section>}

  {id==='clubs'&&<section className="onboarding-step"><h1>Find your club</h1><p>Ask to join a club and an organizer will approve you. You can always do this later from the Clubs tab.</p>
   <label className="onboarding-search"><Search size={18} aria-hidden="true"/><input type="search" value={clubQuery} placeholder="Search by club name or town" aria-label="Search clubs" maxLength={60} onChange={e=>setClubQuery(e.target.value)}/></label>
   {clubsError?<div className="onboarding-empty" role="alert"><p>{clubsError}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Try again</Button></div>
    :clubs===null?<p className="onboarding-empty" role="status">Loading clubs…</p>
    :!clubs.length?<p className="onboarding-empty">{clubQuery.trim()?`No clubs match "${clubQuery.trim()}". Clubs are added by their organizers, so ask yours to put it on Rally.`:'No clubs are on Rally yet. Organizers can create one from the clubhouse.'}</p>
    :<ul className="onboarding-clubs">{clubs.map(c=><li key={c.id}><span className="room-icon club" aria-hidden="true">{c.name.slice(0,1).toUpperCase()}</span><span className="onboarding-club-main"><b>{c.name}</b><small>{c.location} · {c.members} {c.members===1?'member':'members'}</small></span>
     {c.mine==='active'?<span className="onboarding-club-state"><Check size={16}/> Member</span>:c.mine==='pending'?<span className="onboarding-club-state"><Check size={16}/> Requested</span>:<Button variant="outline" size="sm" disabled={!!joining} aria-label={`Ask to join ${c.name}`} onClick={()=>void requestJoin(c)}>{joining===c.id?'Sending…':'Join'}</Button>}</li>)}</ul>}</section>}

  {last&&<section className="onboarding-step is-done"><div className="onboarding-avatar"><Avatar name={name||'Player'} photoUrl={shownPhoto??undefined} large/></div><h1>You are all set{name.trim()?`, ${name.trim().split(' ')[0]}`:''}</h1>{requested.length?<p>You asked to join {requested.map(c=>c.name).join(', ')}. An organizer will review each request; you will see the club under Clubs once you are approved.</p>:<p>You can find a club any time from the Clubs tab.</p>}
   <div className="onboarding-actions"><Button size="lg" disabled={busy} onClick={()=>void finish(next)}>Go to my clubhouse</Button></div>
   <a className="onboarding-install" href="/install">Add Rally to your Home Screen</a></section>}

  {!last&&<footer className="onboarding-foot-actions"><Button size="lg" disabled={busy} onClick={()=>void advance()}>{busy?'Saving…':id==='photo'&&!photo?'Continue':'Continue'}</Button>{id!=='name'&&<Button variant="ghost" disabled={busy} onClick={()=>{setError('');setStep(step+1)}}>Skip</Button>}</footer>}
 </div>
 <PhotoCropper file={cropFile} onCancel={()=>setCropFile(null)} onApply={(cropped,copy)=>{setPhoto(cropped);setOriginal(copy);setCropFile(null)}}/>
 </main>;
}
