'use client';
import {useState} from 'react';
import {TimeLabel} from './time-label';
import {Button} from '@/components/ui/button';
import PlayerSearchPicker from './player-search-picker';
import type {Tournament} from './tournament-panel';
import {registrationClosed} from '@/lib/logistics';
type Person={id:string;name:string};
type Props={event:Tournament;me:string|null;entered:boolean;hostMember:boolean;admin:boolean;name:(id:string)=>string;busy:boolean;act:(payload:Record<string,unknown>,message:string)=>Promise<boolean>;teams?:{id:string;p1:string;p2:string;name:string}[];partners?:Person[]};
// Doubles: a player registers a team of two by choosing a partner. Either partner (or an organizer) can withdraw the team.
function TeamRegistration({event:t,me,hostMember,busy,act,teams=[],partners=[]}:Pick<Props,'event'|'me'|'hostMember'|'busy'|'act'|'teams'|'partners'>){
 const [partner,setPartner]=useState(''),closed=registrationClosed(t),mine=teams.find(x=>x.p1===me||x.p2===me),waiting=t.team_waitlist?.find(w=>w.p1===me||w.p2===me),full=(t.entry_count??0)>=t.capacity,eligible=!!me&&(hostMember||!!t.allow_visitors);
 const options=partners.filter(p=>p.id!==me);
 return <section className="registration-options doubles-registration"><p>{t.allow_visitors?'Visiting players welcome. Host-club membership is not required.':'Registration is for active host-club members.'} This is a doubles event: register a team of two.</p>
  {!me&&<p>Create your player profile in Account settings before registering.</p>}
  {mine?<div className="dashboard-callout"><p>Your team: <strong>{mine.name}</strong></p></div>:waiting?<div className="dashboard-callout"><p>Your team <strong>{waiting.name}</strong> is #{waiting.position} on the waitlist. You will be registered automatically if a place opens.</p></div>
   :!closed&&eligible&&(<div className="entry-control doubles-entry"><PlayerSearchPicker label="Your partner" placeholder="Choose your partner" value={partner} onChange={setPartner} options={options}/><Button disabled={busy||!partner} onClick={async()=>{if(await act({action:full?'join_team_waitlist':'enter_team',id:t.id,revision:t.revision,operationId:crypto.randomUUID(),partnerId:partner},full?'Your team joined the waitlist.':'Your team is registered.'))setPartner('')}}>{full?'Join waitlist':'Register team'}</Button></div>)}
  {!mine&&!eligible&&me&&!closed&&<p>Join the host club to enter this members-only event.</p>}
  {!mine&&!waiting&&eligible&&!closed&&options.length===0&&<p>No available partners right now. Everyone eligible is already on a team.</p>}
 </section>;
}
export default function TournamentRegistration(props:Props){
 const {event:t,me,entered,hostMember,admin,name,busy,act}=props;
 if(t.team_size===2)return <TeamRegistration event={t} me={me} hostMember={hostMember} busy={busy} act={act} teams={props.teams} partners={props.partners}/>;
 const closed=registrationClosed(t),waiting=t.waitlist?.find(w=>w.player_id===me),full=(t.entry_count??0)>=t.capacity||!!t.waitlist_count,eligible=!!me&&(hostMember||!!t.allow_visitors);
 const action=(type:string,playerId=me)=>void act({action:type,id:t.id,revision:t.revision,operationId:crypto.randomUUID(),playerId},type==='join_waitlist'?'Added to the waitlist.':type==='leave_waitlist'?'Left the waitlist.':'You are registered.');
 return <section className="registration-options"><p>{t.allow_visitors?'Visiting players welcome. Host-club membership is not required.':'Registration is for active host-club members.'}</p>{!me&&<p>Create your player profile in Account settings before registering.</p>}{waiting?<div className="dashboard-callout"><p>You are #{waiting.position} on the waitlist. Places are offered in joining order while registration is open.</p>{waiting.claim_expires_at&&<><p>Your place is reserved until <TimeLabel value={waiting.claim_expires_at}/>.</p><Button disabled={busy} onClick={()=>action('claim_waitlist_place')}>Claim place</Button></>}<Button variant="outline" disabled={busy} onClick={()=>action('leave_waitlist')}>Leave waitlist</Button></div>:!entered&&!closed&&eligible&&<Button disabled={busy} onClick={()=>action(full?'join_waitlist':'enter_tournament')}>{full?'Join waitlist':'Register yourself'}</Button>}{!entered&&!eligible&&me&&!closed&&<p>Join the host club to enter this members-only event.</p>}{!!t.waitlist_count&&<p>{t.waitlist_count} waiting · places are reserved with a claim deadline when an entrant leaves or the limit increases before registration closes. Remaining waitlist entries close when the draw starts.</p>}{admin&&!!t.waitlist?.length&&<details><summary>Manage waitlist ({t.waitlist_count})</summary>{t.waitlist.map(w=><div className="entrant-row" key={w.player_id}><span>#{w.position}</span><span>{name(w.player_id)}{w.claim_expires_at&&<small>Claim by <TimeLabel value={w.claim_expires_at}/></small>}</span>{w.claim_expires_at&&<Button disabled={busy} onClick={()=>action('claim_waitlist_place',w.player_id)}>Confirm attendance</Button>}<Button variant="ghost" disabled={busy} onClick={()=>action('leave_waitlist',w.player_id)}>Remove from waitlist</Button></div>)}</details>}</section>;
}
