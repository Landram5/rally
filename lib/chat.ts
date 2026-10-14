import {AppError} from './rally-errors';
// Club chat rules. Only active members of an approved club can read or write; organizers can delete messages and mute members.
export const CHAT_LIMITS={body:2000,imageBytes:8*1024*1024,videoBytes:50*1024*1024,perMinute:20,page:40};
const id=(v:unknown,label='id')=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new AppError(400,`Invalid ${label}.`);return v;};
export type ChatMedia={id:string;kind:'image'|'video';contentType:string;bytes:number};
export type ChatMessage={id:string;clubId:string;authorId:string|null;authorName:string;body:string;createdAt:string;media:ChatMedia|null;mine:boolean;canDelete:boolean};
type Row={source?:string;external_name?:string|null;id:string;club_id:string;author_id:string;author_name:string;current_name:string;author_deleted:string|null;body:string;created_at:string;media_id:string|null;kind:'image'|'video'|null;content_type:string|null;bytes:number|null};
const SELECT="SELECT m.source,m.external_name,m.id,m.club_id,m.author_id,m.author_name,p.name current_name,p.deleted_at author_deleted,m.body,m.created_at,m.media_id,cm.kind,cm.content_type,cm.bytes FROM chat_messages m JOIN profiles p ON p.id=m.author_id LEFT JOIN chat_media cm ON cm.id=m.media_id";
// A deleted account keeps its messages, labelled with the name it had.
const view=(r:Row,viewer:string,admin:boolean):ChatMessage=>r.source==='discord'?{id:r.id,clubId:r.club_id,authorId:null,authorName:`${r.external_name||'Someone'} (Discord)`,body:r.body,createdAt:r.created_at,media:null,mine:false,canDelete:admin}:({id:r.id,clubId:r.club_id,authorId:r.author_deleted?null:r.author_id,authorName:r.author_deleted?`Deleted User (${r.author_name})`:r.current_name,body:r.body,createdAt:r.created_at,media:r.media_id&&r.kind?{id:r.media_id,kind:r.kind,contentType:r.content_type!,bytes:r.bytes!}:null,mine:r.author_id===viewer,canDelete:admin||r.author_id===viewer});
export async function chatAccess(db:D1Database,player:string,clubId:string){
 const row=await db.prepare("SELECT m.role,EXISTS(SELECT 1 FROM chat_mutes x WHERE x.club_id=m.club_id AND x.player_id=m.player_id) muted FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role!='guest' AND c.approval_status='approved' AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL").bind(clubId,player).first<{role:string;muted:number}>();
 if(!row)throw new AppError(403,'Chat is for active club members.');
 return {admin:['owner','admin','board'].includes(row.role),muted:!!row.muted};
}
export async function readMessages(db:D1Database,viewer:string,clubIdRaw:unknown,opts:{before?:unknown;after?:unknown}={}){
 const clubId=id(clubIdRaw,'club'),{admin,muted}=await chatAccess(db,viewer,clubId);
 const cursor=async(v:unknown)=>{if(v===undefined||v===null||v==='')return null;const mid=id(v,'cursor'),r=await db.prepare('SELECT created_at,id FROM chat_messages WHERE id=? AND club_id=?').bind(mid,clubId).first<{created_at:string;id:string}>();if(!r)throw new AppError(404,'Message not found.');return r;};
 const before=await cursor(opts.before),after=await cursor(opts.after),limit=CHAT_LIMITS.page;
 let rows:Row[];
 if(after)rows=(await db.prepare(`${SELECT} WHERE m.club_id=? AND m.deleted_at IS NULL AND (m.created_at>? OR (m.created_at=? AND m.id>?)) AND NOT EXISTS(SELECT 1 FROM blocks bk WHERE bk.blocker_id=? AND bk.blocked_id=m.author_id) ORDER BY m.created_at,m.id LIMIT 200`).bind(clubId,after.created_at,after.created_at,after.id,viewer).all<Row>()).results;
 else{const q=before?`${SELECT} WHERE m.club_id=? AND m.deleted_at IS NULL AND (m.created_at<? OR (m.created_at=? AND m.id<?)) AND NOT EXISTS(SELECT 1 FROM blocks bk WHERE bk.blocker_id=? AND bk.blocked_id=m.author_id) ORDER BY m.created_at DESC,m.id DESC LIMIT ?`:`${SELECT} WHERE m.club_id=? AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM blocks bk WHERE bk.blocker_id=? AND bk.blocked_id=m.author_id) ORDER BY m.created_at DESC,m.id DESC LIMIT ?`;
  rows=(await db.prepare(q).bind(...(before?[clubId,before.created_at,before.created_at,before.id,viewer,limit+1]:[clubId,viewer,limit+1])).all<Row>()).results;}
 const hasMore=!after&&rows.length>limit;if(!after)rows=rows.slice(0,limit).reverse();
 const state=await db.prepare('SELECT notify FROM chat_members WHERE club_id=? AND player_id=?').bind(clubId,viewer).first<{notify:number}>();
 return {messages:rows.map(r=>view(r,viewer,admin)),hasMore,admin,muted,notify:!!state?.notify};
}
export async function postMessage(db:D1Database,viewer:string,clubIdRaw:unknown,body:{text?:unknown;mediaId?:unknown;clientId?:unknown},now=new Date().toISOString()){
 const clubId=id(clubIdRaw,'club'),clientId=id(body.clientId,'message id'),{admin,muted}=await chatAccess(db,viewer,clubId);
 if(muted)throw new AppError(403,'You are muted in this chat.');
 if(body.text!==undefined&&typeof body.text!=='string')throw new AppError(400,'Write a message.');
 const text=typeof body.text==='string'?body.text.trim():'';
 if(text.length>CHAT_LIMITS.body)throw new AppError(400,`Messages can be up to ${CHAT_LIMITS.body} characters.`);
 const mediaId=body.mediaId===undefined||body.mediaId===null||body.mediaId===''?null:id(body.mediaId,'attachment');
 if(!text&&!mediaId)throw new AppError(400,'Write a message or attach a photo or video.');
 const existing=await db.prepare(`${SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(viewer,clientId).first<Row>();if(existing)return {message:view(existing,viewer,admin),created:false};
 const since=new Date(Date.parse(now)-60000).toISOString();
 if(((await db.prepare('SELECT count(*) n FROM chat_messages WHERE author_id=? AND created_at>?').bind(viewer,since).first<{n:number}>())?.n??0)>=CHAT_LIMITS.perMinute)throw new AppError(429,'You are sending messages too quickly. Please wait a moment.');
 if(mediaId&&!await db.prepare('SELECT 1 FROM chat_media WHERE id=? AND club_id=? AND uploader_id=? AND attached_at IS NULL').bind(mediaId,clubId,viewer).first())throw new AppError(400,'That attachment is no longer available. Upload it again.');
 const messageId=crypto.randomUUID();
 try{await db.batch([
  db.prepare('INSERT INTO chat_messages(id,club_id,author_id,author_name,body,media_id,client_id,created_at) SELECT ?,?,?,name,?,?,?,? FROM profiles WHERE id=? AND deleted_at IS NULL').bind(messageId,clubId,viewer,text,mediaId,clientId,now,viewer),
  ...(mediaId?[db.prepare('UPDATE chat_media SET attached_at=? WHERE id=? AND attached_at IS NULL').bind(now,mediaId)]:[]),
 ]);}catch(e){if(e instanceof Error&&/UNIQUE/i.test(e.message)){const again=await db.prepare(`${SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(viewer,clientId).first<Row>();if(again)return {message:view(again,viewer,admin),created:false};throw new AppError(409,'That attachment was already used.');}throw e;}
 const row=await db.prepare(`${SELECT} WHERE m.id=?`).bind(messageId).first<Row>();if(!row)throw new AppError(409,'The message could not be saved.');
 return {message:view(row,viewer,admin),created:true};
}
export async function deleteMessage(db:D1Database,viewer:string,messageId:unknown,now=new Date().toISOString()){
 const mid=id(messageId,'message'),m=await db.prepare('SELECT m.club_id,m.author_id,cm.r2_key FROM chat_messages m LEFT JOIN chat_media cm ON cm.id=m.media_id WHERE m.id=? AND m.deleted_at IS NULL').bind(mid).first<{club_id:string;author_id:string;r2_key:string|null}>();
 if(!m)throw new AppError(404,'Message not found.');
 const {admin}=await chatAccess(db,viewer,m.club_id);if(!admin&&m.author_id!==viewer)throw new AppError(403,'Only the author or a club organizer can delete this message.');
 await db.prepare('UPDATE chat_messages SET deleted_at=?,deleted_by=? WHERE id=? AND deleted_at IS NULL').bind(now,viewer,mid).run();
 return {clubId:m.club_id,id:mid,r2Key:m.r2_key};
}
export async function reportMessage(db:D1Database,viewer:string,messageId:unknown,reason:unknown,now=new Date().toISOString()){
 const mid=id(messageId,'message'),m=await db.prepare('SELECT club_id,author_id FROM chat_messages WHERE id=? AND deleted_at IS NULL').bind(mid).first<{club_id:string;author_id:string}>();
 if(!m)throw new AppError(404,'Message not found.');await chatAccess(db,viewer,m.club_id);
 if(m.author_id===viewer)throw new AppError(400,'You cannot report your own message.');
 const why=typeof reason==='string'?reason.trim().slice(0,500):'';
 await db.prepare('INSERT OR IGNORE INTO chat_reports(id,message_id,club_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),mid,m.club_id,viewer,why,now).run();
 return {ok:true};
}
export async function listReports(db:D1Database,viewer:string,clubIdRaw:unknown){
 const clubId=id(clubIdRaw,'club');if(!(await chatAccess(db,viewer,clubId)).admin)throw new AppError(403,'Only club organizers can review reports.');
 const rows=(await db.prepare("SELECT r.id,r.message_id,r.reason,r.created_at,m.body,m.author_id,m.author_name,p.name current_name,p.deleted_at author_deleted,rp.name reporter FROM chat_reports r JOIN chat_messages m ON m.id=r.message_id JOIN profiles p ON p.id=m.author_id JOIN profiles rp ON rp.id=r.reporter_id WHERE r.club_id=? AND r.resolved_at IS NULL AND m.deleted_at IS NULL ORDER BY r.created_at LIMIT 50").bind(clubId).all<{id:string;message_id:string;reason:string;created_at:string;body:string;author_id:string;author_name:string;current_name:string;author_deleted:string|null;reporter:string}>()).results;
 return {reports:rows.map(r=>({id:r.id,messageId:r.message_id,reason:r.reason,createdAt:r.created_at,body:r.body,authorId:r.author_deleted?null:r.author_id,authorName:r.author_deleted?`Deleted User (${r.author_name})`:r.current_name,reporter:r.reporter}))};
}
export async function resolveReport(db:D1Database,viewer:string,reportId:unknown,now=new Date().toISOString()){
 const rid=id(reportId,'report'),r=await db.prepare('SELECT club_id FROM chat_reports WHERE id=?').bind(rid).first<{club_id:string}>();if(!r)throw new AppError(404,'Report not found.');
 if(!(await chatAccess(db,viewer,r.club_id)).admin)throw new AppError(403,'Only club organizers can review reports.');
 await db.prepare('UPDATE chat_reports SET resolved_at=?,resolved_by=? WHERE id=? AND resolved_at IS NULL').bind(now,viewer,rid).run();return {ok:true};
}
export async function setMute(db:D1Database,viewer:string,clubIdRaw:unknown,playerRaw:unknown,muted:unknown,now=new Date().toISOString()){
 const clubId=id(clubIdRaw,'club'),player=id(playerRaw,'player');if(typeof muted!=='boolean')throw new AppError(400,'Choose mute or unmute.');
 if(!(await chatAccess(db,viewer,clubId)).admin)throw new AppError(403,'Only club organizers can mute members.');
 const target=await db.prepare("SELECT role FROM memberships WHERE club_id=? AND player_id=? AND status='active'").bind(clubId,player).first<{role:string}>();
 if(!target)throw new AppError(404,'That person is not an active member.');if(['owner','admin','board'].includes(target.role)||player===viewer)throw new AppError(400,'Organizers cannot be muted.');
 await (muted?db.prepare('INSERT OR IGNORE INTO chat_mutes(club_id,player_id,muted_by,created_at) VALUES(?,?,?,?)').bind(clubId,player,viewer,now):db.prepare('DELETE FROM chat_mutes WHERE club_id=? AND player_id=?').bind(clubId,player)).run();
 return {ok:true};
}
export async function markRead(db:D1Database,viewer:string,clubIdRaw:unknown,now=new Date().toISOString()){
 const clubId=id(clubIdRaw,'club');await chatAccess(db,viewer,clubId);
 await db.prepare('INSERT INTO chat_members(club_id,player_id,last_read_at) VALUES(?,?,?) ON CONFLICT(club_id,player_id) DO UPDATE SET last_read_at=excluded.last_read_at').bind(clubId,viewer,now).run();return {ok:true};
}
export async function setNotify(db:D1Database,viewer:string,clubIdRaw:unknown,on:unknown){
 const clubId=id(clubIdRaw,'club');if(typeof on!=='boolean')throw new AppError(400,'Choose on or off.');await chatAccess(db,viewer,clubId);
 await db.prepare('INSERT INTO chat_members(club_id,player_id,notify) VALUES(?,?,?) ON CONFLICT(club_id,player_id) DO UPDATE SET notify=excluded.notify').bind(clubId,viewer,on?1:0).run();return {ok:true};
}
// Unread messages per club for the signed-in member (messages from others since they last opened the chat).
export async function unreadCounts(db:D1Database,viewer:string){
 const rows=(await db.prepare("SELECT m.club_id,count(*) n FROM memberships mb JOIN clubs c ON c.id=mb.club_id AND c.approval_status='approved' JOIN chat_messages m ON m.club_id=mb.club_id AND m.deleted_at IS NULL AND m.author_id<>mb.player_id AND NOT EXISTS(SELECT 1 FROM blocks bk WHERE bk.blocker_id=mb.player_id AND bk.blocked_id=m.author_id) LEFT JOIN chat_members cr ON cr.club_id=mb.club_id AND cr.player_id=mb.player_id WHERE mb.player_id=? AND mb.status='active' AND mb.role!='guest' AND m.created_at>coalesce(cr.last_read_at,'') GROUP BY m.club_id").bind(viewer).all<{club_id:string;n:number}>()).results;
 return Object.fromEntries(rows.map(r=>[r.club_id,Math.min(r.n,99)]));
}
