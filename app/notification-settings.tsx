'use client';
import {useState} from 'react';
import {defaultPreferences,type NotificationPreferences} from '@/lib/notification-preferences';
import PushSettings from './push-settings';
type Key=keyof NotificationPreferences;
// Everyday choices first; the rest sit under "More notification settings". Each switch saves on its own.
const EVERYDAY:[Key,string,string][]=[
 ['match_updates','Matches to confirm','When someone records a match with you, or a result needs your review.'],
 ['tournament_updates','Tournaments','Draws, results and call-ups for events you entered.'],
 ['registration_updates','Clubs and waitlists','Membership decisions and waitlist spots.'],
 ['session_reminders','Session reminders','A reminder within 24 hours of a session you RSVP to.'],
 ['tournament_reminders','Tournament reminders','Start times and registration deadlines within 24 hours.'],
];
const MORE:[Key,string,string][]=[
 ['verification_reminders','Unconfirmed match reminder','When a match has waited more than a day for your confirmation.'],
 ['record_updates','Old results and match reviews','Requests to claim guest results, and reviews of disputed scores.'],
 ['feedback_updates','Replies to your feedback','Updates on bug reports and feature requests you sent.'],
];
const DELIVERY:[Key,string,string][]=[
 ['email_delivery','Email','Match confirmations, tournament call-ups and session reminders by email.'],
 ['push_delivery','Phone alerts','The same alerts on this phone or computer. Turn it on below for each device.'],
];
export default function NotificationSettings({initial,onSave,disabled=false,live=false}:{initial?:NotificationPreferences|null;onSave:(p:NotificationPreferences)=>Promise<void>;disabled?:boolean;live?:boolean}){
 const [values,setValues]=useState({...defaultPreferences,...initial}),[saving,setSaving]=useState<Key|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function toggle(key:Key,on:boolean){
  const previous=values,next={...values,[key]:on};
  setValues(next);setSaving(key);setError('');setMessage('');
  try{await onSave(next);setMessage('Saved.');}
  catch(e){setValues(previous);setError(e instanceof Error?e.message:'Could not save. Try again.');}
  finally{setSaving(null);}
 }
 const row=([key,title,detail]:[Key,string,string])=><label className="notification-choice" key={key}><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={values[key]} disabled={disabled||saving!==null} onChange={e=>void toggle(key,e.target.checked)}/></label>;
 return <section id="notifications" className="notification-settings"><h2>Notifications</h2>
  <p>Choose what shows up in your Rally inbox. Changes save as you go.</p>
  <div className="notification-group">{EVERYDAY.map(row)}</div>
  <details className="notification-more"><summary>More notification settings</summary><div className="notification-group">{MORE.map(row)}</div></details>
  <h3>Also send them to me by</h3>
  <div className="notification-group">{DELIVERY.map(row)}</div>
  <p className="profile-help" role="status" aria-live="polite">{error?'':message}</p>{error&&<p className="auth-error" role="alert">{error}</p>}
  {live&&!disabled&&values.push_delivery&&<PushSettings/>}
 </section>;
}
