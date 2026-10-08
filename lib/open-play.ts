import {AppError} from './rally-errors';
import {profilePhotoUrl} from './profile-photo';
import {loadRatingMatches} from './match-changes';
import {calculateRatings} from './seeding';
export const OPEN_PLAY_DEFAULT_MINUTES=120,OPEN_PLAY_MIN_MINUTES=15,OPEN_PLAY_MAX_MINUTES=360,OPEN_PLAY_NOTE_MAX=120;
export type OpenPlayEntry={id:string;clubId:string;playerId:string;name:string;photoUrl:string|null;note:string;startedAt:string;expiresAt:string;rating:number|null;isMe:boolean};
const member=async(db:D1Database,clubId:string,playerId:string)=>!!await db.prepare("SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND c.approval_status='approved' AND p.deleted_at IS NULL").bind(clubId,playerId).first();
// Only active members of the club see who is looking for a game; expired and ended rows never show.
export async function readOpenPlay(db:D1Database,viewerId:string,clubId:string,now=new Date().toISOString()):Promise<OpenPlayEntry[]>{
 if(!clubId||!await member(db,clubId,viewerId))return [];
 const rows=(await db.prepare("SELECT o.id,o.club_id,o.player_id,o.note,o.started_at,o.expires_at,p.name,ph.updated_at AS photo_version FROM open_play o JOIN profiles p ON p.id=o.player_id AND p.deleted_at IS NULL JOIN memberships m ON m.club_id=o.club_id AND m.player_id=o.player_id AND m.status='active' LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE o.club_id=? AND o.ended_at IS NULL AND o.expires_at>? ORDER BY o.started_at,o.id").bind(clubId,now).all<{id:string;club_id:string;player_id:string;note:string;started_at:string;expires_at:string;name:string;photo_version:string|null}>()).results;
 if(!rows.length)return [];
 const ratings=calculateRatings(await loadRatingMatches(db),now.slice(0,10));
 return rows.map(r=>({id:r.id,clubId:r.club_id,playerId:r.player_id,name:r.name,photoUrl:profilePhotoUrl(r.player_id,r.photo_version),note:r.note,startedAt:r.started_at,expiresAt:r.expires_at,rating:ratings.get(r.player_id)?Math.round(ratings.get(r.player_id)!.rating):null,isMe:r.player_id===viewerId}));
}
export async function openPlayAction(db:D1Database,playerId:string,body:Record<string,unknown>,now=new Date().toISOString()){
 const action=body.action,clubId=typeof body.clubId==='string'?body.clubId:'';
 if(!['check_in','check_out'].includes(String(action)))throw new AppError(400,'Choose an open play action.');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(clubId))throw new AppError(400,'Choose a club.');
 if(!await member(db,clubId,playerId))throw new AppError(403,'Only active club members can use open play.');
 if(action==='check_out'){await db.prepare('UPDATE open_play SET ended_at=? WHERE club_id=? AND player_id=? AND ended_at IS NULL').bind(now,clubId,playerId).run();return {ok:true};}
 const note=typeof body.note==='string'?body.note.trim().replace(/\s+/g,' '):'';if(note.length>OPEN_PLAY_NOTE_MAX)throw new AppError(400,`Keep the note under ${OPEN_PLAY_NOTE_MAX} characters.`);
 const minutes=body.minutes===undefined?OPEN_PLAY_DEFAULT_MINUTES:Number(body.minutes);if(!Number.isInteger(minutes)||minutes<OPEN_PLAY_MIN_MINUTES||minutes>OPEN_PLAY_MAX_MINUTES)throw new AppError(400,'Choose between 15 minutes and 6 hours.');
 const id=crypto.randomUUID(),expires=new Date(Date.parse(now)+minutes*60000).toISOString(),cleanup=new Date(Date.parse(now)-7*86400000).toISOString();
 await db.batch([db.prepare('UPDATE open_play SET ended_at=? WHERE club_id=? AND player_id=? AND ended_at IS NULL').bind(now,clubId,playerId),db.prepare('INSERT INTO open_play(id,club_id,player_id,note,started_at,expires_at) VALUES (?,?,?,?,?,?)').bind(id,clubId,playerId,note,now,expires),db.prepare('DELETE FROM open_play WHERE expires_at<? AND club_id=?').bind(cleanup,clubId)]);
 return {ok:true,id,expiresAt:expires};
}
