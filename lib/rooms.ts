import {AppError} from './rally-errors';
// Leader rooms: chat rooms for club organizers and board members, created by a leader and open to leaders they invite from any club.
// Everyone in a room must be a leader of an approved club at all times; losing that role ends access until they lead a club again.
export const ROOM_LIMITS={body:2000,perMinute:20,page:40,members:60,rooms:20};
const id=(v:unknown,label='id')=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v))throw new AppError(400,`Invalid ${label}.`);return v;};
const LEADER="('owner','admin','board')";
export type RoomMedia={id:string;kind:'image'|'video';contentType:string;bytes:number};
export type RoomMessage={id:string;roomId:string;authorId:string|null;authorName:string;body:string;createdAt:string;media:RoomMedia|null;mine:boolean;canDelete:boolean};
export type RoomMember={id:string;name:string;role:'owner'|'member';status:'invited'|'active';photoVersion:string|null;clubs:string[]};
export const isLeader=async(db:D1Database,player:string)=>!!await db.prepare(`SELECT 1 x FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.player_id=? AND m.status='active' AND m.role IN ${LEADER} AND c.approval_status='approved' AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL LIMIT 1`).bind(player).first();
// Active members of a room who still lead a club. Throws 403/404 otherwise.
export async function roomAccess(db:D1Database,player:string,roomIdRaw:unknown){
 const roomId=id(roomIdRaw,'room');
 const m=await db.prepare('SELECT r.id,r.name,r.archived_at,rm.role FROM leader_rooms r JOIN room_members rm ON rm.room_id=r.id WHERE r.id=? AND rm.player_id=? AND rm.status=\'active\'').bind(roomId,player).first<{id:string;name:string;archived_at:string|null;role:'owner'|'member'}>();
 if(!m)throw new AppError(404,'Room not found.');
 if(!await isLeader(db,player))throw new AppError(403,'Leader rooms are for club organizers and board members.');
 return {roomId,name:m.name,archived:!!m.archived_at,owner:m.role==='owner'};
}
const notBlocked=(a:string,b:string)=>`NOT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id=${a} AND blocked_id=${b}) OR (blocker_id=${b} AND blocked_id=${a}))`;
export async function createRoom(db:D1Database,me:string,body:{name?:unknown;description?:unknown},now=new Date().toISOString()){
 if(!await isLeader(db,me))throw new AppError(403,'Only club organizers and board members can create leader rooms.');
 const name=typeof body.name==='string'?body.name.trim():'',description=typeof body.description==='string'?body.description.trim():'';
 if(!name||name.length>80)throw new AppError(400,'Give the room a name of up to 80 characters.');if(description.length>300)throw new AppError(400,'Descriptions can be up to 300 characters.');
 if(((await db.prepare("SELECT count(*) n FROM leader_rooms WHERE created_by=? AND archived_at IS NULL").bind(me).first<{n:number}>())?.n??0)>=ROOM_LIMITS.rooms)throw new AppError(409,'Archive an old room before creating another.');
 const roomId=crypto.randomUUID();
 await db.batch([db.prepare('INSERT INTO leader_rooms(id,name,description,created_by,created_at) VALUES(?,?,?,?,?)').bind(roomId,name,description,me,now),db.prepare("INSERT INTO room_members(room_id,player_id,role,status,created_at) VALUES(?,?,'owner','active',?)").bind(roomId,me,now)]);
 return {roomId};
}
// Leaders anyone could invite: matched by name, never people who have a block with the inviter, and not already in the room.
export async function lookupLeaders(db:D1Database,me:string,roomIdRaw:unknown,query:unknown){
 const q=typeof query==='string'?query.trim().slice(0,60):'';if(q.length<2)return {people:[] as {id:string;name:string;photoVersion:string|null;clubs:string[]}[]};
 const room=await roomAccess(db,me,roomIdRaw),like=`%${q.replace(/[\\%_]/g,m=>'\\'+m)}%`;
 const rows=(await db.prepare(`SELECT p.id,p.name,ph.updated_at photo_version,(SELECT group_concat(c.name,'|') FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.player_id=p.id AND m.status='active' AND m.role IN ${LEADER} AND c.approval_status='approved') clubs
  FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.id<>? AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL AND p.name LIKE ? ESCAPE '\\' AND ${notBlocked('p.id','?')}
   AND NOT EXISTS(SELECT 1 FROM room_members rm WHERE rm.room_id=? AND rm.player_id=p.id)
   AND EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.player_id=p.id AND m.status='active' AND m.role IN ${LEADER} AND c.approval_status='approved') ORDER BY p.name LIMIT 10`).bind(me,like,me,me,room.roomId).all<{id:string;name:string;photo_version:string|null;clubs:string|null}>()).results;
 return {people:rows.map(r=>({id:r.id,name:r.name,photoVersion:r.photo_version,clubs:r.clubs?r.clubs.split('|').slice(0,3):[]}))};
}
export async function invite(db:D1Database,me:string,roomIdRaw:unknown,personRaw:unknown,now=new Date().toISOString()){
 const room=await roomAccess(db,me,roomIdRaw),person=id(personRaw,'person');
 if(!room.owner)throw new AppError(403,'Only the room owner can invite people.');if(room.archived)throw new AppError(409,'This room is archived.');
 if(!await isLeader(db,person))throw new AppError(400,'Only club organizers and board members can join leader rooms.');
 if(!await db.prepare(`SELECT 1 x FROM profiles WHERE id=? AND ${notBlocked('?','?')}`).bind(person,me,person,person,me).first())throw new AppError(403,'You cannot invite this person.');
 const count=(await db.prepare('SELECT count(*) n FROM room_members WHERE room_id=?').bind(room.roomId).first<{n:number}>())?.n??0;if(count>=ROOM_LIMITS.members)throw new AppError(409,'This room is full.');
 await db.prepare("INSERT OR IGNORE INTO room_members(room_id,player_id,role,status,invited_by,created_at) VALUES(?,?,'member','invited',?,?)").bind(room.roomId,person,me,now).run();
 return {ok:true};
}
export async function respondToInvite(db:D1Database,me:string,roomIdRaw:unknown,accept:unknown,now=new Date().toISOString()){
 const roomId=id(roomIdRaw,'room');if(typeof accept!=='boolean')throw new AppError(400,'Choose accept or decline.');
 const row=await db.prepare("SELECT 1 x FROM room_members WHERE room_id=? AND player_id=? AND status='invited'").bind(roomId,me).first();if(!row)throw new AppError(404,'Invitation not found.');
 if(accept&&!await isLeader(db,me))throw new AppError(403,'Leader rooms are for club organizers and board members.');
 await (accept?db.prepare("UPDATE room_members SET status='active',created_at=? WHERE room_id=? AND player_id=? AND status='invited'").bind(now,roomId,me):db.prepare("DELETE FROM room_members WHERE room_id=? AND player_id=? AND status='invited'").bind(roomId,me)).run();
 return {ok:true};
}
export async function removeMember(db:D1Database,me:string,roomIdRaw:unknown,personRaw:unknown){
 const room=await roomAccess(db,me,roomIdRaw),person=id(personRaw,'person');
 if(!room.owner)throw new AppError(403,'Only the room owner can remove people.');if(person===me)throw new AppError(400,'Use Leave room instead.');
 await db.prepare('DELETE FROM room_members WHERE room_id=? AND player_id=?').bind(room.roomId,person).run();return {ok:true};
}
// Leaving as the owner hands the room to the longest-standing member, or archives it when nobody else is left.
export async function leaveRoom(db:D1Database,me:string,roomIdRaw:unknown,now=new Date().toISOString()){
 const roomId=id(roomIdRaw,'room'),mine=await db.prepare("SELECT role FROM room_members WHERE room_id=? AND player_id=? AND status='active'").bind(roomId,me).first<{role:string}>();
 if(!mine)throw new AppError(404,'Room not found.');
 const successor=mine.role==='owner'?await db.prepare("SELECT player_id FROM room_members WHERE room_id=? AND player_id<>? AND status='active' ORDER BY created_at LIMIT 1").bind(roomId,me).first<{player_id:string}>():null;
 await db.batch([db.prepare('DELETE FROM room_members WHERE room_id=? AND player_id=?').bind(roomId,me),
  ...(mine.role==='owner'?[successor?db.prepare("UPDATE room_members SET role='owner' WHERE room_id=? AND player_id=?").bind(roomId,successor.player_id):db.prepare('UPDATE leader_rooms SET archived_at=? WHERE id=?').bind(now,roomId)]:[])]);
 return {ok:true};
}
export async function updateRoom(db:D1Database,me:string,roomIdRaw:unknown,body:{name?:unknown;description?:unknown;archived?:unknown},now=new Date().toISOString()){
 const room=await roomAccess(db,me,roomIdRaw);if(!room.owner)throw new AppError(403,'Only the room owner can change the room.');
 if(typeof body.archived==='boolean'){await db.prepare('UPDATE leader_rooms SET archived_at=? WHERE id=?').bind(body.archived?now:null,room.roomId).run();return {ok:true};}
 const name=typeof body.name==='string'?body.name.trim():'',description=typeof body.description==='string'?body.description.trim():'';
 if(!name||name.length>80)throw new AppError(400,'Give the room a name of up to 80 characters.');if(description.length>300)throw new AppError(400,'Descriptions can be up to 300 characters.');
 await db.prepare('UPDATE leader_rooms SET name=?,description=? WHERE id=?').bind(name,description,room.roomId).run();return {ok:true};
}
export async function listRooms(db:D1Database,me:string){
 const leader=await isLeader(db,me);
 const rows=(await db.prepare(`SELECT r.id,r.name,r.description,r.archived_at,rm.status,rm.role,rm.notify,
   (SELECT count(*) FROM room_members x WHERE x.room_id=r.id AND x.status='active') members,
   (SELECT coalesce(nullif(m.body,''),CASE (SELECT kind FROM room_media WHERE id=m.media_id) WHEN 'video' THEN 'Video' ELSE 'Photo' END) FROM room_messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_body,
   (SELECT max(m.created_at) FROM room_messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL) last_at,
   (SELECT count(*) FROM room_messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL AND m.author_id<>?1 AND m.created_at>rm.last_read_at AND ${notBlocked('m.author_id','?1')}) unread,
   (SELECT p.name FROM profiles p WHERE p.id=rm.invited_by) invited_by
  FROM room_members rm JOIN leader_rooms r ON r.id=rm.room_id WHERE rm.player_id=?1 AND r.archived_at IS NULL ORDER BY coalesce((SELECT max(m.created_at) FROM room_messages m WHERE m.room_id=r.id AND m.deleted_at IS NULL),r.created_at) DESC LIMIT 100`).bind(me).all<{id:string;name:string;description:string;status:'invited'|'active';role:'owner'|'member';notify:number;members:number;last_body:string|null;last_at:string|null;unread:number;invited_by:string|null}>()).results;
 const shape=(r:typeof rows[number])=>({id:r.id,name:r.name,description:r.description,role:r.role,members:r.members,lastMessage:(r.last_body??'').slice(0,120),lastAt:r.last_at??'',unread:Math.min(r.unread,99),notify:!!r.notify,invitedBy:r.invited_by});
 return {leader,rooms:leader?rows.filter(r=>r.status==='active').map(shape):[],invitations:rows.filter(r=>r.status==='invited').map(shape)};
}
type Row={id:string;room_id:string;author_id:string;author_name:string;current_name:string;author_deleted:string|null;body:string;created_at:string;media_id:string|null;kind:'image'|'video'|null;content_type:string|null;bytes:number|null};
const SELECT="SELECT m.id,m.room_id,m.author_id,m.author_name,p.name current_name,p.deleted_at author_deleted,m.body,m.created_at,m.media_id,cm.kind,cm.content_type,cm.bytes FROM room_messages m JOIN profiles p ON p.id=m.author_id LEFT JOIN room_media cm ON cm.id=m.media_id";
const view=(r:Row,viewer:string,owner:boolean):RoomMessage=>({id:r.id,roomId:r.room_id,authorId:r.author_deleted?null:r.author_id,authorName:r.author_deleted?`Deleted User (${r.author_name})`:r.current_name,body:r.body,createdAt:r.created_at,media:r.media_id&&r.kind?{id:r.media_id,kind:r.kind,contentType:r.content_type!,bytes:r.bytes!}:null,mine:r.author_id===viewer,canDelete:owner||r.author_id===viewer});
export async function readRoom(db:D1Database,me:string,roomIdRaw:unknown,opts:{before?:unknown}={}){
 const room=await roomAccess(db,me,roomIdRaw);
 let cursor:{created_at:string;id:string}|null=null;
 if(opts.before!==undefined&&opts.before!==null&&opts.before!==''){cursor=await db.prepare('SELECT created_at,id FROM room_messages WHERE id=? AND room_id=?').bind(id(opts.before,'cursor'),room.roomId).first<{created_at:string;id:string}>();if(!cursor)throw new AppError(404,'Message not found.');}
 const limit=ROOM_LIMITS.page,block=" AND NOT EXISTS(SELECT 1 FROM blocks bk WHERE bk.blocker_id=? AND bk.blocked_id=m.author_id)";
 const sql=`${SELECT} WHERE m.room_id=? AND m.deleted_at IS NULL${cursor?' AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''}${block} ORDER BY m.created_at DESC,m.id DESC LIMIT ?`;
 const rows=(await db.prepare(sql).bind(...(cursor?[room.roomId,cursor.created_at,cursor.created_at,cursor.id,me,limit+1]:[room.roomId,me,limit+1])).all<Row>()).results;
 const members=(await db.prepare(`SELECT p.id,p.name,rm.role,rm.status,ph.updated_at photo_version,(SELECT group_concat(c.name,'|') FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.player_id=p.id AND m.status='active' AND m.role IN ${LEADER} AND c.approval_status='approved') clubs FROM room_members rm JOIN profiles p ON p.id=rm.player_id LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE rm.room_id=? AND p.deleted_at IS NULL ORDER BY rm.role,p.name`).bind(room.roomId).all<{id:string;name:string;role:'owner'|'member';status:'invited'|'active';photo_version:string|null;clubs:string|null}>()).results;
 const mine=await db.prepare('SELECT notify FROM room_members WHERE room_id=? AND player_id=?').bind(room.roomId,me).first<{notify:number}>();
 return {me,room:{id:room.roomId,name:room.name,archived:room.archived,owner:room.owner,notify:!!mine?.notify},hasMore:rows.length>limit,messages:rows.slice(0,limit).reverse().map(r=>view(r,me,room.owner)),
  members:members.map(m=>({id:m.id,name:m.name,role:m.role,status:m.status,photoVersion:m.photo_version,clubs:m.clubs?m.clubs.split('|').slice(0,3):[]}) as RoomMember)};
}
export async function postRoomMessage(db:D1Database,me:string,roomIdRaw:unknown,body:{text?:unknown;mediaId?:unknown;clientId?:unknown},now=new Date().toISOString()){
 const room=await roomAccess(db,me,roomIdRaw),clientId=id(body.clientId,'message id');
 if(room.archived)throw new AppError(409,'This room is archived.');
 if(body.text!==undefined&&typeof body.text!=='string')throw new AppError(400,'Write a message.');
 const text=typeof body.text==='string'?body.text.trim():'';if(text.length>ROOM_LIMITS.body)throw new AppError(400,`Messages can be up to ${ROOM_LIMITS.body} characters.`);
 const mediaId=body.mediaId===undefined||body.mediaId===null||body.mediaId===''?null:id(body.mediaId,'attachment');
 if(!text&&!mediaId)throw new AppError(400,'Write a message or attach a photo or video.');
 const existing=await db.prepare(`${SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(me,clientId).first<Row>();if(existing)return {message:view(existing,me,room.owner),roomId:room.roomId,created:false};
 if(((await db.prepare('SELECT count(*) n FROM room_messages WHERE author_id=? AND created_at>?').bind(me,new Date(Date.parse(now)-60000).toISOString()).first<{n:number}>())?.n??0)>=ROOM_LIMITS.perMinute)throw new AppError(429,'You are sending messages too quickly. Please wait a moment.');
 if(mediaId&&!await db.prepare('SELECT 1 x FROM room_media WHERE id=? AND room_id=? AND uploader_id=? AND attached_at IS NULL').bind(mediaId,room.roomId,me).first())throw new AppError(400,'That attachment is no longer available. Upload it again.');
 const messageId=crypto.randomUUID();
 try{await db.batch([
  db.prepare('INSERT INTO room_messages(id,room_id,author_id,author_name,body,media_id,client_id,created_at) SELECT ?,?,?,name,?,?,?,? FROM profiles WHERE id=? AND deleted_at IS NULL').bind(messageId,room.roomId,me,text,mediaId,clientId,now,me),
  ...(mediaId?[db.prepare('UPDATE room_media SET attached_at=? WHERE id=? AND attached_at IS NULL').bind(now,mediaId)]:[]),
 ]);}catch(e){if(e instanceof Error&&/UNIQUE/i.test(e.message)){const again=await db.prepare(`${SELECT} WHERE m.author_id=? AND m.client_id=?`).bind(me,clientId).first<Row>();if(again)return {message:view(again,me,room.owner),roomId:room.roomId,created:false};throw new AppError(409,'That attachment was already used.');}throw e;}
 const row=await db.prepare(`${SELECT} WHERE m.id=?`).bind(messageId).first<Row>();if(!row)throw new AppError(409,'The message could not be saved.');
 return {message:view(row,me,room.owner),roomId:room.roomId,created:true};
}
export async function deleteRoomMessage(db:D1Database,me:string,messageId:unknown){
 const m=await db.prepare('SELECT m.id,m.room_id,m.author_id,cm.r2_key FROM room_messages m LEFT JOIN room_media cm ON cm.id=m.media_id WHERE m.id=? AND m.deleted_at IS NULL').bind(id(messageId,'message')).first<{id:string;room_id:string;author_id:string;r2_key:string|null}>();
 if(!m)throw new AppError(404,'Message not found.');
 const room=await roomAccess(db,me,m.room_id);if(!room.owner&&m.author_id!==me)throw new AppError(403,'Only the author or the room owner can delete this message.');
 await db.prepare('UPDATE room_messages SET deleted_at=? WHERE id=? AND deleted_at IS NULL').bind(new Date().toISOString(),m.id).run();
 return {id:m.id,roomId:m.room_id,r2Key:m.r2_key};
}
// Reports go to Rally administrators (the room owner may be the person being reported), with the message and the five before it.
export async function reportRoomMessage(db:D1Database,me:string,messageId:unknown,reason:unknown,now=new Date().toISOString()){
 const m=await db.prepare('SELECT id,room_id,author_id,created_at FROM room_messages WHERE id=? AND deleted_at IS NULL').bind(id(messageId,'message')).first<{id:string;room_id:string;author_id:string;created_at:string}>();
 if(!m)throw new AppError(404,'Message not found.');await roomAccess(db,me,m.room_id);if(m.author_id===me)throw new AppError(400,'You cannot report your own message.');
 const context=(await db.prepare("SELECT author_id,author_name,CASE WHEN body<>'' THEN body ELSE '[photo or video]' END body,created_at FROM room_messages WHERE room_id=? AND deleted_at IS NULL AND (created_at<? OR id=?) ORDER BY created_at DESC LIMIT 6").bind(m.room_id,m.created_at,m.id).all<{author_id:string;author_name:string;body:string;created_at:string}>()).results.reverse();
 await db.prepare('INSERT INTO safety_reports(id,kind,reporter_id,target_id,message_id,snapshot,reason,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'room',me,m.author_id,m.id,JSON.stringify(context),(typeof reason==='string'?reason.trim():'').slice(0,500),now).run();
 return {ok:true};
}
export async function markRoomRead(db:D1Database,me:string,roomIdRaw:unknown,now=new Date().toISOString()){
 const room=await roomAccess(db,me,roomIdRaw);await db.prepare("UPDATE room_members SET last_read_at=? WHERE room_id=? AND player_id=?").bind(now,room.roomId,me).run();return {ok:true};
}
export async function setRoomNotify(db:D1Database,me:string,roomIdRaw:unknown,on:unknown){
 const room=await roomAccess(db,me,roomIdRaw);if(typeof on!=='boolean')throw new AppError(400,'Choose on or off.');
 await db.prepare('UPDATE room_members SET notify=? WHERE room_id=? AND player_id=?').bind(on?1:0,room.roomId,me).run();return {ok:true};
}
export async function unreadRoomCount(db:D1Database,me:string){
 if(!await isLeader(db,me))return 0;
 return (await db.prepare(`SELECT count(*) n FROM room_messages m JOIN room_members rm ON rm.room_id=m.room_id AND rm.player_id=?1 AND rm.status='active' JOIN leader_rooms r ON r.id=m.room_id AND r.archived_at IS NULL WHERE m.deleted_at IS NULL AND m.author_id<>?1 AND m.created_at>rm.last_read_at AND ${notBlocked('m.author_id','?1')}`).bind(me).first<{n:number}>())?.n??0;
}
// Used by the media routes: same rules as reading the room (uploading is refused in archived rooms).
export async function roomMediaAccess(db:D1Database,viewer:string,roomId:string,upload:boolean){
 const room=await roomAccess(db,viewer,roomId);if(upload&&room.archived)throw new AppError(409,'This room is archived.');
}
