'use client';
import {useEffect,useState} from 'react';
import {Check} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {setupProgress,setupSteps,type SetupStep} from '@/lib/club-setup';
type Club={id:string;photo_url?:string|null;bio?:string|null;venue?:string|null;meeting_schedule?:string|null;contact?:string|null;joining_info?:string|null;slug?:string|null};
const key=(id:string)=>'rally-club-setup-hidden-'+id;
// For club owners: the few things that make a club easy to find and join. Disappears once everything is done.
export function useSetup(id:string,club:Club|undefined,activeMembers:number){
 const steps=setupSteps(club??{},activeMembers),progress=setupProgress(steps),[hidden,setHidden]=useState(true);
 useEffect(()=>{try{setHidden(localStorage.getItem(key(id))==='1');}catch{setHidden(false);}},[id]); // eslint-disable-line react-hooks/set-state-in-effect
 const hide=()=>{try{localStorage.setItem(key(id),'1');}catch{/* the card just comes back next visit */}setHidden(true);};
 return {steps,progress,hidden,hide};
}
export default function ClubSetupChecklist({steps,progress,onStep,onHide}:{steps:SetupStep[];progress:{done:number;total:number};onStep:(id:SetupStep['id'])=>void;onHide:()=>void}){
 return <section className="panel club-detail-section club-setup" aria-labelledby="club-setup-title">
  <div className="setup-head"><div><h2 id="club-setup-title">Finish setting up your club</h2><p>{progress.done} of {progress.total} done. A complete page helps new players decide to join.</p></div><Button variant="ghost" size="sm" onClick={onHide}>Hide for now</Button></div>
  <div className="setup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Setup progress"><span style={{width:`${(progress.done/progress.total)*100}%`}}/></div>
  <ul>{steps.map(s=><li key={s.id} className={s.done?'is-done':''}>
   <span className="setup-mark" aria-hidden="true">{s.done&&<Check size={14}/>}</span>
   <span className="setup-text"><b>{s.title}</b><small>{s.detail}</small></span>
   {s.done?<span className="setup-state">Done</span>:<Button variant="outline" size="sm" onClick={()=>onStep(s.id)}>{s.id==='members'?'Invite':s.id==='address'?'Choose':'Add'}</Button>}
  </li>)}</ul>
 </section>;
}
