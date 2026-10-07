import {AppError} from './rally-errors';
import {optionalInstant,optionalText} from './logistics';
export type ClubSession={id:string;club_id:string;clubName:string;title:string;location:string;notes:string;starts_at:string;ends_at:string;capacity:number|null;status:'scheduled'|'cancelled';revision:number;created_at:string;updated_at:string;canManage:boolean;attendees:{id:string;name:string}[];rsvp:'going'|'not_going'|null};
const member="EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=s.club_id AND m.player_id=? AND m.status='active' AND c.approval_status='approved' AND p.deleted_at IS NULL)";
const manager=member.replace("AND m.status='active'","AND m.status='active' AND m.role IN ('owner','admin','board')");
export async function readSessions(db:D1Database,player:string,club?:string,now=new Date().toISOString()):Promise<ClubSession[]>{
 const rows=(await db.prepare(`SELECT s.*,c.name AS clubName,${manager} AS canManage FROM club_sessions s JOIN clubs c ON c.id=s.club_id WHERE ${member} AND (?='' OR s.club_id=?) AND s.ends_at>=? ORDER BY (s.ends_at>=?) DESC,s.starts_at,s.id LIMIT 100`).bind(player,player,club??'',club??'',new Date(Date.parse(now)-30*86400000).toISOString(),now).all<ClubSession>()).results;
 if(!rows.length)return [];
 const rsvps=(await db.prepare(`SELECT r.session_id,r.player_id AS id,p.name,r.status FROM session_rsvps r JOIN club_sessions s ON s.id=r.session_id JOIN profiles p ON p.id=r.player_id WHERE ${member} AND s.id IN (${rows.map(()=>'?').join(',')}) AND p.deleted_at IS NULL AND EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=s.club_id AND m.player_id=p.id AND m.status='active')`).bind(player,...rows.map(s=>s.id)).all<{session_id:string;id:string;name:string;status:'going'|'not_going'}>()).results;
 return rows.map(s=>({...s,canManage:!!s.canManage,attendees:rsvps.filter(r=>r.session_id===s.id&&r.status==='going').map(({id,name})=>({id,name})),rsvp:rsvps.find(r=>r.session_id===s.id&&r.id===player)?.status??null}));
}
export async function sessionAction(db:D1Database,player:string,body:Record<string,unknown>,now=new Date().toISOString()){
 const id=typeof body.id==='string'?body.id:'';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new AppError(400,'Invalid session ID.');
 if(body.action==='rsvp_session'){
  if(!['going','not_going'].includes(String(body.status)))throw new AppError(400,'Choose Going or Not going.');
  const result=await db.prepare(`INSERT INTO session_rsvps(session_id,player_id,status,updated_at) SELECT s.id,?,?,? FROM club_sessions s WHERE s.id=? AND s.status='scheduled' AND s.ends_at>? AND ${member} AND (?='not_going' OR s.capacity IS NULL OR (SELECT count(*) FROM session_rsvps r JOIN memberships m ON m.player_id=r.player_id AND m.club_id=s.club_id JOIN profiles p ON p.id=r.player_id WHERE r.session_id=s.id AND r.status='going' AND m.status='active' AND p.deleted_at IS NULL AND r.player_id<>?)<s.capacity) ON CONFLICT(session_id,player_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`).bind(player,body.status,now,id,now,player,body.status,player).run();
  if(!result.meta.changes)throw new AppError(409,'This session is full, ended, cancelled, or your membership changed. Refresh and try again.');return {ok:true};
 }
 const operation=typeof body.operationId==='string'?body.operationId:id,payload=JSON.stringify(body);
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(operation))throw new AppError(400,'Invalid action ID.');
 const prior=await db.prepare('SELECT * FROM club_sessions WHERE id=?').bind(id).first<{created_by:string;operation_id:string;operation_payload:string;revision:number}>();
 if(prior?.operation_id===operation){if(prior.operation_payload!==payload)throw new AppError(409,'Action ID already used.');const permitted=await db.prepare(`SELECT 1 FROM club_sessions s WHERE s.id=? AND ${manager}`).bind(id,player).first();if(!permitted)throw new AppError(403,'Only active club organizers can edit sessions.');return {ok:true};}
 if(body.action==='cancel_session'){
  const result=await db.prepare(`UPDATE club_sessions AS s SET status='cancelled',revision=revision+1,updated_at=?,operation_id=?,operation_payload=? WHERE id=? AND revision=? AND status='scheduled' AND ${manager}`).bind(now,operation,payload,id,body.revision,player).run();if(!result.meta.changes)throw new AppError(409,'Session or organizer access changed. Refresh and try again.');return {ok:true};
 }
 if(!['create_session','edit_session'].includes(String(body.action)))throw new AppError(400,'Unknown session action.');
 const title=optionalText(body.title,'Title',100),location=optionalText(body.location,'Location',200),notes=optionalText(body.notes,'Notes',1000),starts=optionalInstant(body.startsAt,'start time'),ends=optionalInstant(body.endsAt,'end time'),capacity=body.capacity===null?null:Number(body.capacity);
 if(!title||!starts||!ends||ends<=starts||ends<=now||Date.parse(ends)-Date.parse(starts)>86400000||capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>1000))throw new AppError(400,'Add a title, a future end time after the start (within 24 hours), and an optional capacity of 1–1,000.');
 if(body.action==='create_session'){
  if(prior)throw new AppError(409,'Session ID already used.');
  const result=await db.prepare(`INSERT INTO club_sessions(id,club_id,title,location,notes,starts_at,ends_at,capacity,created_by,created_at,updated_at,operation_id,operation_payload) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board') AND c.approval_status='approved' AND p.deleted_at IS NULL)`).bind(id,body.clubId,title,location,notes,starts,ends,capacity,player,now,now,operation,payload,body.clubId,player).run();if(!result.meta.changes)throw new AppError(403,'Only active club organizers can create sessions.');
 }else{
  const result=await db.prepare(`UPDATE club_sessions AS s SET title=?,location=?,notes=?,starts_at=?,ends_at=?,capacity=?,revision=revision+1,updated_at=?,operation_id=?,operation_payload=? WHERE id=? AND revision=? AND status='scheduled' AND ${manager} AND (? IS NULL OR (SELECT count(*) FROM session_rsvps r JOIN memberships m ON m.club_id=s.club_id AND m.player_id=r.player_id WHERE r.session_id=s.id AND r.status='going' AND m.status='active')<=?)`).bind(title,location,notes,starts,ends,capacity,now,operation,payload,id,body.revision,player,capacity,capacity).run();if(!result.meta.changes)throw new AppError(409,'Session, attendance, or organizer access changed. Capacity cannot be below existing RSVPs.');
 }return {ok:true};
}
