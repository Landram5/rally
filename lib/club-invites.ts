import {AppError} from './rally-errors';
// Auto-join invite links. The normal club link asks people to request membership and wait for approval.
// An invite link is different: whoever holds it joins at once, so it can expire and be turned off.
export type InviteState={token:string;createdAt:string;expiresAt:string|null;uses:number}|null;
export type InvitePreview={clubId:string;name:string;location:string;memberCount:number};
const DAY=86400000;
export const INVITE_DAYS=[7,30,0] as const; // 0 = no expiry
// 128 random bits, URL-safe. Unguessable, so the link itself is the secret.
export function newToken(){const bytes=crypto.getRandomValues(new Uint8Array(16));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
const shape=/^[A-Za-z0-9_-]{22}$/;
async function organizer(db:D1Database,player:string,clubId:string){
 const m=await db.prepare("SELECT 1 x FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND m.role IN ('owner','admin','board') AND c.approval_status IN ('approved','pending')").bind(clubId,player).first();
 if(!m)throw new AppError(403,'Only club organizers can manage the invite link.');
}
export async function activeInvite(db:D1Database,player:string,clubId:string,now=new Date()):Promise<InviteState>{
 await organizer(db,player,clubId);
 const r=await db.prepare(`SELECT token,created_at,expires_at,uses FROM club_invites WHERE club_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 1`).bind(clubId,now.toISOString()).first<{token:string;created_at:string;expires_at:string|null;uses:number}>();
 return r?{token:r.token,createdAt:r.created_at,expiresAt:r.expires_at,uses:r.uses}:null;
}
// Makes a new link and turns off any earlier one, so a link that was shared too widely stops working.
export async function createInvite(db:D1Database,player:string,clubId:string,days:number,now=new Date()):Promise<NonNullable<InviteState>>{
 await organizer(db,player,clubId);
 if(!(INVITE_DAYS as readonly number[]).includes(days))throw new AppError(400,'Choose 7 days, 30 days or no expiry.');
 const token=newToken(),expires=days?new Date(now.getTime()+days*DAY).toISOString():null;
 await db.batch([
  db.prepare('UPDATE club_invites SET revoked_at=? WHERE club_id=? AND revoked_at IS NULL').bind(now.toISOString(),clubId),
  db.prepare('INSERT INTO club_invites(token,club_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?)').bind(token,clubId,player,now.toISOString(),expires),
 ]);
 return {token,createdAt:now.toISOString(),expiresAt:expires,uses:0};
}
export async function revokeInvites(db:D1Database,player:string,clubId:string,now=new Date()){
 await organizer(db,player,clubId);
 await db.prepare('UPDATE club_invites SET revoked_at=? WHERE club_id=? AND revoked_at IS NULL').bind(now.toISOString(),clubId).run();return {ok:true};
}
type Why='unknown'|'revoked'|'expired'|'closed';
export class InviteError extends AppError{constructor(public why:Why){super(why==='unknown'?404:410,why==='revoked'?'This invite link was turned off by the club.':why==='expired'?'This invite link has expired. Ask the club for a new one.':why==='closed'?'This club is not accepting members.':'This invite link is not valid.');}}
async function lookup(db:D1Database,token:string,now:Date){
 if(!shape.test(token))throw new InviteError('unknown');
 const r=await db.prepare('SELECT i.club_id,i.revoked_at,i.expires_at,c.name,c.location,c.approval_status FROM club_invites i JOIN clubs c ON c.id=i.club_id WHERE i.token=?').bind(token).first<{club_id:string;revoked_at:string|null;expires_at:string|null;name:string;location:string;approval_status:string}>();
 if(!r)throw new InviteError('unknown');
 if(r.revoked_at)throw new InviteError('revoked');
 if(r.expires_at&&r.expires_at<=now.toISOString())throw new InviteError('expired');
 if(r.approval_status==='rejected')throw new InviteError('closed');
 return r;
}
// What the join page shows before anyone signs in.
export async function previewInvite(db:D1Database,token:string,now=new Date()):Promise<InvitePreview>{
 const r=await lookup(db,token,now);
 const n=await db.prepare("SELECT count(*) n FROM memberships m JOIN profiles p ON p.id=m.player_id AND p.deleted_at IS NULL WHERE m.club_id=? AND m.status='active'").bind(r.club_id).first<{n:number}>();
 return {clubId:r.club_id,name:r.name,location:r.location,memberCount:n?.n??0};
}
// Joins immediately. Already a member: nothing changes. Asked earlier and still waiting: the request is approved by the link.
export async function acceptInvite(db:D1Database,player:string,token:string,now=new Date()){
 const r=await lookup(db,token,now);
 const profile=await db.prepare('SELECT 1 x FROM profiles WHERE id=? AND deleted_at IS NULL AND auth_id IS NOT NULL').bind(player).first();if(!profile)throw new AppError(403,'Create your player profile first.');
 const existing=await db.prepare('SELECT status FROM memberships WHERE club_id=? AND player_id=?').bind(r.club_id,player).first<{status:string}>();
 if(existing?.status==='active')return {clubId:r.club_id,joined:false};
 if(existing)await db.prepare("UPDATE memberships SET status='active' WHERE club_id=? AND player_id=?").bind(r.club_id,player).run();
 else await db.prepare("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,'member','active',?) ON CONFLICT(club_id,player_id) DO NOTHING").bind(crypto.randomUUID(),r.club_id,player,now.toISOString()).run();
 await db.prepare('UPDATE club_invites SET uses=uses+1 WHERE token=?').bind(token).run();
 return {clubId:r.club_id,joined:true};
}
