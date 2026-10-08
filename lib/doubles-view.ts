import {replayDoubles,type DoublesMatch} from './doubles-rating';
import {ESTABLISHED_MATCHES} from './seeding';
// Pure doubles read models. The server reads matches from the database and the sample demo reads them from memory; both use these.
export type DoublesStandingRow={playerId:string;name:string;rating:number;played:number;wins:number;partners:number;established:boolean};
export type DoublesPairRow={ids:[string,string];names:[string,string];played:number;wins:number};
export type DoublesStandings={players:DoublesStandingRow[];pairs:DoublesPairRow[]};
export type DoublesProfile={playerId:string;name:string;rating:number|null;played:number;wins:number;established:boolean;partners:{id:string;name:string;played:number;wins:number}[];history:{date:string;value:number;won:boolean;partner:string;opponents:string}[];asOf:string};
const pairKey=(a:string,b:string)=>[a,b].sort().join('|');
const gamesOf=(m:DoublesMatch)=>typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;
// `allowed` limits who is listed (the people in the chosen club, or everyone the viewer shares a club with).
export function standingsFrom(matches:DoublesMatch[],allowed:Set<string>,label:(id:string)=>string,asOf?:string):DoublesStandings{
 const {ratings}=replayDoubles(matches,asOf);
 const players=[...ratings].filter(([id,r])=>allowed.has(id)&&r.played>0).map(([id,r])=>({playerId:id,name:label(id),rating:Math.round(r.rating*10)/10,played:r.played,wins:r.wins,partners:r.distinctPartners,established:r.established})).sort((a,b)=>b.rating-a.rating||b.played-a.played||a.name.localeCompare(b.name));
 const pairs=new Map<string,{ids:[string,string];played:number;wins:number}>();
 for(const m of matches.filter(m=>m.status==='confirmed')){const games=gamesOf(m),winA=games.filter(g=>g[0]>g[1]).length*2>games.length;
  for(const [x,y,won] of [[m.a1,m.a2,winA],[m.b1,m.b2,!winA]] as [string,string,boolean][]){if(!allowed.has(x)||!allowed.has(y))continue;const k=pairKey(x,y),p=pairs.get(k)??{ids:[x,y].sort() as [string,string],played:0,wins:0};p.played++;if(won)p.wins++;pairs.set(k,p);}}
 return {players,pairs:[...pairs.values()].sort((a,b)=>b.wins/b.played-a.wins/a.played||b.played-a.played).slice(0,10).map(p=>({...p,names:[label(p.ids[0]),label(p.ids[1])] as [string,string]}))};
}
export function profileFrom(matches:DoublesMatch[],playerId:string,name:string,label:(id:string)=>string,asOf?:string):DoublesProfile{
 const {ratings,changes}=replayDoubles(matches,asOf),mine=changes.filter(c=>c.playerId===playerId),r=ratings.get(playerId);
 const stats=new Map<string,{played:number;wins:number}>();for(const c of mine){const s=stats.get(c.partnerId)??{played:0,wins:0};s.played++;if(c.won)s.wins++;stats.set(c.partnerId,s);}
 return {playerId,name,rating:r?Math.round(r.rating*10)/10:null,played:r?.played??0,wins:r?.wins??0,established:(r?.played??0)>=ESTABLISHED_MATCHES,
  partners:[...stats].map(([id,s])=>({id,name:label(id),...s})).sort((a,b)=>b.played-a.played||a.name.localeCompare(b.name)).slice(0,10),
  history:mine.slice(-30).map(c=>({date:c.date,value:Math.round(c.after*10)/10,won:c.won,partner:label(c.partnerId),opponents:c.opponents.map(label).join(' & ')})),asOf:asOf??new Date().toISOString().slice(0,10)};
}
