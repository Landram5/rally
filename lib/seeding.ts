export type SeedMatch={id:string;a:string;b:string;games:string|[number,number][];status:string;played_on:string;created_at?:string;best_of?:number;club_id?:string;tournament_id?:string|null;tournament_weight?:number;a_initial_rating?:number|null;b_initial_rating?:number|null};
export const ESTABLISHED_MATCHES=5;
export const DEFAULT_INITIAL_RATING=400;
export const MIN_INITIAL_RATING=200;
export const RATING_MODEL_VERSION='usatt-style-v4-single-game';
export const REPEAT_OPPONENT_DAYS=30;
export function repeatOpponentWeight(priorMatches:number){return priorMatches<5?1:priorMatches===5?.5:priorMatches===6?.25:0;}
export const matchFormatWeight=(bestOf?:number)=>bestOf===1?.33:1;
export const REGULAR_K=1,TOURNAMENT_K=2,CROSS_CLUB_K=3;
export const POINT_EXCHANGES=[[12,8,8],[37,7,10],[62,6,13],[87,5,16],[112,4,20],[137,3,25],[162,2,30],[187,2,35],[212,1,40],[237,1,45],[Infinity,0,50]] as const;
export function initialRating(value?:number|null){return typeof value==='number'&&Number.isInteger(value)&&value>=200&&value<=4000?value:DEFAULT_INITIAL_RATING;}
export function ratingEstimates(players:{id:string;initial_rating?:number|null}[]){return Object.fromEntries(players.filter(p=>p.initial_rating!=null).map(p=>[p.id,initialRating(p.initial_rating)]));}
export function pointExchange(winner:number,loser:number){const row=POINT_EXCHANGES.find(r=>Math.round(Math.abs(winner-loser))<=r[0])!;return winner>=loser?row[1]:row[2];}
export function tournamentWeight(participants:string[],memberships:{player_id:string;club_id:string;status:string;role:string}[],approvedClubs:string[]){const people=new Set(participants),clubs=new Set(approvedClubs),eligible=memberships.filter(m=>people.has(m.player_id)&&clubs.has(m.club_id)&&m.club_id!=='unaffiliated'&&m.status==='active'&&m.role!=='guest');return new Set(eligible.map(m=>m.player_id)).size>=2&&new Set(eligible.map(m=>m.club_id)).size>=2?3:2;}
export function compareRatedPlayers(a:{rating:number;played:number;wins:number},b:{rating:number;played:number;wins:number}){return Number(b.played>=ESTABLISHED_MATCHES)-Number(a.played>=ESTABLISHED_MATCHES)||Number(b.played>0)-Number(a.played>0)||b.rating-a.rating||b.played-a.played||b.wins-a.wins;}
function anniversary(date:string,years:number){const d=new Date(date+'T00:00:00Z'),year=d.getUTCFullYear()+years,month=d.getUTCMonth(),day=Math.min(d.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());return new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);}
export function resultWeight(playedOn:string,asOf:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)||!Number.isFinite(Date.parse(playedOn+'T00:00:00Z'))||playedOn>asOf)return 0;return asOf>=anniversary(playedOn,2)?0:asOf>=anniversary(playedOn,1)?.5:1;}
// USATT's best-win/worst-loss adjustment, limited to the available results.
export function performanceEstimate(wins:number[],losses:number[],fallback=DEFAULT_INITIAL_RATING,special=false){
 const w=[...wins].sort((a,b)=>b-a),l=[...losses].sort((a,b)=>a-b),mean=(a:number[])=>Math.round(a.reduce((s,n)=>s+n,0)/a.length);
 if(!w.length)return Math.max(MIN_INITIAL_RATING,Math.min(fallback,l[0]??fallback));
 if(!l.length)return Math.max(MIN_INITIAL_RATING,Math.max(fallback,w[0]));
 if(l[0]>=w[0])return Math.max(MIN_INITIAL_RATING,special?mean(w.slice(0,2)):w[0]);
 const values:number[]=[];
 for(let i=0;i<Math.min(w.length,l.length)&&l[i]<=w[i];i++){
  if(values.length){const current=(values.reduce((s,n)=>s+n,0)+w[i]+l[i])/(values.length+2);if(w[i]>current&&l[i]>current){values.push(w[i]);break;}if(w[i]<current&&l[i]<current){values.push(l[i]);break;}}
  values.push(w[i],l[i]);
 }
 return Math.max(MIN_INITIAL_RATING,values.length?mean(values):mean(w.slice(0,2)));
}
type Contribution={date:string;delta:number;win?:number;opponentId?:string};
export type RatingChange={matchId:string;playerId:string;opponentId:string;date:string;before:number;after:number;opponentRating:number;won:boolean;delta:number;currentContribution:number;ageWeight:number;eventWeight:number;formatWeight:number;pointExchange:number;adjustment:number;repeatWeight:number;pairMatchNumber:number};
type State={base:number;history:Contribution[];anchored:boolean};
function replayRatings(matches:SeedMatch[],asOf:string,includeChanges=false,estimates:Record<string,number>={}){
 const changes:RatingChange[]=[],states=new Map<string,State>(),initial={...estimates};
 for(const m of matches){if(m.a_initial_rating!=null)initial[m.a]=m.a_initial_rating;if(m.b_initial_rating!=null)initial[m.b]=m.b_initial_rating;}
 const get=(id:string)=>{if(!states.has(id))states.set(id,{base:initialRating(initial[id]),history:[],anchored:initial[id]!=null});return states.get(id)!;};
 const ratingAt=(s:State,date:string)=>Math.max(100,s.base+s.history.reduce((sum,r)=>sum+r.delta*resultWeight(r.date,date),0));
 const batches=new Map<string,SeedMatch[]>(),pairDates=new Map<string,number[]>(),repeatFactors=new Map<string,{weight:number;number:number}>();
 for(const m of [...matches].filter(m=>m.status==='confirmed'&&resultWeight(m.played_on,m.played_on)&&m.played_on<=asOf).sort((a,b)=>a.played_on.localeCompare(b.played_on)||(a.created_at??'').localeCompare(b.created_at??'')||a.id.localeCompare(b.id))){const games=typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;if(!games.length||games.filter(g=>g[0]>g[1]).length*2===games.length)continue;const key=m.played_on+'|'+(m.tournament_id?'event:'+m.tournament_id:'club:'+(m.club_id??''));if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(m);}
 // Compute pair frequency in chronological order across event/club boundaries.
 // A match exactly 30 days old is outside the rolling window; both directions share one pair.
 for(const m of [...batches.values()].flat().sort((a,b)=>a.played_on.localeCompare(b.played_on)||(a.created_at??'').localeCompare(b.created_at??'')||a.id.localeCompare(b.id))){const pair=JSON.stringify([m.a,m.b].sort()),day=Date.parse(m.played_on+'T00:00:00Z')/86400000,dates=(pairDates.get(pair)??[]).filter(d=>day-d<REPEAT_OPPONENT_DAYS);repeatFactors.set(m.id,{weight:repeatOpponentWeight(dates.length),number:dates.length+1});dates.push(day);pairDates.set(pair,dates);}
 for(const batch of batches.values()){
  const date=batch[0].played_on,participants=[...new Set(batch.flatMap(m=>[m.a,m.b]))],prior=new Map(participants.map(id=>[id,ratingAt(get(id),date)])),known=new Set(participants.filter(id=>get(id).anchored));
  const results=batch.map(m=>{const games=typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;return {m,winner:games.filter(g=>g[0]>g[1]).length>games.length/2?m.a:m.b};});
  const net=new Map<string,number>(),wins=new Map<string,number[]>(),losses=new Map<string,number[]>(),winEvidence=new Set<string>(),lossEvidence=new Set<string>();
  for(const {m,winner} of results){if(!known.has(m.a)||!known.has(m.b))continue;const loser=winner===m.a?m.b:m.a,wr=prior.get(winner)!,lr=prior.get(loser)!,points=pointExchange(wr,lr)*repeatFactors.get(m.id)!.weight*matchFormatWeight(m.best_of);net.set(winner,(net.get(winner)??0)+points);net.set(loser,(net.get(loser)??0)-points);if(points>0){const wKey=JSON.stringify([winner,loser]),lKey=JSON.stringify([loser,winner]);if(!winEvidence.has(wKey)){wins.set(winner,[...(wins.get(winner)??[]),lr]);winEvidence.add(wKey);}if(!lossEvidence.has(lKey)){losses.set(loser,[...(losses.get(loser)??[]),wr]);lossEvidence.add(lKey);}}}
  const adjustments=new Map<string,number>();
  for(const id of known){const gain=net.get(id)??0,w=wins.get(id)??[],l=losses.get(id)??[],start=prior.get(id)!,big=w.filter(r=>pointExchange(start,r)===50),special=gain>=150||big.length>=3||(big.length>=2&&big.reduce((s,r)=>s+r-start,0)>=700),standard=gain>=60||(gain>=40&&w.filter(r=>pointExchange(start,r)>=20).length>=2);if(w.length<2||(!special&&!standard))continue;const target=special?(l.length?performanceEstimate(w,l,start,true):Math.round(w.slice().sort((a,b)=>b-a).slice(0,2).reduce((s,r)=>s+r,0)/Math.min(2,w.length))):start+gain,delta=Math.max(0,target-start);if(delta){get(id).history.push({date,delta});adjustments.set(id,delta);}}
  for(const id of participants.filter(id=>!known.has(id))){const w:number[]=[],l:number[]=[],seen=new Set<string>();for(const {m,winner} of results){if(m.a!==id&&m.b!==id)continue;const opponent=m.a===id?m.b:m.a;const evidence=JSON.stringify([opponent,winner===id]);if(!known.has(opponent)||repeatFactors.get(m.id)!.weight===0||seen.has(evidence))continue;seen.add(evidence);(winner===id?w:l).push(ratingAt(get(opponent),date));}get(id).base=performanceEstimate(w,l,get(id).base);}
  const eventRatings=new Map(participants.map(id=>[id,ratingAt(get(id),date)]));
  for(const {m,winner} of results){const loser=winner===m.a?m.b:m.a,wr=eventRatings.get(winner)!,lr=eventRatings.get(loser)!,basePoints=pointExchange(wr,lr),weight=m.tournament_id?(m.tournament_weight===3?3:2):1;const repeat=repeatFactors.get(m.id)!;let amount=basePoints*weight;if(lr<200)amount=Math.min(amount,3);amount*=repeat.weight;amount=Math.min(amount,Math.max(0,ratingAt(get(loser),date)-100))*matchFormatWeight(m.best_of);
   const ageWeight=resultWeight(date,asOf);
   for(const id of [m.a,m.b]){const opponent=id===m.a?m.b:m.a,s=get(id),before=ratingAt(s,date),won=id===winner,delta=won?amount:-amount;s.history.push({date,delta,win:won?1:0,opponentId:opponent});if(includeChanges)changes.push({matchId:m.id,playerId:id,opponentId:opponent,date,before,after:ratingAt(s,date),opponentRating:eventRatings.get(opponent)!,won,delta,currentContribution:(delta+(adjustments.get(id)??0))*ageWeight,ageWeight,eventWeight:weight,formatWeight:matchFormatWeight(m.best_of),pointExchange:basePoints,adjustment:adjustments.get(id)??0,repeatWeight:repeat.weight,pairMatchNumber:repeat.number});adjustments.delete(id);s.anchored=true;}
  }
 }
 const ratings=new Map<string,{rating:number;played:number;wins:number;distinctOpponents:number}>();
 for(const [id,s] of states){const active=s.history.filter(r=>r.win!==undefined&&resultWeight(r.date,asOf)>0);ratings.set(id,{rating:ratingAt(s,asOf),played:active.length,wins:active.reduce((sum,r)=>sum+r.win!,0),distinctOpponents:new Set(active.map(r=>r.opponentId)).size});}
 return {ratings,changes,states};
}
export function calculateRatings(matches:SeedMatch[],asOf=new Date().toISOString().slice(0,10),estimates:Record<string,number>={}){return replayRatings(matches,asOf,false,estimates).ratings;}
export function ratingHistory(matches:SeedMatch[],playerId:string,asOf=new Date().toISOString().slice(0,10),estimates:Record<string,number>={}){const result=replayRatings(matches,asOf,true,estimates);return {rating:result.ratings.get(playerId)?.rating??initialRating(estimates[playerId]),initialRating:result.states.get(playerId)?.base??initialRating(estimates[playerId]),played:result.ratings.get(playerId)?.played??0,distinctOpponents:result.ratings.get(playerId)?.distinctOpponents??0,changes:result.changes.filter(c=>c.playerId===playerId).reverse(),asOf};}
export function suggestSeeds(entrants:string[],matches:SeedMatch[],asOf?:string,estimates:Record<string,number>={}){const ratings=calculateRatings(matches,asOf,estimates),get=(id:string)=>ratings.get(id)??{rating:initialRating(estimates[id]),played:0,wins:0};return entrants.map((id,index)=>({id,index,...get(id)})).sort((a,b)=>compareRatedPlayers(a,b)||a.index-b.index).map(s=>({id:s.id,rating:Math.round(s.rating),played:s.played,wins:s.wins}));}
