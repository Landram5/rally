import {AppError} from './rally-errors';
import {scoreError} from './match-rules';
import {replayDoubles,type DoublesMatch} from './doubles-rating';
const fail=(status:number,message:string):never=>{throw new AppError(status,message)};
const id=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value))fail(400,'Invalid identifier.');return value as string;};
export type SavedDoubles={id:string;club_id:string;a1:string;a2:string;b1:string;b2:string;games:string;best_of:number;played_on:string;status:string;submitted_by:string;confirmed_by:string|null;tournament_id:string|null;revision:number;created_at:string};
export const isOnSide=(m:Pick<SavedDoubles,'a1'|'a2'|'b1'|'b2'>,player:string)=>[m.a1,m.a2,m.b1,m.b2].includes(player);
const sideOf=(m:Pick<SavedDoubles,'a1'|'a2'|'b1'|'b2'>,player:string)=>m.a1===player||m.a2===player?'a':m.b1===player||m.b2===player?'b':null;
// Same rule as singles: an opponent of the person who submitted (or a club administrator) may confirm.
export function canConfirmDoubles(m:SavedDoubles,player:string,isAdmin:boolean){
 if(m.status!=='pending')return false;if(isAdmin)return true;const mine=sideOf(m,player),theirs=sideOf(m,m.submitted_by);return !!mine&&mine!==theirs;
}
export async function doublesAction(db:D1Database,user:{id:string},body:Record<string,unknown>,now=new Date().toISOString()){
 const q=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args),action=String(body.action);
 const member=(club:string,player:string)=>q("SELECT role FROM memberships WHERE club_id=? AND player_id=? AND status='active'",club,player).first<{role:string}>();
 if(action==='record_doubles_match'){
  const matchId=id(body.id),clubId=id(body.clubId),[a1,a2,b1,b2]=[body.a1,body.a2,body.b1,body.b2].map(id),bestOf=body.bestOf,playedOn=typeof body.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.date)&&!Number.isNaN(Date.parse(body.date))?body.date:fail(400,'Choose a valid date.');
  if(new Set([a1,a2,b1,b2]).size!==4)fail(400,'Choose four different players, two on each side.');
  if(playedOn>now.slice(0,10))fail(400,'A result cannot be dated in the future.');
  const err=scoreError('a','b',body.games,bestOf);if(err)fail(400,err);
  const mine=await member(clubId,user.id),isAdmin=!!mine&&['owner','admin','board'].includes(mine.role);
  if(clubId!=='unaffiliated'&&!mine)fail(403,'Join this club before recording a result.');
  if(!isAdmin&&![a1,a2,b1,b2].includes(user.id))fail(403,'You can only submit matches you played in.');
  if(clubId==='unaffiliated'){for(const p of [a1,a2,b1,b2])if(!await q('SELECT id FROM profiles WHERE id=? AND auth_id IS NOT NULL AND deleted_at IS NULL',p).first())fail(400,'Choose four registered players for an unaffiliated match.');}
  else for(const p of [a1,a2,b1,b2])if(!await member(clubId,p))fail(400,'All four players must be active members of this club.');
  const existing=await q('SELECT * FROM doubles_matches WHERE id=?',matchId).first<SavedDoubles>();
  if(existing){if(existing.submitted_by!==user.id||existing.a1!==a1||existing.a2!==a2||existing.b1!==b1||existing.b2!==b2||existing.games!==JSON.stringify(body.games)||existing.club_id!==clubId||existing.best_of!==bestOf||existing.played_on!==playedOn)fail(409,'Submission ID already used.');return {ok:true,id:matchId};}
  const status=isAdmin?'confirmed':'pending';
  await db.batch([q('INSERT INTO doubles_matches (id,club_id,a1,a2,b1,b2,games,best_of,played_on,status,submitted_by,confirmed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',matchId,clubId,a1,a2,b1,b2,JSON.stringify(body.games),bestOf,playedOn,status,user.id,isAdmin?user.id:null,now),q('INSERT INTO doubles_audit (id,match_id,actor_id,action,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),matchId,user.id,isAdmin?'recorded_and_verified':'submitted',now)]);
  return {ok:true,id:matchId,status};
 }
 if(action==='confirm_doubles_match'||action==='void_doubles_match'){
  const matchId=id(body.id),m=await q('SELECT * FROM doubles_matches WHERE id=?',matchId).first<SavedDoubles>();if(!m)fail(404,'Match not found.');
  if(m!.tournament_id)fail(409,'Manage tournament results from the tournament draw.');
  const mine=await member(m!.club_id,user.id),isAdmin=!!mine&&['owner','admin','board'].includes(mine.role);
  if(action==='confirm_doubles_match'){
   if(!canConfirmDoubles(m!,user.id,isAdmin))fail(403,'Only an opponent or a club administrator can confirm a pending result.');
   await db.batch([q("INSERT INTO doubles_audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'confirmed',? FROM doubles_matches WHERE id=? AND status='pending'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE doubles_matches SET status='confirmed',confirmed_by=?,revision=revision+1 WHERE id=? AND status='pending'",user.id,matchId)]);
  }else{
   if(!isAdmin&&!(m!.submitted_by===user.id&&m!.status==='pending'))fail(403,'Only an administrator can void a confirmed result.');
   await db.batch([q("INSERT INTO doubles_audit (id,match_id,actor_id,action,created_at) SELECT ?,id,?,'voided',? FROM doubles_matches WHERE id=? AND status!='voided'",crypto.randomUUID(),user.id,now,matchId),q("UPDATE doubles_matches SET status='voided',revision=revision+1 WHERE id=? AND status!='voided'",matchId)]);
  }
  return {ok:true};
 }
 return fail(400,'Unknown doubles action.');
}
// Matches a viewer may see: members of the club (or players in an unaffiliated match). Newest first.
export async function readDoublesMatches(db:D1Database,viewer:string,clubId:string,limit=50,offset=0){
 const visible=clubId==='unaffiliated'?'(a1=?2 OR a2=?2 OR b1=?2 OR b2=?2)':"EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=doubles_matches.club_id AND m.player_id=?2 AND m.status='active')";
 const rows=(await db.prepare(`SELECT * FROM doubles_matches WHERE club_id=?1 AND ${visible} ORDER BY played_on DESC,created_at DESC LIMIT ?3 OFFSET ?4`).bind(clubId,viewer,Math.min(Math.max(limit,1),100),Math.max(offset,0)).all<SavedDoubles>()).results;
 return rows.map(m=>({...m,games:JSON.parse(m.games) as [number,number][]}));
}
// Doubles ratings, replayed from every confirmed doubles match. Players may start from a singles estimate.
// Confirmed doubles results with the tournament's rating weight, so cross-club events count 3x exactly as in singles.
export const CONFIRMED_DOUBLES="SELECT d.id,d.club_id,d.a1,d.a2,d.b1,d.b2,d.games,d.best_of,d.played_on,d.status,d.tournament_id,d.created_at,t.rating_weight tournament_weight FROM doubles_matches d LEFT JOIN tournaments t ON t.id=d.tournament_id WHERE d.status='confirmed'";
export async function readDoublesRatings(db:D1Database,starts:Record<string,number>={},asOf=new Date().toISOString().slice(0,10)){
 const rows=(await db.prepare(CONFIRMED_DOUBLES).all<DoublesMatch>()).results;
 return replayDoubles(rows,asOf,starts);
}
export type DoublesFeedItem=Omit<SavedDoubles,'games'>&{games:[number,number][];names:Record<string,string>;canConfirm:boolean;canVoid:boolean;clubName:string};
// The feed shown in the Matches tab: one club, or every club the viewer belongs to, plus unaffiliated matches they played in.
export async function readDoublesFeed(db:D1Database,viewer:string,clubId:string,limit=20,offset=0):Promise<DoublesFeedItem[]>{
 const mine="EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=d.club_id AND m.player_id=?1 AND m.status='active')",played="(d.club_id='unaffiliated' AND ?1 IN (d.a1,d.a2,d.b1,d.b2))";
 const scope=clubId==='all'?`(${mine} OR ${played})`:clubId==='unaffiliated'?played:`(d.club_id=?2 AND ${mine})`;
 const rows=(await db.prepare(`SELECT d.*,c.name club_name,pa1.name n_a1,pa2.name n_a2,pb1.name n_b1,pb2.name n_b2,EXISTS(SELECT 1 FROM memberships m WHERE m.club_id=d.club_id AND m.player_id=?1 AND m.status='active' AND m.role IN ('owner','admin','board')) is_admin FROM doubles_matches d JOIN clubs c ON c.id=d.club_id JOIN profiles pa1 ON pa1.id=d.a1 JOIN profiles pa2 ON pa2.id=d.a2 JOIN profiles pb1 ON pb1.id=d.b1 JOIN profiles pb2 ON pb2.id=d.b2 WHERE ${scope} ORDER BY d.played_on DESC,d.created_at DESC LIMIT ?3 OFFSET ?4`).bind(viewer,clubId,Math.min(Math.max(limit,1),50),Math.max(offset,0)).all<SavedDoubles&{club_name:string;n_a1:string;n_a2:string;n_b1:string;n_b2:string;is_admin:number}>()).results;
 return rows.map(({club_name,n_a1,n_a2,n_b1,n_b2,is_admin,...m})=>({...m,games:JSON.parse(m.games) as [number,number][],names:{[m.a1]:n_a1,[m.a2]:n_a2,[m.b1]:n_b1,[m.b2]:n_b2},canConfirm:canConfirmDoubles(m,viewer,!!is_admin),canVoid:m.status!=='voided'&&(!!is_admin||(m.submitted_by===viewer&&m.status==='pending')),clubName:club_name}));
}// Seeds for a doubles draw: strongest team first, by the average of the two players' doubles ratings (400 when unrated).
export async function suggestTeamSeeds(db:D1Database,teams:{id:string;p1:string;p2:string}[]):Promise<string[]>{
 const rows=(await db.prepare(CONFIRMED_DOUBLES).all<DoublesMatch>()).results;
 const {ratings}=replayDoubles(rows),strength=(t:{p1:string;p2:string})=>((ratings.get(t.p1)?.rating??400)+(ratings.get(t.p2)?.rating??400))/2;
 return teams.map((t,i)=>({t,i,s:strength(t)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.t.id);
}