import {defaultPreferences,preferenceKey,type NotificationPreferences} from './notification-preferences';
import type {Feedback} from './feedback-types';
import type {Ownership} from './record-ownership';
import type {Draw} from './tournament-engine';
export type RallyNotification={id:string;title:string;detail:string;href:string;kind:'match'|'registration'|'tournament'|'record'|'feedback'|'announcement';read:boolean;actionNeeded?:boolean;date?:string};
type Source={announcements?:import('./announcements').Announcement[];feedback?:Feedback[];preferences?:NotificationPreferences;ownership?:Ownership;me:{id:string;name:string}|null;matches:{id:string;a:string;b:string;canConfirm:boolean}[];players:{id:string;name:string}[];clubs:{id:string;name:string}[];memberships:{club_id:string;player_id:string;status:string}[];entries:{tournament_id:string;player_id:string}[];tournaments:{id:string;name:string;club_id:string;date:string;capacity:number;status:string;check_in_open?:number;allow_visitors?:number;waitlist?:{player_id:string;position:number}[];checkedIn?:string[];revision:number;registration_closes_at?:string|null;state:Draw|null}[]};
export function notificationsFor(data:Source,readIds:string[]=[],demo=false,today=new Date().toISOString().slice(0,10)):RallyNotification[]{
 if(!data.me)return [];const me=data.me.id,base=demo?'/demo':'/clubhouse',reads=new Set(readIds),notices:RallyNotification[]=[],name=(id:string)=>data.players.find(p=>p.id===id)?.name??'Player';
 const add=(id:string,title:string,detail:string,href:string,kind:RallyNotification['kind'],actionNeeded=false,date?:string)=>notices.push({id,title,detail,href,kind,actionNeeded,date,read:reads.has(id)});
 for(const m of data.matches.filter(m=>m.canConfirm))add(`match-${m.id}`,'Verify a match',`${name(m.a)} vs ${name(m.b)}`,`${base}?tab=matches&match=${encodeURIComponent(m.id)}`,'match',true);
 for(const t of data.tournaments){const entered=data.entries.some(e=>e.tournament_id===t.id&&e.player_id===me),member=data.memberships.some(m=>m.club_id===t.club_id&&m.player_id===me&&m.status==='active'),href=`${base}?tab=tournaments&event=${t.id}`;
  if(t.status==='registration'&&(member||t.allow_visitors)&&!entered&&t.date>=today&&(!t.registration_closes_at||t.registration_closes_at>new Date().toISOString())&&data.entries.filter(e=>e.tournament_id===t.id).length<t.capacity)add(`register-${t.id}`,'Tournament registration is open',`${t.name} · ${t.date}`,href,'registration',true);
  const waiting=t.waitlist?.find(w=>w.player_id===me);if(waiting)add(`waitlist-${t.id}-${waiting.position}`,'You are on the tournament waitlist',`${t.name} · position #${waiting.position}`,href,'registration');
  if(entered&&t.status==='registration')add(`entry-${t.id}`,'Your tournament registration is confirmed',t.name,href,'registration');
  if(entered&&t.check_in_open&&t.status!=='completed'&&!t.checkedIn?.includes(me))add(`checkin-${t.id}`,'Tournament check-in is open',t.name,href,'tournament',true);
  if(entered&&t.status==='active'){
   for(const f of t.state?.fixtures.filter(f=>f.status==='ready'&&(f.a===me||f.b===me))??[])add(`fixture-${t.id}-${f.id}`,'Your tournament match is ready',`${t.name} · ${name(f.a!)} vs ${name(f.b!)}`,href,'tournament',true);
   add(`started-${t.id}`,'Your tournament has started',t.name,href,'tournament');
  }
  if(entered&&t.status==='completed'&&Date.parse(t.date)>=Date.parse(today)-30*86400000)add(`completed-${t.id}-${t.revision}`,'Tournament results are available',t.name,href,'tournament');
 }
 for(const c of data.ownership?.claims??[]){const href=demo?'/demo/records':'/records';if(c.status==='pending'&&c.canReview&&c.claimant_id!==me)add('claim-'+c.id,'Review a guest record claim',c.claimantName+' requests '+c.guestName,href,'record',true);else if(c.claimant_id===me&&c.status!=='pending')add('claim-'+c.id+'-'+c.status,'Your guest claim was '+c.status,c.guestName,href,'record');}
 for(const r of data.ownership?.reviews??[]){const href=(demo?'/demo/records':'/records')+'?match='+encodeURIComponent(r.match_id);if(r.status==='pending'&&r.canReview)add('review-'+r.id,'Review a match dispute',r.requesterName,href,'record',true);else if(r.requested_by===me&&r.status!=='pending')add('review-'+r.id+'-'+r.status,'Your match review was '+r.status,r.resolution,href,'record');}
 for(const f of data.feedback??[]){if(f.submitted_by===me&&(f.updates?.length??0)>0)add('feedback-'+f.id+'-'+(f.revision??f.updated_at),'Your '+(f.type==='bug'?'bug report':'feature request')+' was updated',f.title+' · '+f.status.replaceAll('_',' '),demo?'/demo/feedback':'/feedback','feedback',false,f.updated_at);}
 for(const a of [...(data.announcements??[])].reverse())notices.unshift({id:'announcement-'+a.id,title:a.title,detail:(a.clubName??'Rally')+' · '+a.body,href:a.club_id?'/clubs/'+a.club_id+'?section=announcements':'/announcements',kind:'announcement',read:reads.has('announcement-'+a.id),date:a.created_at});
 return notices.filter(n=>n.kind==='announcement'||(data.preferences??defaultPreferences)[preferenceKey[n.kind]]).sort((a,b)=>Number(b.kind==='record')-Number(a.kind==='record')).slice(0,100);
}
