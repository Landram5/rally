export type SeedMatch={id:string;a:string;b:string;games:string|[number,number][];status:string;played_on:string;created_at?:string;tournament_id?:string|null;tournament_weight?:number};
export const ESTABLISHED_MATCHES=5;
export const REGULAR_K=32;
export const TOURNAMENT_K=64;
export const CROSS_CLUB_K=96;
export function tournamentWeight(participants:string[],memberships:{player_id:string;club_id:string;status:string;role:string}[],approvedClubs:string[]){const people=new Set(participants),clubs=new Set(approvedClubs),eligible=memberships.filter(m=>people.has(m.player_id)&&clubs.has(m.club_id)&&m.status==='active'&&m.role!=='guest');return new Set(eligible.map(m=>m.player_id)).size>=2&&new Set(eligible.map(m=>m.club_id)).size>=2?3:2;}
export function compareRatedPlayers(a:{rating:number;played:number;wins:number},b:{rating:number;played:number;wins:number}){return Number(b.played>=ESTABLISHED_MATCHES)-Number(a.played>=ESTABLISHED_MATCHES)||Number(b.played>0)-Number(a.played>0)||b.rating-a.rating||b.played-a.played||b.wins-a.wins;}
// Calendar anniversaries, clamped for leap days; date-only comparisons use UTC.
function anniversary(date:string,years:number){const d=new Date(date+'T00:00:00Z'),year=d.getUTCFullYear()+years,month=d.getUTCMonth(),day=Math.min(d.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());return new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);}
export function resultWeight(playedOn:string,asOf:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)||!Number.isFinite(Date.parse(playedOn+'T00:00:00Z'))||playedOn>asOf)return 0;return asOf>=anniversary(playedOn,2)?0:asOf>=anniversary(playedOn,1)?.5:1;}
type Contribution={date:string;delta:number;win:number};
export type RatingChange={matchId:string;playerId:string;opponentId:string;date:string;before:number;after:number;opponentRating:number;expected:number;won:boolean;delta:number;currentContribution:number;ageWeight:number;eventWeight:number};
function replayRatings(matches:SeedMatch[],asOf:string,includeChanges=false){
 const changes:RatingChange[]=[];
 const evidence=new Map<string,Contribution[]>(),get=(id:string)=>{if(!evidence.has(id))evidence.set(id,[]);return evidence.get(id)!};
 const ratingAt=(history:Contribution[],date:string)=>1000+history.reduce((sum,r)=>sum+r.delta*resultWeight(r.date,date),0);
 for(const m of [...matches].filter(m=>m.status==='confirmed'&&m.played_on<=asOf).sort((a,b)=>a.played_on.localeCompare(b.played_on)||(a.created_at??'').localeCompare(b.created_at??'')||a.id.localeCompare(b.id))){
  if(!resultWeight(m.played_on,m.played_on))continue;
  const games=typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;
  if(!games.length)continue;
  const aw=games.filter(g=>g[0]>g[1]).length,bw=games.length-aw;if(aw===bw)continue;
  const a=get(m.a),b=get(m.b),aRating=ratingAt(a,m.played_on),bRating=ratingAt(b,m.played_on),win=aw>bw?1:0,expected=1/(1+10**((bRating-aRating)/400)),delta=(m.tournament_id?(m.tournament_weight===3?CROSS_CLUB_K:TOURNAMENT_K):REGULAR_K)*(win-expected);
  const ageWeight=resultWeight(m.played_on,asOf),eventWeight=m.tournament_id?(m.tournament_weight===3?3:2):1;
  if(includeChanges)changes.push({matchId:m.id,playerId:m.a,opponentId:m.b,date:m.played_on,before:aRating,after:aRating+delta,opponentRating:bRating,expected,won:!!win,delta,currentContribution:delta*ageWeight,ageWeight,eventWeight},{matchId:m.id,playerId:m.b,opponentId:m.a,date:m.played_on,before:bRating,after:bRating-delta,opponentRating:aRating,expected:1-expected,won:!win,delta:-delta,currentContribution:-delta*ageWeight,ageWeight,eventWeight});
  a.push({date:m.played_on,delta,win});b.push({date:m.played_on,delta:-delta,win:1-win});
 }
 const ratings=new Map<string,{rating:number;played:number;wins:number}>();
 for(const [id,history] of evidence){const active=history.filter(r=>resultWeight(r.date,asOf)>0);ratings.set(id,{rating:ratingAt(history,asOf),played:active.length,wins:active.reduce((sum,r)=>sum+r.win,0)});}
 return {ratings,changes};
}
export function calculateRatings(matches:SeedMatch[],asOf=new Date().toISOString().slice(0,10)){return replayRatings(matches,asOf).ratings;}
export function ratingHistory(matches:SeedMatch[],playerId:string,asOf=new Date().toISOString().slice(0,10)){const result=replayRatings(matches,asOf,true);return {rating:result.ratings.get(playerId)?.rating??1000,played:result.ratings.get(playerId)?.played??0,changes:result.changes.filter(c=>c.playerId===playerId).reverse(),asOf};}
export function suggestSeeds(entrants:string[],matches:SeedMatch[],asOf?:string){
 const ratings=calculateRatings(matches,asOf),get=(id:string)=>ratings.get(id)??{rating:1000,played:0,wins:0};
 const stats=entrants.map((id,index)=>({id,index,...get(id)}));
 stats.sort((a,b)=>compareRatedPlayers(a,b)||a.index-b.index);
 return stats.map(s=>({id:s.id,rating:Math.round(s.rating),played:s.played,wins:s.wins}));
}
