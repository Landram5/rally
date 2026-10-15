'use client';
/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,MessageCircle,Settings} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import PublicHeader from './public-header';
import ClubSessions from './club-sessions';
import ClubExports from './club-exports';
import ClubSeasons from './club-seasons';
import AnnouncementsBoard from './announcements-board';
import ClubInvite from './club-invite';
import ClubInviteLink from './club-invite-link';
import ClubAddress from './club-address';
import ClubSetupChecklist,{useSetup} from './club-setup-checklist';
import ClubChat from './club-chat';
import ClubDiscord from './club-discord';
import {isUmbcClub,offerUmbcColorway} from './umbc-offer';
import ClubRoster from './club-roster';
import {dateLabel} from '@/lib/date-label';
import ActivityPage from './activity-page';
import AccountMenu from './account-menu';
import TournamentPanel from './tournament-panel';
import ClubAppearance from './club-appearance';
import Avatar from './player-avatar';
import {registrationClosed} from '@/lib/logistics';
import {TimeLabel} from './time-label';
import type {Data} from './rally-app';
import {createDemoData,applyDemoAction} from '@/lib/demo-state';
import {Button} from '@/components/ui/button';
export default function ClubPage({id,initialData,demo=false}:{id:string;initialData:Data;demo?:boolean}){
 const [data,setData]=useState(initialData),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[editing,setEditing]=useState(false),[images,setImages]=useState(false),[name,setName]=useState(''),[location,setLocation]=useState(''),[bio,setBio]=useState(''),[guest,setGuest]=useState('');
 const [section,setSection]=useState('about'),[unread,setUnread]=useState(0);
 useEffect(()=>{if(demo||!data.me)return;let live=true;fetch('/api/chat?counts=1',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{counts?:Record<string,number>}>:{counts:{}}).then(b=>{if(live)setUnread(b.counts?.[id]??0)}).catch(()=>{});return()=>{live=false};},[demo,id,data.me]);
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get('section');if(requested&&['about','members','competition','sessions','announcements','chat','management'].includes(requested))setSection(requested);},[]);
 useEffect(()=>{if(loading||section==='about'||section==='chat')return;
  // Sections above the target keep loading, so scroll again a few times until the person scrolls themselves.
  let stop=false;const go=()=>{if(!stop)document.getElementById('club-'+section)?.scrollIntoView({block:'start'});},timers=[0,300,800,1600,2600].map(t=>window.setTimeout(go,t)),cancel=()=>{stop=true;};
  window.addEventListener('wheel',cancel,{once:true,passive:true});window.addEventListener('touchstart',cancel,{once:true,passive:true});window.addEventListener('keydown',cancel,{once:true});
  return()=>{timers.forEach(clearTimeout);window.removeEventListener('wheel',cancel);window.removeEventListener('touchstart',cancel);window.removeEventListener('keydown',cancel);};},[loading,section]);
 const openChat=(open:boolean)=>{setSection(open?'chat':'about');window.history.replaceState(null,'',window.location.pathname+(open?'?section=chat':''));};
 // Organizers get a separate management view; members never see these tools.
 const openManage=(on:boolean)=>{setSection(on?'management':'about');window.history.replaceState(null,'',window.location.pathname+(on?'?section=management':''));window.scrollTo({top:0,behavior:'smooth'});};
 const [eventId,setEventIdState]=useState<string|null>(null);
 const setEventId=useCallback((event:string|null)=>{if(event)window.location.assign((demo?'/demo':'')+'/tournaments/'+encodeURIComponent(event)+'/manage');else setEventIdState(null);},[demo]);
 const busyRef=useRef(false),readVersion=useRef(0),mounted=useRef(false),reading=useRef(false),readAbort=useRef<AbortController|null>(null);
 const invalidateReads=useCallback(()=>{readVersion.current++;},[]);
 const [refreshing,setRefreshing]=useState(false);
 const refreshClub=useCallback(async(manual=false)=>{
  if(busyRef.current||reading.current)return;
  if(demo){try{const saved=sessionStorage.getItem('rally-demo-preview');if(saved)setData(JSON.parse(saved));}catch{setError('Could not refresh sample requests.');}return;}
  reading.current=true;const version=++readVersion.current,controller=new AbortController();readAbort.current=controller;
  if(manual){setRefreshing(true);setError('');}
  try{const r=await fetch('/api/rally?compact=1&clubScope='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});if(r.status===401)return;if(!r.ok)throw new Error('Could not refresh club requests. Try Refresh requests again.');const next=await r.json() as Data;if(mounted.current&&version===readVersion.current)setData(next);}
  catch(e){if(!controller.signal.aborted&&manual&&mounted.current)setError(e instanceof Error?e.message:'Could not refresh club requests.');}
  finally{if(readAbort.current===controller){readAbort.current=null;reading.current=false;if(mounted.current){setLoading(false);if(manual)setRefreshing(false);}}}
 },[demo,id]);
 const [loadedEvent,setLoadedEvent]=useState<{event:Data['tournaments'][number];entries:Data['entries'];players:Data['players'];memberships:Data['memberships']}|null>(null),[eventLoading,setEventLoading]=useState(false);
 useEffect(()=>{if(demo||!eventId)return;let current=true;setEventLoading(true);fetch('/api/rally?view=event&event='+encodeURIComponent(eventId),{cache:'no-store'}).then(async r=>{const body=await r.json() as NonNullable<typeof loadedEvent>&{error?:string};if(!r.ok)throw new Error(body.error||'Could not open this event.');if(current)setLoadedEvent(body)}).catch(e=>{if(current){setError(e.message);setEventId(null)}}).finally(()=>{if(current)setEventLoading(false)});return()=>{current=false}},[demo,eventId,data,setEventId]);
 const [venue,setVenue]=useState(''),[schedule,setSchedule]=useState(''),[contact,setContact]=useState(''),[joining,setJoining]=useState('');
 useEffect(()=>{mounted.current=true;
  if(demo){try{const saved=sessionStorage.getItem('rally-demo-preview');setData(saved?JSON.parse(saved):createDemoData());}catch{}setLoading(false);return()=>{mounted.current=false;};}
  void refreshClub(true);
  const resume=()=>{if(document.visibilityState==='visible')void refreshClub();};
  const timer=window.setInterval(resume,15000);
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{mounted.current=false;invalidateReads();readAbort.current?.abort();readAbort.current=null;reading.current=false;window.clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[demo,id,refreshClub,invalidateReads]);
 async function act(payload:Record<string,unknown>,message:string){if(busyRef.current)return false;busyRef.current=true;readVersion.current++;setBusy(true);setError('');setNotice('');try{
  if(demo){const next=applyDemoAction(data,payload);setData(next);sessionStorage.setItem('rally-demo-preview',JSON.stringify(next));}
  else{const r=await fetch('/api/rally',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json() as {error?:string};if(!r.ok)throw new Error(result.error||'Could not save changes.');const read=await fetch('/api/rally?compact=1&clubScope='+encodeURIComponent(id),{cache:'no-store'});if(!read.ok)throw new Error('Saved. Refresh to load updated club information.');setData(await read.json() as Data);}
  setNotice(message+(demo?' Sample data only.':''));return true;
 }catch(e){setError(e instanceof Error?e.message:'Could not save changes.');return false}finally{busyRef.current=false;setBusy(false)}}
 const club=data.clubs.find(c=>c.id===id),membership=data.memberships.find(m=>m.club_id===id&&m.player_id===data.me?.id),canChat=membership?.status==='active'&&membership.role!=='guest',requests=data.memberships.filter(m=>m.club_id===id&&m.status==='pending'),events=data.tournaments.filter(t=>t.club_id===id),matches=data.matches.filter(m=>m.club_id===id&&m.status==='confirmed');
 // New-club setup: shown to the owner until every step is done.
 const setup=useSetup(id,club,club?.activeMemberCount??0),showSetup=!!club?.canAssignRoles&&club.approvalStatus!=='rejected'&&!setup.progress.complete&&!setup.hidden;
 const goTo=(target:string)=>window.setTimeout(()=>document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'start'}),60);
 const setupStep=(step:'logo'|'about'|'where'|'join'|'address'|'members')=>{
  if(step==='logo'){setImages(true);return;}
  if(step==='address'){goTo('manage-address');return;}
  if(step==='members'){goTo('manage-invite');return;}
  if(club){setName(club.name);setLocation(club.location);setBio(club.bio??'');setVenue(club.venue??'');setSchedule(club.meeting_schedule??'');setContact(club.contact??'');setJoining(club.joining_info??'');}
  setEditing(true);goTo('manage-details');
 };
 const player=(pid:string)=>data.players.find(p=>p.id===pid),base=demo?'/demo':'',back=demo?'/demo?tab=clubs':'/clubs';
 const eventDetail=!demo&&loadedEvent?.event.id===eventId?loadedEvent.event:events.find(t=>t.id===eventId),eventEntries=eventDetail?(!demo&&loadedEvent?.event.id===eventId?loadedEvent.entries:data.entries).filter(e=>e.tournament_id===eventDetail.id).map(e=>e.player_id):[],eventCandidates=eventDetail?(!demo&&loadedEvent?.event.id===eventId?loadedEvent.players:data.players).filter(p=>!eventEntries.includes(p.id)&&(!demo&&loadedEvent?.event.id===eventId?loadedEvent.memberships:data.memberships).some(m=>m.club_id===id&&m.player_id===p.id&&m.status==='active')):[];
 function eventCards(list:typeof events){return list.map(t=>{const entrants=data.entries.filter(e=>e.tournament_id===t.id),registered=entrants.some(e=>e.player_id===data.me?.id),count=t.entry_count??entrants.length,full=count>=t.capacity,closed=registrationClosed(t);return <article className="club-tournament-card" key={t.id}><div><a href={`${base}/tournaments/${t.id}`}><h3>{t.name}</h3></a><p>{dateLabel(t.date)} · {t.format} · {count}/{t.capacity} players</p>{t.starts_at&&<p>Starts <TimeLabel value={t.starts_at}/></p>}{t.registration_closes_at&&<p>Registration closes <TimeLabel value={t.registration_closes_at}/></p>}<span className="badge">{t.status==='registration'?(closed?'Registration closed':full?'Registration full':'Registration open'):t.status==='active'?'In progress':'Completed'}</span>{registered&&<span className="badge">You’re registered</span>}</div><div className="club-buttons">{t.status==='registration'&&!loading&&(registered?<Button variant="outline" disabled={busy} onClick={()=>setEventId(t.id)}>Manage my entry</Button>:closed?<span>Registration deadline passed</span>:full?<span>Player limit reached</span>:membership?.status==='active'&&data.me?<Button disabled={busy} onClick={()=>void act({action:'enter_tournament',id:t.id,revision:t.revision,operationId:crypto.randomUUID(),playerId:data.me!.id},'You are registered.')}>Register</Button>:data.me?<a href="#club-membership" onClick={()=>setSection('about')}>{membership?.status==='pending'?'Club approval needed to register':'Join this club to register'}</a>:<a href={`/login?next=${encodeURIComponent('/clubs/'+id)}`}>Sign in to register</a>)}{club?.canManage&&<Button variant="outline" onClick={()=>setEventId(t.id)}>{t.status==='registration'?'Manage registration':'Manage tournament'}</Button>}</div></article>})}
 return <><PublicHeader demo={demo} account={data.me?<AccountMenu profileHref={`${demo?'/demo':''}/players/${data.me.id}`} name={data.me.name} demo={demo} unreadCount={data.notifications?.filter(n=>!n.read).length??0} onProfile={()=>window.location.assign(demo?'/demo/account':'/account')}/>:undefined}/>{demo&&<div className="demo-note">Sample club · changes reset when browser storage is cleared</div>}<main className="public-page club-detail"><a className="club-back-link" href={back}><ArrowLeft size={20}/>All clubs</a>{error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-success" role="status">{notice}</p>}{club?<>
 <section className="club-profile" aria-label={`${club.name} profile`}>
  <div className="club-cover">{club.banner_url?<img src={club.banner_url} alt={`${club.name} banner`}/>:<div className="club-cover-fill" aria-hidden="true"/>}</div>
  <div className="club-profile-body">
   <div className="club-avatar-wrap">{club.photo_url?<Avatar name={club.name} photoUrl={club.photo_url} large/>:<span className="club-initial" aria-hidden="true">{club.name.slice(0,1).toUpperCase()}</span>}</div>
   <div className="club-profile-main">
    <h1>{club.name}</h1><p className="club-location">{club.location}</p>
    {club.approvalStatus==='pending'&&club.canManage&&<span className="badge" title="Your club works now. It appears in public lists once Rally verifies it.">Not listed publicly yet</span>}{club.approvalStatus==='rejected'&&<span className="badge">Not approved</span>}
    {club.bio&&<p className="club-tagline">{club.bio}</p>}
    <div className="club-stats"><span><b>{club.activeMemberCount}</b> members</span><span><b>{data.summaries?.[id]?.confirmed??matches.length}</b> verified matches</span><span><b>{data.eventCounts?.[id]??events.length}</b> tournaments</span></div>
    <div className="club-actions">
     {!data.me?<a className="club-join-link" href={`/login?next=${encodeURIComponent('/clubs/'+id)}`}>Sign in to join</a>:membership?.status==='active'?<><span className="club-member-badge">Member{membership.role!=='member'?` · ${membership.role}`:''}</span>{membership.role!=='owner'&&<Button variant="ghost" disabled={busy} onClick={async()=>{if(!window.confirm(`Leave ${club.name}? Your past results stay. You can ask to join again later.`))return;await act({action:'leave_club',clubId:id},'You left the club.');}}>Leave club</Button>}</>:membership?.status==='pending'?<><span className="club-member-badge">Request pending</span><Button variant="ghost" disabled={busy} onClick={()=>void act({action:'cancel_join_request',clubId:id},'Request cancelled.')}>Cancel request</Button></>:club.approvalStatus!=='rejected'&&!loading?<Button disabled={busy} onClick={async()=>{if(await act({action:'request_join',clubId:id},'Membership request sent.')&&isUmbcClub(club.name))offerUmbcColorway()}}>Request to join</Button>:null}
     {canChat&&<Button variant="outline" onClick={()=>openChat(true)}><MessageCircle size={18}/>Chat{unread>0&&<span className="badge">{unread}</span>}</Button>}
     {club.approvalStatus!=='rejected'&&<ClubInvite id={id} name={club.name} slug={club.slug} demo={demo}/>}
     {club.canManage&&(section==='management'?<Button variant="outline" onClick={()=>openManage(false)}><ArrowLeft size={18}/>Back to club page</Button>:<Button variant="outline" onClick={()=>openManage(true)}><Settings size={18}/>Manage{requests.length>0&&<span className="badge">{requests.length}</span>}</Button>)}
    </div>
   </div>
  </div>
 </section>
 {section==='management'&&club.canManage?<>
 <nav className="club-jump" id="club-management" aria-label="Jump to a management section">{([['requests','Requests'+(requests.length?` (${requests.length})`:'')],['members','Members & roles'],['announcements','Announcements'],['invite','Invite link'],['address','Web address'],['details','Club settings'],['discord','Discord']] as [string,string][]).map(([k,l])=><a key={k} href={`#manage-${k}`} onClick={e=>{e.preventDefault();document.getElementById('manage-'+k)?.scrollIntoView({behavior:'smooth',block:'start'});}}>{l}</a>)}</nav>
 <div className="club-sections">
{showSetup&&<div className="club-block" id="manage-setup"><ClubSetupChecklist steps={setup.steps} progress={setup.progress} onStep={setupStep} onHide={setup.hide}/></div>}
<div className="club-block" id="manage-requests">
<section className="panel club-detail-section club-request-panel"><div className="club-request-heading"><h2>Member requests ({requests.length})</h2><Button variant="outline" disabled={busy||refreshing} onClick={()=>void refreshClub(true)}>{refreshing?'Refreshing…':'Refresh requests'}</Button></div><p className="profile-help">Updates automatically while this page is open.</p>{requests.length?requests.map(m=>{const applicant=player(m.player_id);return <article className="club-request-row" key={m.player_id}><a className="person" href={`${base}/players/${m.player_id}?from=${encodeURIComponent(base+'/clubs/'+id+'?section=management')}`}><Avatar name={applicant?.name??'Player'} photoUrl={applicant?.photo_url}/><span><strong>{applicant?.name??'Player profile unavailable'}</strong><small>Requested to join this club</small></span></a><div className="club-request-actions"><Button disabled={busy||!applicant} aria-label={`Approve ${applicant?.name??'member'}`} onClick={()=>void act({action:'approve_member',clubId:id,playerId:m.player_id},'Member approved.')}>Approve</Button><Button variant="outline" disabled={busy||!applicant} aria-label={`Decline ${applicant?.name??'member'}`} onClick={()=>void act({action:'decline_member',clubId:id,playerId:m.player_id},'Request declined.')}>Decline</Button></div></article>;}):<p>No pending requests.</p>}</section>
</div>
<div className="club-block" id="manage-members">
<ClubRoster id={id} data={data} demo={demo} owner={!!club.canAssignRoles} busy={busy} act={act}/>
</div>
<div className="club-block" id="manage-announcements">
{!demo&&membership?.status==='active'?<AnnouncementsBoard clubId={id} canPublish/>:<section className="panel club-detail-section"><h2>Club announcements</h2><p>Sample announcements do not publish to real accounts.</p></section>}
</div>
<div className="club-block" id="manage-invite">
<ClubInviteLink clubId={id} clubName={club.name} demo={demo}/>
</div>
<div className="club-block" id="manage-address">
<ClubAddress clubId={id} clubName={club.name} slug={club.slug} demo={demo} act={act} refresh={()=>refreshClub(true)}/>
</div>
<div className="club-block" id="manage-details">
<section className="panel club-detail-section club-management"><h2>Club settings</h2>{!demo&&membership?.status==='active'&&['owner','admin'].includes(membership.role)&&<div className="manage-group"><ClubExports clubId={id}/></div>}<div className="manage-group"><h3>Club details</h3><div className="club-buttons">{club.canAssignRoles&&<Button variant="outline" disabled={busy} onClick={()=>{setName(club.name);setLocation(club.location);setBio(club.bio??'');setVenue(club.venue??'');setSchedule(club.meeting_schedule??'');setContact(club.contact??'');setJoining(club.joining_info??'');setEditing(v=>!v);}}>Edit club information</Button>}<Button variant="outline" onClick={()=>setImages(true)}>Edit club images</Button><Button asChild variant="outline"><a href={`${demo?'/demo':'/clubhouse'}?tab=tournaments`}>Manage tournaments</a></Button></div></div>{editing&&<form className="club-info-form" onSubmit={async e=>{e.preventDefault();if(await act({action:'update_club',clubId:id,name,location,bio,venue,meeting_schedule:schedule,contact,joining_info:joining},'Club information saved.'))setEditing(false);}}><label htmlFor="club-name">Club name</label><input id="club-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} required disabled={busy}/><label htmlFor="club-location">Location</label><input id="club-location" value={location} onChange={e=>setLocation(e.target.value)} maxLength={100} required disabled={busy}/><label htmlFor="club-bio">Club bio</label><textarea id="club-bio" value={bio} onChange={e=>setBio(e.target.value)} maxLength={1200} rows={5} disabled={busy}/><label htmlFor="club-venue">Venue / address</label><input id="club-venue" value={venue} onChange={e=>setVenue(e.target.value)} maxLength={300} disabled={busy}/><label htmlFor="club-schedule">Meeting times</label><textarea id="club-schedule" value={schedule} onChange={e=>setSchedule(e.target.value)} maxLength={500} rows={3} disabled={busy}/><label htmlFor="club-contact">Public contact details</label><input id="club-contact" value={contact} onChange={e=>setContact(e.target.value)} maxLength={300} disabled={busy}/><label htmlFor="club-joining">Joining instructions</label><textarea id="club-joining" value={joining} onChange={e=>setJoining(e.target.value)} maxLength={800} rows={3} disabled={busy}/><p>These details are visible on the club page.</p><div className="club-buttons"><Button disabled={busy} type="submit">Save club information</Button><Button variant="ghost" type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</Button></div></form>}
 <div className="manage-group"><h3>Guest players</h3><form className="club-guest-form" onSubmit={async e=>{e.preventDefault();if(await act({action:'add_guest',id:crypto.randomUUID(),clubId:id,name:guest},'Guest player added.'))setGuest('');}}><label>Guest player name<input value={guest} onChange={e=>setGuest(e.target.value)} maxLength={60} required disabled={busy}/></label><Button disabled={busy} type="submit">Add guest player</Button></form></div></section>
</div>
<div className="club-block" id="manage-discord">
<ClubDiscord clubId={id} demo={demo}/>
</div>
 </div></>:<>
 {showSetup&&<aside className="club-setup-banner"><span><b>Finish setting up your club</b> · {setup.progress.done} of {setup.progress.total} done</span><Button size="sm" onClick={()=>openManage(true)}>Continue</Button></aside>}
 <nav className="club-jump" aria-label="Jump to a section">{([['about','About'],['announcements','Announcements'],['sessions','Sessions'],['competition','Competition'],['members','Members']] as [string,string][]).map(([k,l])=><a key={k} href={`#club-${k}`} onClick={e=>{e.preventDefault();document.getElementById('club-'+k)?.scrollIntoView({behavior:'smooth',block:'start'});}}>{l}</a>)}</nav>
 <div className="club-sections">
 <div className="club-block" id="club-about">
<section className="panel club-detail-section"><div className="club-detail-info" id="club-membership"><h2>About the club</h2><p className="player-bio">{club.bio||'This club has not added a bio yet.'}</p><dl className="club-practical">{[['Venue / address',club.venue],['Meeting times',club.meeting_schedule],['Contact',club.contact],['How to join',club.joining_info]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="club-totals"><span><b>{club.activeMemberCount}</b> members</span><span><b>{data.summaries?.[id]?.confirmed??matches.length}</b> verified matches</span><span><b>{data.eventCounts?.[id]??events.length}</b> tournaments</span></div>{!loading&&club.approvalStatus!=='rejected'&&(membership?<p className="badge">{membership.status==='pending'?'Membership requested':membership.status==='active'?`Your role: ${membership.role}`:'Membership request declined'}</p>:data.me?<Button disabled={busy} onClick={async()=>{if(await act({action:'request_join',clubId:id},'Membership request sent.')&&isUmbcClub(club.name))offerUmbcColorway()}}>Request to join</Button>:<a href={`/login?next=${encodeURIComponent(`/clubs/${id}`)}`}>Sign in to request membership</a>)}</div></section>
</div>
<div className="club-block" id="club-announcements">
{!demo&&membership?.status==='active'?<AnnouncementsBoard clubId={id} canPublish={false}/>:<section className="panel club-detail-section"><h2>Club announcements</h2><p>{demo?'Club announcements appear here for active members. Sample announcements do not publish to real accounts.':'Announcements are available to active members of this club.'}</p></section>}
</div>
<div className="club-block" id="club-sessions">
<ClubSessions clubId={id} clubName={club.name} demo={demo} me={data.me?.id??null} member={membership?.status==='active'} canManage={!!club.canManage}/>
</div>
<div className="club-block" id="club-competition">
<ClubSeasons clubId={id} data={data} demo={demo} busy={busy} act={act}/>

 <section className="panel club-detail-section"><h2>Upcoming tournaments</h2><ActivityPage<Data['tournaments'][number]> view="tournaments" query={new URLSearchParams({club:id,status:'upcoming'}).toString()} empty="No upcoming tournaments." demo={demo} demoItems={events.filter(t=>t.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date))} refreshKey={data} render={eventCards}/></section>{<details className="panel club-detail-section club-management"><summary>Past tournaments</summary><ActivityPage<Data['tournaments'][number]> view="tournaments" query={new URLSearchParams({club:id,status:'completed'}).toString()} empty="No past tournaments yet." demo={demo} demoItems={events.filter(t=>t.status==='completed').sort((a,b)=>b.date.localeCompare(a.date))} refreshKey={data} render={eventCards}/></details>}
 
</div>
<div className="club-block" id="club-members">
<ClubRoster id={id} data={data} demo={demo} owner={false} readOnly busy={busy} act={act}/>
</div>
 </div></>}
{canChat&&<Dialog open={section==='chat'} onOpenChange={o=>{if(!o)openChat(false)}}><DialogContent className="club-chat-dialog"><DialogTitle className="sr-only">{club.name} chat</DialogTitle><DialogDescription className="sr-only">Chat with members of {club.name}.</DialogDescription><div className="msg-convo club-chat-embed"><ClubChat clubId={id} clubName={club.name} demo={demo} embedded onBack={()=>openChat(false)} onRead={()=>setUnread(0)}/></div></DialogContent></Dialog>}
</>:loading?<p role="status">Loading club…</p>:<><h1>Club not available</h1><p>This club does not exist or is not published.</p></>}</main><TournamentPanel publicBase={`${base}/tournaments`} event={eventDetail??null} onClose={()=>setEventId(null)} players={!demo&&loadedEvent?.event.id===eventId?loadedEvent.players:data.players} entries={eventEntries} candidates={eventCandidates} admin={!!club?.canManage} me={data.me?.id??null} clubName={club?.name??''} busy={busy||eventLoading} act={act}/><ClubAppearance club={images&&club?.canManage?club:null} onClose={()=>setImages(false)} busy={busy} onSave={act}/></>;
}
