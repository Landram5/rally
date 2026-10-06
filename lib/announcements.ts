import {AppError} from './rally-errors';
export type Announcement={id:string;club_id:string|null;title:string;body:string;created_at:string;clubName:string|null;seen:boolean};
const audience="(a.club_id IS NULL OR EXISTS (SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.club_id=a.club_id AND m.player_id=? AND m.status='active' AND c.approval_status='approved'))";
export async function readAnnouncements(db:D1Database,player:string,club?:string){
 return (await db.prepare(`SELECT a.id,a.club_id,a.title,a.body,a.created_at,c.name AS clubName,s.seen_at IS NOT NULL AS seen FROM announcements a LEFT JOIN clubs c ON c.id=a.club_id LEFT JOIN announcement_seen s ON s.announcement_id=a.id AND s.player_id=? WHERE ${audience} AND (?='' OR a.club_id=?) ORDER BY a.created_at DESC,a.id DESC LIMIT 100`).bind(player,player,club??'',club??'').all<Announcement>()).results.map(a=>({...a,seen:!!a.seen}));
}
export async function nextAnnouncement(db:D1Database,player:string){return await db.prepare(`SELECT a.id,a.club_id,a.title,a.body,a.created_at,c.name AS clubName FROM announcements a LEFT JOIN clubs c ON c.id=a.club_id WHERE ${audience} AND NOT EXISTS (SELECT 1 FROM announcement_seen s WHERE s.player_id=? AND s.announcement_id=a.id) ORDER BY a.created_at,a.id LIMIT 1`).bind(player,player).first<Announcement>();}
export async function claimAnnouncement(db:D1Database,player:string,id:string){
 const result=await db.prepare(`INSERT OR IGNORE INTO announcement_seen(player_id,announcement_id,seen_at) SELECT ?,a.id,? FROM announcements a WHERE a.id=? AND ${audience}`).bind(player,new Date().toISOString(),id,player).run();return {claimed:result.meta.changes===1};
}
export async function publishAnnouncement(db:D1Database,player:string,siteAdmin:boolean,body:Record<string,unknown>){
 const title=typeof body.title==='string'?body.title.trim():'',content=typeof body.body==='string'?body.body.trim():'',id=typeof body.id==='string'?body.id:'',club=typeof body.clubId==='string'?body.clubId:'';
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!title||title.length>120||!content||content.length>2000)throw new AppError(400,'Add a title (up to 120 characters) and announcement (up to 2,000 characters).');
 if(!club&&!siteAdmin)throw new AppError(403,'Only site admins can announce to all Rally users.');
 const existing=await db.prepare('SELECT author_id,club_id,title,body FROM announcements WHERE id=?').bind(id).first<{author_id:string;club_id:string|null;title:string;body:string}>();
 if(existing){if(existing.author_id!==player||existing.club_id!==(club||null)||existing.title!==title||existing.body!==content)throw new AppError(409,'This announcement ID has already been used.');return {ok:true};}
 const result=club?await db.prepare("INSERT INTO announcements(id,club_id,author_id,title,body,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.player_id=? AND m.club_id=? AND m.status='active' AND m.role IN ('owner','admin','board') AND c.approval_status='approved')").bind(id,club,player,title,content,new Date().toISOString(),player,club).run():await db.prepare('INSERT INTO announcements(id,club_id,author_id,title,body,created_at) VALUES(?,NULL,?,?,?,?)').bind(id,player,title,content,new Date().toISOString()).run();
 if(!result.meta.changes)throw new AppError(403,'Only active club organizers can publish club announcements.');return {ok:true};
}
