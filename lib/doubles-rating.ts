import {ESTABLISHED_MATCHES,initialRating,matchFormatWeight,pointExchange,repeatOpponentWeight,REPEAT_OPPONENT_DAYS,resultWeight} from './seeding';
// Doubles rating, "doubles-v1". It is separate from the singles rating and never changes it.
// Each player has their own doubles rating. A side's strength is the average of its two players, the same point-exchange
// table as singles decides how many points the result is worth, and every player on a side receives that side's change.
export const DOUBLES_MODEL_VERSION='doubles-v1';
// Doubles gives each player less individual evidence than singles, so results move the rating at half the singles scale.
export const DOUBLES_FACTOR=0.5;
export type DoublesMatch={id:string;a1:string;a2:string;b1:string;b2:string;games:string|[number,number][];status:string;played_on:string;best_of?:number;tournament_id?:string|null;tournament_weight?:number;club_id?:string;created_at?:string};
export type DoublesChange={matchId:string;playerId:string;partnerId:string;opponents:[string,string];date:string;before:number;after:number;won:boolean;delta:number;teamRating:number;opponentRating:number};
const parse=(g:DoublesMatch['games'])=>typeof g==='string'?JSON.parse(g) as [number,number][]:g;
const floor=100;
// `starts` lets a player begin from a known estimate (for example their current singles rating) instead of the default.
export function replayDoubles(matches:DoublesMatch[],asOf=new Date().toISOString().slice(0,10),starts:Record<string,number>={}){
 const rating=new Map<string,{value:number;played:number;wins:number;partners:Set<string>}>(),changes:DoublesChange[]=[],pairDates=new Map<string,number[]>();
 const get=(id:string)=>{if(!rating.has(id))rating.set(id,{value:initialRating(starts[id]),played:0,wins:0,partners:new Set()});return rating.get(id)!;};
 const ordered=matches.filter(m=>m.status==='confirmed'&&resultWeight(m.played_on,m.played_on)&&m.played_on<=asOf).sort((x,y)=>x.played_on.localeCompare(y.played_on)||(x.created_at??'').localeCompare(y.created_at??'')||x.id.localeCompare(y.id));
 for(const m of ordered){
  const games=parse(m.games);if(!games.length)continue;const aWins=games.filter(g=>g[0]>g[1]).length,bWins=games.length-aWins;if(aWins===bWins)continue;
  const sideA:[string,string]=[m.a1,m.a2],sideB:[string,string]=[m.b1,m.b2],teamA=(get(m.a1).value+get(m.a2).value)/2,teamB=(get(m.b1).value+get(m.b2).value)/2,aWon=aWins>bWins;
  const winner=aWon?sideA:sideB,loser=aWon?sideB:sideA,wr=aWon?teamA:teamB,lr=aWon?teamB:teamA;
  // The same two partnerships meeting again within 30 days count less, exactly like repeated singles opponents.
  const pair=JSON.stringify([[...sideA].sort(),[...sideB].sort()].sort()),day=Date.parse(m.played_on+'T00:00:00Z')/86400000,recent=(pairDates.get(pair)??[]).filter(d=>day-d<REPEAT_OPPONENT_DAYS);recent.push(day);pairDates.set(pair,recent);
  const weight=m.tournament_id?(m.tournament_weight===3?3:2):1;
  let amount=pointExchange(wr,lr)*weight*repeatOpponentWeight(recent.length-1)*matchFormatWeight(m.best_of)*DOUBLES_FACTOR;
  // Nobody can fall below the rating floor.
  amount=Math.min(amount,Math.max(0,Math.min(...loser.map(id=>get(id).value))-floor));
  for(const id of [...sideA,...sideB]){
   const s=get(id),won=winner.includes(id),delta=won?amount:-amount,before=s.value,partner=(sideA.includes(id)?sideA:sideB).find(p=>p!==id)!,opponents=(sideA.includes(id)?sideB:sideA) as [string,string];
   s.value=Math.max(floor,s.value+delta);s.played++;if(won)s.wins++;s.partners.add(partner);
   changes.push({matchId:m.id,playerId:id,partnerId:partner,opponents,date:m.played_on,before,after:s.value,won,delta:s.value-before,teamRating:sideA.includes(id)?teamA:teamB,opponentRating:sideA.includes(id)?teamB:teamA});
  }
 }
 const ratings=new Map([...rating].map(([id,s])=>[id,{rating:s.value,played:s.played,wins:s.wins,distinctPartners:s.partners.size,established:s.played>=ESTABLISHED_MATCHES}]));
 return {ratings,changes};
}
