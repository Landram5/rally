import {AppError} from './rally-errors';
// Direct messages. People can message each other when they share a club (or one is a leader of a club the other has asked to join).
// Blocking is one way and always wins. Reports go to site administrators with a snapshot of the conversation.
export const DM_LIMITS={body:2000,perMinute:20,page:40,lookup:10};
const id=(v:unknown,label='id')=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new AppError(400,`Invalid ${label}.`);return v;};
export type DmPerson={id:string;name:string;photoVersion:string|null;deleted:boolean};
export type DmMedia={id:string;kind:'image'|'video';contentType:string;bytes:number};
export type DmMessage={id:string;threadId:string;authorId:string;body:string;createdAt:string;mine:boolean;media:DmMedia|null};
export type DmThread={id:string;other:DmPerson;lastMessage:string;lastAt:string;unread:number;canSend:boolean};
const LEADER="('owner','admin','board')";
// Why two people may talk right now. Existing threads stay readable when this turns false, but no new messages can be sent.
export async function canMessage(db:D1Database,me:string,other:string):Promise<boolean>{
 if(me===other)return false;
 const ok=await db.prepare(`SELECT 1 x FROM profiles a, profiles b WHERE a.id=?1 AND b.id=?2 AND a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.auth_id IS NOT NULL AND b.auth_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=?1 AND blocked_id=?2) OR (blocker_id=?2 AND blocked_id=?1))
  AND (EXISTS(SELECT 1 FROM memberships x JOIN memberships y ON y.club_id=x.club_id WHERE x.player_id=?1 AND y.player_id=?2 AND x.status='active' AND y.status='active' AND x.role!='guest' AND y.role!='guest')
   OR EXISTS(SELECT 1 FROM memberships x JOIN memberships y ON y.club_id=x.club_id WHERE x.player_id=?1 AND y.player_id=?2 AND x.status='pending' AND y.status='active' AND y.role IN ${LEADER})
   OR EXISTS(SELECT 1 FROM memberships x JOIN memberships y ON y.club_id=x.club_id WHERE x.player_id=?2 AND y.player_id=?1 AND x.status='pending' AND y.status='active' AND y.role IN ${LEADER}))`).bind(me,other).first();
 return !!ok;
}
const person=(r:{id:string;name:string;photo_version:string|null;deleted_at:string|null;author_name?:string|null}):DmPerson=>({id:r.id,name:r.deleted_at?'Deleted User':r.name,photoVersion:r.deleted_at?null:r.photo_version,deleted:!!r.deleted_at});
export async function lookupPeople(db:D1Database,me:string,query:unknown){
 const q=typeof query==='string'?query.trim().slice(0,60):'';if(q.length<2)return {people:[] as (DmPerson&{clubs:string[]})[]};
 const like=`%${q.replace(/[\\%_]/g,m=>'\\'+m)}%`;
 const rows=(await db.prepare(`SELECT p.id,p.name,p.deleted_at,ph.updated_at photo_version,(SELECT group_concat(c.name,'|') FROM memberships x JOIN memberships y ON y.club_id=x.club_id JOIN clubs c ON c.id=x.club_id WHERE x.player_id=?1 AND y.player_id=p.id AND x.status='active' AND y.status='active') clubs
  FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id<>?1 AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL AND p.name LIKE ?2 ESCAPE '\\' ORDER BY p.name LIMIT 40`).bind(me,like).all<{id:string;name:string;deleted_at:null;photo_version:string|null;clubs:string|null}>()).results;
 const out:(DmPerson&{clubs:string[]})[]=[];
 for(const r of rows){if(out.length>=DM_LIMITS.lookup)break;if(await canMessage(db,me,r.id))out.push({...person(r),clubs:r.clubs?r.clubs.split('|').slice(0,3):[]});}
 return {people:out};
}
const pair=(x:string,y:string):[string,string]=>x<y?[x,y]:[y,x];
export async function startThread(db:D1Database,me:string,otherRaw:unknown,now=new Date().toISOString()){
 const other=id(otherRaw,'person'),[a,b]=pair(me,other);
 const existing=await db.prepare('SELECT id FROM dm_threads WHERE a_id=? AND b_id=?').bind(a,b).first<{id:string}>();
 if(existing)return {threadId:existing.id};
 if(!await canMessage(db,me,other))throw new AppError(403,'You can only message people who share a club with you.');
 const threadId=crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO dm_threads(id,a_id,b_id,created_at) VALUES(?,?,?,?)').bind(threadId,a,b,now).run();
 const row=await db.prepare('SELECT id FROM dm_threads WHERE a_id=? AND b_id=?').bind(a,b).first<{id:string}>();
 return {threadId:row!.id};
}
type ThreadRow={id:string;a_id:string;b_id:string};
async function threadFor(db:D1Database,me:string,threadId:unknown){
 const t=await db.prepare('SELECT id,a_id,b_id FROM dm_threads WHERE id=?').bind(id(threadId,'conversation')).first<ThreadRow>();
 if(!t||(t.a_id!==me&&t.b_id!==me))throw new AppError(404,'Conversation not found.');
 return {id:t.id,other:t.a_id===me?t.b_id:t.a_id};
}
export async function listThreads(db:D1Database,me:string){
 const rows=(await db.prepare(`SELECT t.id,t.last_message_at,o.id oid,o.name oname,o.deleted_at odeleted,ph.updated_at photo_version,
   (SELECT coalesce(nullif(m.body,''),CASE (SELECT kind FROM dm_media WHERE id=m.media_id) WHEN 'video' THEN 'Video' ELSE 'Photo' END) FROM dm_messages m WHERE m.thread_id=t.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_body,
   (SELECT count(*) FROM dm_messages m WHERE m.thread_id=t.id AND m.deleted_at IS NULL AND m.author_id<>?1 AND m.created_at>coalesce((SELECT last_read_at FROM dm_state s WHERE s.thread_id=t.id AND s.player_id=?1),'')) unread
  FROM dm_threads t JOIN profiles o ON o.id=CASE WHEN t.a_id=?1 THEN t.b_id ELSE t.a_id END LEFT JOIN profile_photos ph ON ph.player_id=o.id
  WHERE (t.a_id=?1 OR t.b_id=?1) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id=?1 AND b.blocked_id=o.id)
   AND EXISTS(SELECT 1 FROM dm_messages m WHERE m.thread_id=t.id AND m.deleted_at IS NULL)
  ORDER BY t.last_message_at DESC LIMIT 100`).bind(me).all<{id:string;last_message_at:string;oid:string;oname:string;odeleted:string|null;photo_version:string|null;last_body:string|null;unread:number}>()).results;
 const threads:DmThread[]=[];
 for(const r of rows)threads.push({id:r.id,other:person({id:r.oid,name:r.oname,photo_version:r.photo_version,deleted_at:r.odeleted}),lastMessage:(r.last_body??'').slice(0,120),lastAt:r.last_message_at,unread:Math.min(r.unread,99),canSend:await canMessage(db,me,r.oid)});
 return {threads};
}
type DmRow={id:string;thread_id:string;author_id:string;body:string;created_at:string;media_id:string|null;kind:'image'|'video'|null;content_type:string|null;bytes:number|null};
const DM_SELECT='SELECT m.id,m.thread_id,m.author_id,m.body,m.created_at,m.media_id,cm.kind,cm.content_type,cm.bytes FROM dm_messages m LEFT JOIN dm_media cm ON cm.id=m.media_id';
const dmView=(r:DmRow,me:string):DmMessage=>({id:r.id,threadId:r.thread_id,authorId:r.author_id,body:r.body,createdAt:r.created_at,mine:r.author_id===me,media:r.media_id&&r.kind?{id:r.media_id,kind:r.kind,contentType:r.content_type!,bytes:r.bytes!}:null});
export async function readThread(db:D1Database,me:string,threadId:unknown,opts:{before?:unknown}={}){
 const t=await threadFor(db,me,threadId);
 if((await db.prepare('SELECT 1 x FROM blocks WHERE blocker_id=? AND blocked_id=?').bind(me,t.other).first()))throw new AppError(403,'You blocked this person. Unblock them to see the conversation.');
 let cursor:{created_at:string;id:string}|null=null;
 if(opts.before!==undefined&&opts.before!==null&&opts.before!==''){cursor=await db.prepare('SELECT created_at,id FROM dm_messages WHERE id=? AND thread_id=?').bind(id(opts.before,'cursor'),t.id).first<{created_at:string;id:string}>();if(!cursor)throw new AppError(404,'Message not found.');}
 const limit=DM_LIMITS.page,sql=`${DM_SELECT} WHERE m.thread_id=? AND m.deleted_at IS NULL${cursor?' AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''} ORDER BY m.created_at DESC,m.id DESC LIMIT ?`;
 const rows=(await db.prepare(sql).bind(...(cursor?[t.id,cursor.created_at,cursor.created_at,cursor.id,limit+1]:[t.id,limit+1])).all<DmRow>()).results;
 const o=await db.prepare('SELECT p.id,p.name,p.deleted_at,ph.updated_at photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id=?').bind(t.other).first<{id:string;name:string;deleted_at:string|null;photo_version:string|null}>();
 return {me,other:person(o!),canSend:await canMessage(db,me,t.other),hasMore:rows.length>limit,messages:rows.slice(0,limit).reverse().map(r=>dmView(r,me))};
}
export async function sendDm(db:D1Database,me:string,threadId:unknown,body:{text?:unknown;clientId?:unknown;mediaId?:unknown},now=new Date().toISOString()){
 const t=await threadFor(db,me,threadId),clientId=id(body.clientId,'message id');
 if(body.text!==undefined&&typeof body.text!=='string')throw new AppError(400,'Write a message.');
 const text=typeof body.text==='string'?body.text.trim():'';
 if(text.length>DM_LIMITS.body)throw new AppError(400,`Messages can be up to ${DM_LIMITS.body} characters.`);
 const mediaId=body.mediaId===undefined||body.mediaId===null||body.mediaId===''?null:id(body.mediaId,'attachment');
 if(!text&&!mediaId)throw new AppError(400,'Write a message or attach a photo or video.');
 const existing=await db.prepare(`${DM_SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(me,clientId).first<DmRow>();
 if(existing)return {message:dmView(existing,me),other:t.other,created:false};
 if(!await canMessage(db,me,t.other))throw new AppError(403,'You can no longer message this person.');
 if(((await db.prepare('SELECT count(*) n FROM dm_messages WHERE author_id=? AND created_at>?').bind(me,new Date(Date.parse(now)-60000).toISOString()).first<{n:number}>())?.n??0)>=DM_LIMITS.perMinute)throw new AppError(429,'You are sending messages too quickly. Please wait a moment.');
 if(mediaId&&!await db.prepare('SELECT 1 x FROM dm_media WHERE id=? AND thread_id=? AND uploader_id=? AND attached_at IS NULL').bind(mediaId,t.id,me).first())throw new AppError(400,'That attachment is no longer available. Upload it again.');
 const messageId=crypto.randomUUID();
 try{await db.batch([
  db.prepare('INSERT INTO dm_messages(id,thread_id,author_id,author_name,body,media_id,client_id,created_at) SELECT ?,?,?,name,?,?,?,? FROM profiles WHERE id=? AND deleted_at IS NULL').bind(messageId,t.id,me,text,mediaId,clientId,now,me),
  db.prepare('UPDATE dm_threads SET last_message_at=? WHERE id=?').bind(now,t.id),
  ...(mediaId?[db.prepare('UPDATE dm_media SET attached_at=? WHERE id=? AND attached_at IS NULL').bind(now,mediaId)]:[]),
 ]);}catch(e){if(e instanceof Error&&/UNIQUE/i.test(e.message)){const again=await db.prepare(`${DM_SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(me,clientId).first<DmRow>();if(again)return {message:dmView(again,me),other:t.other,created:false};throw new AppError(409,'That attachment was already used.');}throw e;}
 const row=await db.prepare(`${DM_SELECT} WHERE m.id=?`).bind(messageId).first<DmRow>();if(!row)throw new AppError(409,'The message could not be saved.');
 return {message:dmView(row,me),other:t.other,created:true};
}
// Who may upload to or view media in a conversation: its two people, and only while they are allowed to message (upload) or have not blocked the other (view).
export async function dmMediaAccess(db:D1Database,viewer:string,threadId:string,upload:boolean){
 const t=await threadFor(db,viewer,threadId);
 if(upload){if(!await canMessage(db,viewer,t.other))throw new AppError(403,'You can no longer message this person.');}
 else if(await db.prepare('SELECT 1 x FROM blocks WHERE blocker_id=? AND blocked_id=?').bind(viewer,t.other).first())throw new AppError(404,'Not found.');
}
export async function deleteDm(db:D1Database,me:string,messageId:unknown,now=new Date().toISOString()){
 const m=await db.prepare('SELECT m.id,m.thread_id,m.author_id,t.a_id,t.b_id,cm.r2_key FROM dm_messages m JOIN dm_threads t ON t.id=m.thread_id LEFT JOIN dm_media cm ON cm.id=m.media_id WHERE m.id=? AND m.deleted_at IS NULL').bind(id(messageId,'message')).first<{id:string;thread_id:string;author_id:string;a_id:string;b_id:string;r2_key:string|null}>();
 if(!m||m.author_id!==me)throw new AppError(404,'Message not found.');
 await db.prepare('UPDATE dm_messages SET deleted_at=? WHERE id=?').bind(now,m.id).run();
 return {id:m.id,threadId:m.thread_id,participants:[m.a_id,m.b_id],r2Key:m.r2_key};
}
export async function markThreadRead(db:D1Database,me:string,threadId:unknown,now=new Date().toISOString()){
 const t=await threadFor(db,me,threadId);
 await db.prepare('INSERT INTO dm_state(thread_id,player_id,last_read_at) VALUES(?,?,?) ON CONFLICT(thread_id,player_id) DO UPDATE SET last_read_at=excluded.last_read_at').bind(t.id,me,now).run();return {ok:true};
}
export async function unreadDmCount(db:D1Database,me:string){
 return (await db.prepare(`SELECT count(*) n FROM dm_messages m JOIN dm_threads t ON t.id=m.thread_id WHERE (t.a_id=?1 OR t.b_id=?1) AND m.deleted_at IS NULL AND m.author_id<>?1
  AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id=?1 AND b.blocked_id=m.author_id) AND m.created_at>coalesce((SELECT last_read_at FROM dm_state s WHERE s.thread_id=t.id AND s.player_id=?1),'')`).bind(me).first<{n:number}>())?.n??0;
}
export async function setBlock(db:D1Database,me:string,otherRaw:unknown,blocked:unknown,now=new Date().toISOString()){
 const other=id(otherRaw,'person');if(typeof blocked!=='boolean')throw new AppError(400,'Choose block or unblock.');if(other===me)throw new AppError(400,'You cannot block yourself.');
 if(!await db.prepare('SELECT 1 x FROM profiles WHERE id=? AND deleted_at IS NULL').bind(other).first())throw new AppError(404,'Person not found.');
 await (blocked?db.prepare('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id,created_at) VALUES(?,?,?)').bind(me,other,now):db.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').bind(me,other)).run();
 return {ok:true};
}
export async function listBlocks(db:D1Database,me:string){
 const rows=(await db.prepare('SELECT p.id,p.name,p.deleted_at,ph.updated_at photo_version FROM blocks b JOIN profiles p ON p.id=b.blocked_id LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE b.blocker_id=? ORDER BY b.created_at DESC LIMIT 200').bind(me).all<{id:string;name:string;deleted_at:string|null;photo_version:string|null}>()).results;
 return {blocked:rows.map(person)};
}
export const blockedIds=async(db:D1Database,me:string)=>(await db.prepare('SELECT blocked_id id FROM blocks WHERE blocker_id=?').bind(me).all<{id:string}>()).results.map(r=>r.id);
export async function reportDm(db:D1Database,me:string,messageId:unknown,reason:unknown,now=new Date().toISOString()){
 const m=await db.prepare('SELECT m.id,m.thread_id,m.author_id,m.created_at,t.a_id,t.b_id FROM dm_messages m JOIN dm_threads t ON t.id=m.thread_id WHERE m.id=? AND m.deleted_at IS NULL').bind(id(messageId,'message')).first<{id:string;thread_id:string;author_id:string;created_at:string;a_id:string;b_id:string}>();
 if(!m||(m.a_id!==me&&m.b_id!==me))throw new AppError(404,'Message not found.');if(m.author_id===me)throw new AppError(400,'You cannot report your own message.');
 // Share the reported message and the five before it, so administrators can see the context.
 const context=(await db.prepare("SELECT author_id,author_name,CASE WHEN body<>'' THEN body ELSE '[photo or video]' END body,created_at FROM dm_messages WHERE thread_id=? AND deleted_at IS NULL AND (created_at<? OR id=?) ORDER BY created_at DESC LIMIT 6").bind(m.thread_id,m.created_at,m.id).all<{author_id:string;author_name:string;body:string;created_at:string}>()).results.reverse();
 await db.prepare('INSERT INTO safety_reports(id,kind,reporter_id,target_id,message_id,snapshot,reason,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'dm',me,m.author_id,m.id,JSON.stringify(context),(typeof reason==='string'?reason.trim():'').slice(0,500),now).run();
 return {ok:true};
}
export async function reportUser(db:D1Database,me:string,otherRaw:unknown,reason:unknown,now=new Date().toISOString()){
 const other=id(otherRaw,'person');if(other===me)throw new AppError(400,'You cannot report yourself.');
 if(!await db.prepare('SELECT 1 x FROM profiles WHERE id=? AND deleted_at IS NULL').bind(other).first())throw new AppError(404,'Person not found.');
 await db.prepare('INSERT INTO safety_reports(id,kind,reporter_id,target_id,reason,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),'user',me,other,(typeof reason==='string'?reason.trim():'').slice(0,500),now).run();
 return {ok:true};
}
// Site administrators only. The route passes whether the caller is one.
export async function listSafetyReports(db:D1Database,isSiteAdmin:boolean){
 if(!isSiteAdmin)throw new AppError(403,'Only Rally administrators can review safety reports.');
 const rows=(await db.prepare("SELECT r.id,r.kind,r.reason,r.created_at,r.snapshot,r.message_id,rp.name reporter,tp.id target_id,tp.name target,tp.deleted_at target_deleted FROM safety_reports r JOIN profiles rp ON rp.id=r.reporter_id JOIN profiles tp ON tp.id=r.target_id WHERE r.resolved_at IS NULL ORDER BY r.created_at LIMIT 50").all<{id:string;kind:string;reason:string;created_at:string;snapshot:string;message_id:string|null;reporter:string;target_id:string;target:string;target_deleted:string|null}>()).results;
 return {reports:rows.map(r=>({id:r.id,kind:r.kind,reason:r.reason,createdAt:r.created_at,reporter:r.reporter,targetId:r.target_id,target:r.target_deleted?'Deleted User':r.target,context:r.snapshot?JSON.parse(r.snapshot) as {author_id:string;author_name:string;body:string;created_at:string}[]:[]}))};
}
export async function resolveSafetyReport(db:D1Database,isSiteAdmin:boolean,adminProfile:string,reportId:unknown,now=new Date().toISOString()){
 if(!isSiteAdmin)throw new AppError(403,'Only Rally administrators can review safety reports.');
 await db.prepare('UPDATE safety_reports SET resolved_at=?,resolved_by=? WHERE id=? AND resolved_at IS NULL').bind(now,adminProfile,id(reportId,'report')).run();return {ok:true};
}
export async function setDmNotify(db:D1Database,me:string,on:unknown){
 if(typeof on!=='boolean')throw new AppError(400,'Choose on or off.');
 await db.prepare('INSERT INTO dm_settings(player_id,notify) VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET notify=excluded.notify').bind(me,on?1:0).run();return {ok:true};
}
export const dmNotifyEnabled=async(db:D1Database,me:string)=>{const r=await db.prepare('SELECT notify FROM dm_settings WHERE player_id=?').bind(me).first<{notify:number}>();return r?!!r.notify:true;};
