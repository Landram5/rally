import type {RatingChange} from './seeding';
// Display only: derived from rating changes the unchanged model already produced.
export const UPSET_GAP=100;
export const isUpset=(c:Pick<RatingChange,'won'|'opponentRating'|'before'>)=>c.won&&c.opponentRating-c.before>=UPSET_GAP;
export type PlayerHighlights={bestRating:{value:number;date:string}|null;longestWinStreak:number;currentWinStreak:number;biggestUpset:{opponentId:string;opponentName?:string;gap:number;date:string;matchId:string}|null;ratedMatches:number};
export function playerHighlights(newestFirst:RatingChange[]):PlayerHighlights{
 let best:{value:number;date:string}|null=null,run=0,longest=0,upset:PlayerHighlights['biggestUpset']=null;
 for(const c of [...newestFirst].reverse()){
  if(!best||c.after>best.value)best={value:c.after,date:c.date};
  if(c.won){run++;longest=Math.max(longest,run);}else run=0;
  const gap=c.opponentRating-c.before;if(isUpset(c)&&(!upset||gap>upset.gap))upset={opponentId:c.opponentId,gap:Math.round(gap),date:c.date,matchId:c.matchId};
 }
 return {bestRating:best?{value:Math.round(best.value),date:best.date}:null,longestWinStreak:longest,currentWinStreak:run,biggestUpset:upset,ratedMatches:newestFirst.length};
}
