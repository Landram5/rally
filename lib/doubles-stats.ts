import {CONFIRMED_DOUBLES} from './doubles';
import {replayDoubles,type DoublesChange,type DoublesMatch} from './doubles-rating';
import {ESTABLISHED_MATCHES} from './seeding';
// Read models for doubles: club standings, a player's doubles profile and the best pairs. Display only; ratings come from replayDoubles.
const rows=async(db:D1Database)=>(await db.prepare(CONFIRMED_DOUBLES).all<DoublesMatch>()).results;
const names=async(db:D1Database,ids:string[])=>{const out:Record<string,string>={};if(!ids.length)return out;for(let i=0;i<ids.length;i+=80){const part=ids.slice(i,i+80);for(const r of (await db.prepare(`SELECT id,name,deleted_at FROM profiles WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part).all<{id:string;name:string;deleted_at?:string|null}>()).results)out[r.id]=r.deleted_at?'Deleted player':r.name;}return out;};
export type DoublesStandingRow={playerId:string;name:string;rating:number;played:number;wins:number;partners:number;established:boolean};
export type DoublesPairRow={ids:[string,string];names:[string,string];played:number;wins:number};
export type DoublesStandings={players:DoublesStandingRow[];pairs:DoublesPairRow[]};
const pairKey=(a:string,b:string)=>[a,b].sort().join('|');
// Standings of a club (active members) or of everyone the viewer shares a club with. Only players with a doubles result are listed.
export async function readDoublesStandings(db:D1Database,viewer:string,clubId:string):Promise<DoublesStandings>{
 const scopeIds=clubId==='all'?(await db.prepare("SELECT DISTINCT m2.player_id id FROM memberships m1 JOIN memberships m2 ON m2.club_id=m1.club_id AND m2.status='active' WHERE m1.player_id=? AND m1.status='active'").bind(viewer).all<{id:string}>()).results
  :(await db.prepare("SELECT m2.player_id id FROM memberships m1 JOIN memberships m2 ON m2.club_id=m1.club_id AND m2.status='active' WHERE m1.player_id=? AND m1.status='active' AND m1.club_id=?").bind(viewer,clubId).all<{id:string}>()).results;
 const allowed=new Set(scopeIds.map(r=>r.id)),matches=await rows(db),{ratings}=replayDoubles(matches);
 const list=[...ratings].filter(([id,r])=>allowed.has(id)&&r.played>0);
 const label=await names(db,list.map(([id])=>id));
 const players=list.map(([id,r])=>({playerId:id,name:label[id]??'Player',rating:Math.round(r.rating*10)/10,played:r.played,wins:r.wins,partners:r.distinctPartners,established:r.established})).sort((a,b)=>b.rating-a.rating||b.played-a.played||a.name.localeCompare(b.name));
 const pairs=new Map<string,{ids:[string,string];played:number;wins:number}>();
 for(const m of matches){const games=typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games,winA=games.filter(g=>g[0]>g[1]).length*2>games.length;
  for(const [x,y,won] of [[m.a1,m.a2,winA],[m.b1,m.b2,!winA]] as [string,string,boolean][]){if(!allowed.has(x)||!allowed.has(y))continue;const k=pairKey(x,y),p=pairs.get(k)??{ids:[x,y].sort() as [string,string],played:0,wins:0};p.played++;if(won)p.wins++;pairs.set(k,p);}}
 const pairList=[...pairs.values()].sort((a,b)=>b.wins/b.played-a.wins/a.played||b.played-a.played).slice(0,10);
 const pairNames=await names(db,[...new Set(pairList.flatMap(p=>p.ids))]);
 return {players,pairs:pairList.map(p=>({...p,names:[pairNames[p.ids[0]]??'Player',pairNames[p.ids[1]]??'Player'] as [string,string]}))};
}
export type DoublesProfile={playerId:string;name:string;rating:number|null;played:number;wins:number;established:boolean;partners:{id:string;name:string;played:number;wins:number}[];history:{date:string;value:number;won:boolean;partner:string;opponents:string}[];asOf:string};
// One player's doubles summary, visible to people who share a club with them (or the player). No match details beyond names and dates.
export async function readDoublesProfile(db:D1Database,viewer:string,playerId:string):Promise<DoublesProfile|null>{
 if(viewer!==playerId){const shared=await db.prepare("SELECT 1 x FROM memberships a JOIN memberships b ON b.club_id=a.club_id AND b.status='active' WHERE a.player_id=? AND a.status='active' AND b.player_id=? LIMIT 1").bind(viewer,playerId).first();if(!shared)return null;}
 const me=await db.prepare('SELECT name,deleted_at FROM profiles WHERE id=?').bind(playerId).first<{name:string;deleted_at?:string|null}>();if(!me||me.deleted_at)return null;
 const {ratings,changes}=replayDoubles(await rows(db)),mine=changes.filter(c=>c.playerId===playerId),r=ratings.get(playerId);
 const partnerStats=new Map<string,{played:number;wins:number}>();for(const c of mine){const s=partnerStats.get(c.partnerId)??{played:0,wins:0};s.played++;if(c.won)s.wins++;partnerStats.set(c.partnerId,s);}
 const label=await names(db,[...partnerStats.keys(),...mine.flatMap((c:DoublesChange)=>[c.partnerId,...c.opponents])]);
 return {playerId,name:me.name,rating:r?Math.round(r.rating*10)/10:null,played:r?.played??0,wins:r?.wins??0,established:(r?.played??0)>=ESTABLISHED_MATCHES,
  partners:[...partnerStats].map(([id,s])=>({id,name:label[id]??'Player',...s})).sort((a,b)=>b.played-a.played||a.name.localeCompare(b.name)).slice(0,10),
  history:mine.slice(-30).map(c=>({date:c.date,value:Math.round(c.after*10)/10,won:c.won,partner:label[c.partnerId]??'Player',opponents:c.opponents.map(o=>label[o]??'Player').join(' & ')})),asOf:new Date().toISOString().slice(0,10)};
}
