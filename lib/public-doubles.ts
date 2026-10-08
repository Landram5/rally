import {replayDoubles,type DoublesMatch} from './doubles-rating';
// Public doubles pages: a confirmed result and a pair's record together. Only approved clubs, confirmed results and players who still have an account appear.
const validId=(value:string)=>/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const PUBLIC_DOUBLES="SELECT d.id,d.club_id,d.a1,d.a2,d.b1,d.b2,d.games,d.best_of,d.played_on,d.status,d.tournament_id,d.created_at,t.rating_weight tournament_weight,c.name club_name,t.name tournament_name FROM doubles_matches d JOIN clubs c ON c.id=d.club_id LEFT JOIN tournaments t ON t.id=d.tournament_id AND t.deleted_at IS NULL WHERE d.status='confirmed' AND c.approval_status='approved' AND (d.tournament_id IS NULL OR t.id IS NOT NULL)";
type Row=DoublesMatch&{club_id:string;club_name:string;tournament_name:string|null;best_of:number};
const games=(m:DoublesMatch)=>typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;
async function profileNames(db:D1Database,ids:string[]){const out=new Map<string,string>(),deleted=new Set<string>();for(let i=0;i<ids.length;i+=80){const part=ids.slice(i,i+80);for(const r of (await db.prepare(`SELECT id,name,deleted_at FROM profiles WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part).all<{id:string;name:string;deleted_at:string|null}>()).results){if(r.deleted_at)deleted.add(r.id);else out.set(r.id,r.name);}}return {out,deleted};}
export type PublicDoublesMatch={id:string;sides:[{ids:[string,string];names:[string,string]},{ids:[string,string];names:[string,string]}];games:[number,number][];bestOf:number;playedOn:string;clubId:string;clubName:string;tournament:{id:string;name:string}|null;changes:Record<string,number>};
export async function getPublicDoublesMatch(db:D1Database,matchId:string):Promise<PublicDoublesMatch|null>{
 if(!validId(matchId))return null;
 const rows=(await db.prepare(PUBLIC_DOUBLES).all<Row>()).results,m=rows.find(r=>r.id===matchId);if(!m)return null;
 const ids=[m.a1,m.a2,m.b1,m.b2],{out,deleted}=await profileNames(db,ids);if(ids.some(id=>deleted.has(id)||!out.has(id)))return null;
 const {changes}=replayDoubles(rows),mine=Object.fromEntries(changes.filter(c=>c.matchId===matchId).map(c=>[c.playerId,Math.round(c.delta*10)/10]));
 const side=(x:string,y:string)=>({ids:[x,y] as [string,string],names:[out.get(x)!,out.get(y)!] as [string,string]});
 return {id:m.id,sides:[side(m.a1,m.a2),side(m.b1,m.b2)],games:games(m),bestOf:m.best_of,playedOn:m.played_on,clubId:m.club_id,clubName:m.club_name,tournament:m.tournament_id&&m.tournament_name?{id:m.tournament_id,name:m.tournament_name}:null,changes:mine};
}
export type PublicPair={ids:[string,string];names:[string,string];played:number;wins:number;ratings:Record<string,number>;recent:{id:string;playedOn:string;won:boolean;score:string;opponents:[string,string];opponentIds:[string,string];clubName:string}[];opponents:{ids:[string,string];names:[string,string];played:number;wins:number}[]};
// A pair's record together, from confirmed public results where both played on the same side.
export async function getPublicPair(db:D1Database,aId:string,bId:string):Promise<PublicPair|null>{
 if(!validId(aId)||!validId(bId)||aId===bId)return null;
 const rows=(await db.prepare(PUBLIC_DOUBLES).all<Row>()).results,together=rows.filter(m=>[[m.a1,m.a2],[m.b1,m.b2]].some(s=>s.includes(aId)&&s.includes(bId)));if(!together.length)return null;
 const ids=[...new Set(together.flatMap(m=>[m.a1,m.a2,m.b1,m.b2]))],{out,deleted}=await profileNames(db,ids);if(deleted.has(aId)||deleted.has(bId)||!out.has(aId)||!out.has(bId))return null;
 const label=(id:string)=>deleted.has(id)||!out.has(id)?'Deleted player':out.get(id)!;
 const opp=new Map<string,{ids:[string,string];played:number;wins:number}>(),recent:PublicPair['recent']=[];let wins=0;
 for(const m of [...together].sort((x,y)=>y.played_on.localeCompare(x.played_on)||(y.created_at??'').localeCompare(x.created_at??''))){
  const g=games(m),aWins=g.filter(x=>x[0]>x[1]).length,onA=[m.a1,m.a2].includes(aId),won=onA?aWins*2>g.length:aWins*2<g.length,them=(onA?[m.b1,m.b2]:[m.a1,m.a2]).sort() as [string,string];
  if(won)wins++;const k=them.join('|'),o=opp.get(k)??{ids:them,played:0,wins:0};o.played++;if(won)o.wins++;opp.set(k,o);
  if(recent.length<10)recent.push({id:m.id,playedOn:m.played_on,won,score:g.map(x=>onA?`${x[0]}\u2013${x[1]}`:`${x[1]}\u2013${x[0]}`).join(' \u00b7 '),opponents:[label(them[0]),label(them[1])],opponentIds:them,clubName:m.club_name});
 }
 const extra=[...opp.values()].flatMap(o=>o.ids).filter(id=>!out.has(id)&&!deleted.has(id));if(extra.length){const more=await profileNames(db,[...new Set(extra)]);more.out.forEach((v,k)=>out.set(k,v));more.deleted.forEach(id=>deleted.add(id));}
 const {ratings}=replayDoubles(rows);
 return {ids:[aId,bId],names:[out.get(aId)!,out.get(bId)!],played:together.length,wins,ratings:{[aId]:Math.round((ratings.get(aId)?.rating??0)*10)/10,[bId]:Math.round((ratings.get(bId)?.rating??0)*10)/10},recent,
  opponents:[...opp.values()].sort((x,y)=>y.played-x.played||y.wins-x.wins).slice(0,6).map(o=>({...o,names:[label(o.ids[0]),label(o.ids[1])] as [string,string]}))};
}
export type PublicDoublesBoard={players:{id:string;name:string;rating:number;played:number;wins:number;established:boolean}[];pairs:{ids:[string,string];names:[string,string];played:number;wins:number}[]};
// The public doubles leaderboard: players and pairs from confirmed results in approved clubs.
export async function getPublicDoublesBoard(db:D1Database):Promise<PublicDoublesBoard>{
 const rows=(await db.prepare(PUBLIC_DOUBLES).all<Row>()).results,{ratings}=replayDoubles(rows),ids=[...ratings.keys()],{out,deleted}=await profileNames(db,ids);
 const players=ids.filter(id=>out.has(id)&&!deleted.has(id)&&ratings.get(id)!.played>0).map(id=>{const r=ratings.get(id)!;return {id,name:out.get(id)!,rating:Math.round(r.rating*10)/10,played:r.played,wins:r.wins,established:r.established};}).sort((a,b)=>b.rating-a.rating||b.played-a.played||a.name.localeCompare(b.name)).slice(0,50);
 const pairs=new Map<string,{ids:[string,string];played:number;wins:number}>();
 for(const m of rows){const g=games(m),winA=g.filter(x=>x[0]>x[1]).length*2>g.length;
  for(const [x,y,won] of [[m.a1,m.a2,winA],[m.b1,m.b2,!winA]] as [string,string,boolean][]){if(!out.has(x)||!out.has(y))continue;const k=[x,y].sort().join('|'),p=pairs.get(k)??{ids:[x,y].sort() as [string,string],played:0,wins:0};p.played++;if(won)p.wins++;pairs.set(k,p);}}
 return {players,pairs:[...pairs.values()].filter(p=>p.played>=2).sort((a,b)=>b.wins/b.played-a.wins/a.played||b.played-a.played).slice(0,10).map(p=>({...p,names:[out.get(p.ids[0])!,out.get(p.ids[1])!] as [string,string]}))};
}
export type PublicDoublesPlayer={rating:number;played:number;wins:number;established:boolean;partners:{id:string;name:string;played:number;wins:number}[]};
// One player's doubles summary for their public page, or null when they have no confirmed public doubles result.
export async function getPublicDoublesPlayer(db:D1Database,playerId:string):Promise<PublicDoublesPlayer|null>{
 if(!validId(playerId))return null;
 const rows=(await db.prepare(PUBLIC_DOUBLES).all<Row>()).results,{ratings,changes}=replayDoubles(rows),r=ratings.get(playerId);if(!r||!r.played)return null;
 const stats=new Map<string,{played:number;wins:number}>();for(const c of changes.filter(c=>c.playerId===playerId)){const s=stats.get(c.partnerId)??{played:0,wins:0};s.played++;if(c.won)s.wins++;stats.set(c.partnerId,s);}
 const {out,deleted}=await profileNames(db,[...stats.keys()]);
 return {rating:Math.round(r.rating*10)/10,played:r.played,wins:r.wins,established:r.established,partners:[...stats].filter(([id])=>out.has(id)&&!deleted.has(id)).map(([id,s])=>({id,name:out.get(id)!,...s})).sort((a,b)=>b.played-a.played||a.name.localeCompare(b.name)).slice(0,6)};
}
export type PublicPairHeadToHead={a:{ids:[string,string];names:[string,string];wins:number};b:{ids:[string,string];names:[string,string];wins:number};matches:{id:string;playedOn:string;score:string;aWon:boolean;clubName:string}[]};
// Record between two specific pairs, shown from the first pair's side.
export async function getPublicPairHeadToHead(db:D1Database,a:[string,string],b:[string,string]):Promise<PublicPairHeadToHead|null>{
 const all=[...a,...b];if(all.some(id=>!validId(id))||new Set(all).size!==4)return null;
 const rows=(await db.prepare(PUBLIC_DOUBLES).all<Row>()).results,sameSide=(m:Row,p:[string,string])=>[[m.a1,m.a2],[m.b1,m.b2]].findIndex(s=>s.includes(p[0])&&s.includes(p[1]));
 const meetings=rows.filter(m=>{const x=sameSide(m,a),y=sameSide(m,b);return x>=0&&y>=0&&x!==y;});if(!meetings.length)return null;
 const {out,deleted}=await profileNames(db,all);if(all.some(id=>!out.has(id)||deleted.has(id)))return null;
 let aWins=0;const matches=[...meetings].sort((x,y)=>y.played_on.localeCompare(x.played_on)).map(m=>{const g=games(m),onA=sameSide(m,a)===0,sideWins=g.filter(s=>s[0]>s[1]).length,aWon=onA?sideWins*2>g.length:sideWins*2<g.length;if(aWon)aWins++;return {id:m.id,playedOn:m.played_on,score:g.map(s=>onA?`${s[0]}\u2013${s[1]}`:`${s[1]}\u2013${s[0]}`).join(' \u00b7 '),aWon,clubName:m.club_name};});
 return {a:{ids:a,names:[out.get(a[0])!,out.get(a[1])!],wins:aWins},b:{ids:b,names:[out.get(b[0])!,out.get(b[1])!],wins:meetings.length-aWins},matches:matches.slice(0,15)};
}