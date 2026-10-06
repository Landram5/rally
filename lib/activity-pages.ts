import {AppError} from './rally-errors';
import {profilePhotoUrl} from './profile-photo';
export type PageOptions={view:'members'|'matches'|'tournaments';club?:string;search?:string;role?:string;status?:string;page?:number;match?:string;isSiteAdmin?:boolean};
export async function readActivityPage(db:D1Database,authId:string|null,options:PageOptions){
 const self=authId?await db.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(authId).first<{id:string}>():null;
 if(options.view==='matches'&&!self)throw new AppError(401,'Sign in to view clubhouse activity.');
 const page=Math.max(1,Math.min(10000,Math.floor(options.page??1)||1)),limit=20,offset=(page-1)*limit,search='%'+(options.search??'').trim().slice(0,80).replace(/[\\%_]/g,'\\$&')+'%',club=options.club??'all';
 const visible="(c.approval_status='approved' OR ?=1 OR EXISTS (SELECT 1 FROM memberships access WHERE access.club_id=c.id AND access.player_id=?))",visibility=[options.isSiteAdmin?1:0,self?.id??''];
 const list=async(sql:string,args:unknown[])=>(await db.prepare(sql).bind(...args).all()).results;
 if(options.view==='members'){
  if(!club||club==='all')throw new AppError(400,'Choose a club.');const role=options.role??'all';if(!['all','owner','admin','board','member','guest'].includes(role))throw new AppError(400,'Choose a member role.');
  const from=`FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE c.id=? AND ${visible} AND m.status='active' AND p.deleted_at IS NULL AND p.name LIKE ? ESCAPE '\\' AND (?='all' OR CASE WHEN p.auth_id IS NULL THEN 'guest' ELSE m.role END=?)`,args=[club,...visibility,search,role,role];
  const total=await db.prepare(`SELECT count(*) total ${from}`).bind(...args).first<{total:number}>();
  const rows=await list(`SELECT p.id,p.name,p.auth_id IS NULL AS is_guest,ph.updated_at AS photo_version,m.role ${from} ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,p.name COLLATE NOCASE,p.id LIMIT ? OFFSET ?`,[...args,limit,offset]);
  return {page,total:total?.total??0,hasMore:offset+rows.length<(total?.total??0),items:rows.map(({photo_version,...p})=>({...p,photo_url:profilePhotoUrl(p.id as string,photo_version as string|null)}))};
 }
 if(options.view==='matches'){
  const status=options.status??'all';if(!['all','pending','confirmed','voided'].includes(status))throw new AppError(400,'Choose a result status.');
  const from=`FROM matches m JOIN clubs c ON c.id=m.club_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE t.deleted_at IS NULL AND ${visible} AND (?='all' OR m.club_id=?) AND (?='all' OR m.status=?) AND (?='' OR m.id=?)`,args=[...visibility,club,club,status,status,options.match??'',options.match??''];
  const total=await db.prepare(`SELECT count(*) total ${from}`).bind(...args).first<{total:number}>(),rows=await list(`SELECT m.*,EXISTS (SELECT 1 FROM memberships leader WHERE leader.club_id=m.club_id AND leader.player_id=? AND leader.status='active' AND leader.role IN ('owner','admin','board')) AS is_admin ${from} ORDER BY m.played_on DESC,m.created_at DESC,m.id LIMIT ? OFFSET ?`,[self!.id,...args,limit,offset]);
  return {page,total:total?.total??0,hasMore:offset+rows.length<(total?.total??0),items:rows.map(({is_admin,...m})=>({...m,games:JSON.parse(m.games as string),canConfirm:m.status==='pending'&&(!!is_admin||((m.a===self!.id||m.b===self!.id)&&m.submitted_by!==self!.id)),canVoid:!m.tournament_id&&m.status!=='voided'&&(!!is_admin||(m.status==='pending'&&m.submitted_by===self!.id))}))};
 }
 const status=options.status??'all';if(!['all','registration','active','completed','upcoming'].includes(status))throw new AppError(400,'Choose an event status.');
 const from=`FROM tournaments t JOIN clubs c ON c.id=t.club_id WHERE t.deleted_at IS NULL AND ${visible} AND (?='all' OR t.club_id=?) AND (?='all' OR t.status=? OR (?='upcoming' AND t.status!='completed')) AND (t.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR c.location LIKE ? ESCAPE '\\')`,args=[...visibility,club,club,status,status,status,search,search,search],total=await db.prepare(`SELECT count(*) total ${from}`).bind(...args).first<{total:number}>();
 const dateOrder=status==='upcoming'||status==='registration'?'t.date ASC':'t.date DESC';
 const items=await list(`SELECT t.id,t.name,t.club_id,t.date,t.format,t.capacity,t.status,t.registration_closes_at,t.starts_at,t.revision,(SELECT count(*) FROM entries e WHERE e.tournament_id=t.id) AS entry_count ${from} ORDER BY CASE t.status WHEN 'active' THEN 0 WHEN 'registration' THEN 1 ELSE 2 END,${dateOrder},t.id LIMIT ? OFFSET ?`,[...args,limit,offset]);
 return {page,total:total?.total??0,hasMore:offset+items.length<(total?.total??0),items};
}
