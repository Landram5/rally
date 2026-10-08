import {AppError} from './rally-errors';
import {optionalInstant,optionalText} from './logistics';
import {expandWeeklySessions,weeklyInstant,type WeeklyTemplate} from './weekly-sessions';
export type ClubSession={id:string;club_id:string;clubName:string;title:string;location:string;notes:string;starts_at:string;ends_at:string;capacity:number|null;status:'scheduled'|'cancelled';revision:number;created_at:string;updated_at:string;canManage:boolean;attendees:{id:string;name:string;guests?:number}[];rsvp:'going'|'not_going'|'maybe'|'waitlisted'|null;guests?:number;waitlistPosition?:number|null;waitlistCount?:number;maybeCount?:number;repeat_weekly?:number;series_id?:string|null;seriesActive?:boolean;demoWaitlist?:{id:string;name:string;guests:number}[]};
const member="EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=s.club_id AND m.player_id=? AND m.status='active' AND c.approval_status='approved' AND p.deleted_at IS NULL)";
const manager=member.replace("AND m.status='active'","AND m.status='active' AND m.role IN ('owner','admin','board')");
export async function readSessions(db:D1Database,player:string,club?:string,now=new Date().toISOString()):Promise<ClubSession[]>{
 const rows=(await db.prepare(`SELECT s.*,c.name AS clubName,${manager} AS canManage FROM club_sessions s JOIN clubs c ON c.id=s.club_id WHERE ${member} AND (?='' OR s.club_id=?) AND s.ends_at>=? ORDER BY (s.ends_at>=?) DESC,s.starts_at,s.id LIMIT 90`).bind(player,player,club??'',club??'',new Date(Date.parse(now)-30*86400000).toISOString(),now).all<ClubSession>()).results;
 if(!rows.length)return [];
 const rsvps=(await db.prepare(`SELECT r.session_id,r.player_id AS id,p.name,r.status,r.guests,r.queued_at FROM session_rsvps r JOIN club_sessions s ON s.id=r.session_id JOIN profiles p ON p.id=r.player_id WHERE ${member} AND s.id IN (${rows.map(()=>'?').join(',')}) AND p.deleted_at IS NULL AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=s.club_id AND m.player_id=p.id AND m.status='active') ORDER BY r.queued_at,r.rowid`).bind(player,...rows.map(s=>s.id)).all<{session_id:string;id:string;name:string;status:ClubSession['rsvp'];guests:number}>()).results;
 const roots=[...new Set(rows.map(s=>s.series_id).filter((id):id is string=>!!id))];
 const series=roots.length?(await db.prepare(`SELECT id FROM club_sessions WHERE repeat_weekly=1 AND id IN (${roots.map(()=>'?').join(',')})`).bind(...roots).all<{id:string}>()).results:[];
 return rows.map(s=>{const mine=rsvps.find(r=>r.session_id===s.id&&r.id===player),queue=rsvps.filter(r=>r.session_id===s.id&&r.status==='waitlisted');return {...s,canManage:!!s.canManage,attendees:rsvps.filter(r=>r.session_id===s.id&&r.status==='going').map(({id,name,guests})=>({id,name,guests})),rsvp:mine?.status??null,guests:mine?.guests??0,waitlistPosition:mine?.status==='waitlisted'?queue.findIndex(r=>r.id===player)+1:null,waitlistCount:queue.length,maybeCount:rsvps.filter(r=>r.session_id===s.id&&r.status==='maybe').length,seriesActive:!!s.series_id&&series.some(root=>root.id===s.series_id)};});

}
export async function sessionAction(db:D1Database,player:string,body:Record<string,unknown>,now=new Date().toISOString()){
 const id=typeof body.id==='string'?body.id:'';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new AppError(400,'Invalid session ID.');
 if(body.action==='rsvp_session'){
  if(!['going','not_going','maybe'].includes(String(body.status)))throw new AppError(400,'Choose Going, Maybe or Not going.');
  const previous=await db.prepare('SELECT guests FROM session_rsvps WHERE session_id=? AND player_id=?').bind(id,player).first<{guests:number}>();
  const guests=body.guests===undefined?previous?.guests??0:body.guests;
  if(guests!==0&&guests!==1)throw new AppError(400,'Choose zero or one guest.');
  const result=await db.prepare(`INSERT INTO session_rsvps(session_id,player_id,status,guests,queued_at,updated_at)
   SELECT s.id,?,CASE WHEN ?!='going' THEN ? WHEN (s.capacity IS NULL OR (SELECT coalesce(sum(1+r.guests),0) FROM session_rsvps r JOIN memberships m ON m.player_id=r.player_id AND m.club_id=s.club_id JOIN profiles p ON p.id=r.player_id WHERE r.session_id=s.id AND r.status='going' AND m.status='active' AND p.deleted_at IS NULL AND r.player_id<>?)+1+?<=s.capacity)
   AND (EXISTS(SELECT 1 FROM session_rsvps WHERE session_id=s.id AND player_id=? AND status='going') OR NOT EXISTS(SELECT 1 FROM session_rsvps r JOIN profiles p ON p.id=r.player_id JOIN memberships m ON m.player_id=r.player_id AND m.club_id=s.club_id WHERE r.session_id=s.id AND r.status='waitlisted' AND r.player_id<>? AND m.status='active' AND p.deleted_at IS NULL)) THEN 'going' ELSE 'waitlisted' END,?,?,?
   FROM club_sessions s WHERE s.id=? AND s.status='scheduled' AND s.ends_at>? AND ${member}
   ON CONFLICT(session_id,player_id) DO UPDATE SET status=excluded.status,guests=excluded.guests,queued_at=CASE WHEN excluded.status='waitlisted' THEN CASE WHEN session_rsvps.status='waitlisted' THEN coalesce(session_rsvps.queued_at,excluded.queued_at) ELSE excluded.queued_at END ELSE NULL END,updated_at=excluded.updated_at`).bind(player,body.status,body.status,player,guests,player,player,guests,now,now,id,now,player).run();
  if(!result.meta.changes)throw new AppError(409,'This session ended, was cancelled, or your membership changed. Refresh and try again.');
  return {ok:true,...await db.prepare('SELECT status FROM session_rsvps WHERE session_id=? AND player_id=?').bind(id,player).first<{status:string}>()};
 }
 const operation=typeof body.operationId==='string'?body.operationId:id,payload=JSON.stringify(body);
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(operation))throw new AppError(400,'Invalid action ID.');
 const prior=await db.prepare('SELECT * FROM club_sessions WHERE id=?').bind(id).first<{created_by:string;operation_id:string;operation_payload:string;revision:number;series_id:string|null}>();
 if(prior?.operation_id===operation){if(prior.operation_payload!==payload)throw new AppError(409,'Action ID already used.');const permitted=await db.prepare(`SELECT 1 FROM club_sessions s WHERE s.id=? AND ${manager}`).bind(id,player).first();if(!permitted)throw new AppError(403,'Only active club organizers can edit sessions.');return {ok:true};}
 if(body.action==='stop_session_series'){
  const root=prior?.series_id;if(!root)throw new AppError(400,'This session does not repeat.');
  const allowed=await db.prepare(`SELECT 1 FROM club_sessions s WHERE s.id=? AND ${manager}`).bind(id,player).first();if(!allowed)throw new AppError(403,'Only active club organizers can stop repeating sessions.');
  const previous=await db.prepare('SELECT operation_id,operation_payload FROM club_sessions WHERE id=?').bind(root).first<{operation_id:string;operation_payload:string}>();
  if(previous?.operation_id===operation){if(previous.operation_payload!==payload)throw new AppError(409,'Action ID already used.');return {ok:true};}
  try{await db.batch([db.prepare(`UPDATE club_sessions AS s SET repeat_weekly=0,operation_id=?,operation_payload=? WHERE id=? AND ${manager} AND EXISTS(SELECT 1 FROM club_sessions current WHERE current.id=? AND current.revision=?)`).bind(operation,payload,root,player,id,body.revision??prior.revision),db.prepare('INSERT INTO account_change_guards(changed) VALUES(changes())'),db.prepare(`UPDATE club_sessions AS s SET status='cancelled',revision=revision+1,updated_at=? WHERE series_id=? AND starts_at>? AND status='scheduled' AND ${manager} AND EXISTS(SELECT 1 FROM club_sessions root WHERE root.id=? AND root.repeat_weekly=0)`).bind(now,root,now,player,root)]);}catch{throw new AppError(409,'Session or organizer access changed. Refresh and try again.');}return {ok:true};
 }
 if(body.action==='cancel_session'){
  const result=await db.prepare(`UPDATE club_sessions AS s SET status='cancelled',revision=revision+1,updated_at=?,operation_id=?,operation_payload=? WHERE id=? AND revision=? AND status='scheduled' AND ${manager}`).bind(now,operation,payload,id,body.revision,player).run();if(!result.meta.changes)throw new AppError(409,'Session or organizer access changed. Refresh and try again.');return {ok:true};
 }
 if(!['create_session','edit_session'].includes(String(body.action)))throw new AppError(400,'Unknown session action.');
 const title=optionalText(body.title,'Title',100),location=optionalText(body.location,'Location',200),notes=optionalText(body.notes,'Notes',1000),starts=optionalInstant(body.startsAt,'start time'),ends=optionalInstant(body.endsAt,'end time'),capacity=body.capacity===null?null:Number(body.capacity);
 if(!title||!starts||!ends||ends<=starts||ends<=now||Date.parse(ends)-Date.parse(starts)>86400000||capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>1000))throw new AppError(400,'Add a title, a future end time after the start (within 24 hours), and an optional capacity of 1–1,000.');
 if(body.action==='create_session'){
  if(prior)throw new AppError(409,'Session ID already used.');
  const weekly=body.repeatWeekly===true;
  if(body.repeatWeekly!==undefined&&typeof body.repeatWeekly!=='boolean')throw new AppError(400,'Choose whether to repeat weekly.');
  const timezone=weekly&&typeof body.timezone==='string'?body.timezone:'UTC';if(timezone.length>100||weekly&&id.length>60)throw new AppError(400,'Invalid weekly session settings.');
  weeklyInstant(starts,0,timezone);
  const template:WeeklyTemplate={title,location,notes,starts,ends,capacity,timezone};
  const result=await db.prepare(`INSERT INTO club_sessions(id,club_id,title,location,notes,starts_at,ends_at,capacity,created_by,created_at,updated_at,operation_id,operation_payload,repeat_weekly,recurrence_json,series_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board') AND c.approval_status='approved' AND p.deleted_at IS NULL)`).bind(id,body.clubId,title,location,notes,starts,ends,capacity,player,now,now,operation,payload,weekly?1:0,weekly?JSON.stringify(template):null,weekly?id:null,body.clubId,player).run();if(!result.meta.changes)throw new AppError(403,'Only active club organizers can create sessions.');if(weekly)await expandWeeklySessions(db,now,id);
 }else{
  const result=await db.prepare(`UPDATE club_sessions AS s SET title=?,location=?,notes=?,starts_at=?,ends_at=?,capacity=?,revision=revision+1,updated_at=?,operation_id=?,operation_payload=? WHERE id=? AND revision=? AND status='scheduled' AND ${manager} AND (? IS NULL OR (SELECT coalesce(sum(1+r.guests),0) FROM session_rsvps r JOIN memberships m ON m.club_id=s.club_id AND m.player_id=r.player_id JOIN profiles p ON p.id=r.player_id WHERE r.session_id=s.id AND r.status='going' AND m.status='active' AND p.deleted_at IS NULL)<=?)`).bind(title,location,notes,starts,ends,capacity,now,operation,payload,id,body.revision,player,capacity,capacity).run();if(!result.meta.changes)throw new AppError(409,'Session, attendance, or organizer access changed. Capacity cannot be below existing RSVPs.');
 }return {ok:true};
}
