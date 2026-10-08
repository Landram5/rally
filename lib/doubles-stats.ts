import {CONFIRMED_DOUBLES} from './doubles';
import {profileFrom,standingsFrom,type DoublesProfile,type DoublesStandings} from './doubles-view';
import type {DoublesMatch} from './doubles-rating';
export type {DoublesProfile,DoublesStandings,DoublesStandingRow,DoublesPairRow} from './doubles-view';
// Database reads for doubles standings and profiles. Display only; ratings come from replayDoubles.
const rows=async(db:D1Database)=>(await db.prepare(CONFIRMED_DOUBLES).all<DoublesMatch>()).results;
const names=async(db:D1Database,ids:string[])=>{const out:Record<string,string>={};for(let i=0;i<ids.length;i+=80){const part=ids.slice(i,i+80);for(const r of (await db.prepare(`SELECT id,name,deleted_at FROM profiles WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part).all<{id:string;name:string;deleted_at?:string|null}>()).results)out[r.id]=r.deleted_at?'Deleted player':r.name;}return out;};
const involved=(matches:DoublesMatch[])=>[...new Set(matches.flatMap(m=>[m.a1,m.a2,m.b1,m.b2]))];
// Standings of a club (active members) or of everyone the viewer shares a club with. Only players with a doubles result are listed.
export async function readDoublesStandings(db:D1Database,viewer:string,clubId:string):Promise<DoublesStandings>{
 const scopeIds=clubId==='all'?(await db.prepare("SELECT DISTINCT m2.player_id id FROM memberships m1 JOIN memberships m2 ON m2.club_id=m1.club_id AND m2.status='active' WHERE m1.player_id=? AND m1.status='active'").bind(viewer).all<{id:string}>()).results
  :(await db.prepare("SELECT m2.player_id id FROM memberships m1 JOIN memberships m2 ON m2.club_id=m1.club_id AND m2.status='active' WHERE m1.player_id=? AND m1.status='active' AND m1.club_id=?").bind(viewer,clubId).all<{id:string}>()).results;
 const matches=await rows(db),label=await names(db,involved(matches));
 return standingsFrom(matches,new Set(scopeIds.map(r=>r.id)),id=>label[id]??'Player');
}
// One player's doubles summary, visible to people who share a club with them (or the player). No match details beyond names and dates.
export async function readDoublesProfile(db:D1Database,viewer:string,playerId:string):Promise<DoublesProfile|null>{
 if(viewer!==playerId){const shared=await db.prepare("SELECT 1 x FROM memberships a JOIN memberships b ON b.club_id=a.club_id AND b.status='active' WHERE a.player_id=? AND a.status='active' AND b.player_id=? LIMIT 1").bind(viewer,playerId).first();if(!shared)return null;}
 const me=await db.prepare('SELECT name,deleted_at FROM profiles WHERE id=?').bind(playerId).first<{name:string;deleted_at?:string|null}>();if(!me||me.deleted_at)return null;
 const matches=await rows(db),label=await names(db,involved(matches));
 return profileFrom(matches,playerId,me.name,id=>label[id]??'Player');
}
