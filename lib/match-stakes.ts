import {calculateRatings,initialRating,ratingChangesByMatch,ESTABLISHED_MATCHES,type SeedMatch} from './seeding';
// Display only: replays confirmed history with one hypothetical result per outcome using the unchanged model.
export type MatchStakes={ratings:{a:number;b:number};rated:{a:number;b:number};established:{a:boolean;b:boolean};aWins:{a:number;b:number};bWins:{a:number;b:number};weight:string};
export type StakesInput={bestOf:number;clubId:string;playedOn:string};
export const STAKES_FORMATS=[1,3,5,7];
export function matchStakes(matches:SeedMatch[],a:string,b:string,input:StakesInput,estimates:Record<string,number>={},today=new Date().toISOString().slice(0,10)):MatchStakes|null{
 if(!a||!b||a===b||!STAKES_FORMATS.includes(input.bestOf)||!/^\d{4}-\d{2}-\d{2}$/.test(input.playedOn))return null;
 const asOf=input.playedOn>today?input.playedOn:today,history=matches.filter(m=>m.status==='confirmed'),needed=Math.floor(input.bestOf/2)+1;
 const hypothetical=(winner:string,id:string):SeedMatch=>({id,a,b,games:Array.from({length:needed},()=>(winner===a?[11,7]:[7,11]) as [number,number]),status:'confirmed',played_on:input.playedOn,created_at:new Date().toISOString(),best_of:input.bestOf,club_id:input.clubId,tournament_id:null});
 const outcome=(winner:string)=>{const id='__stakes__',changes=ratingChangesByMatch([...history,hypothetical(winner,id)],asOf,estimates)[id]??{};return {a:changes[a]??0,b:changes[b]??0};};
 const current=calculateRatings(history,asOf,estimates),ca=current.get(a),cb=current.get(b);
 return {ratings:{a:Math.round(ca?.rating??initialRating(estimates[a])),b:Math.round(cb?.rating??initialRating(estimates[b]))},rated:{a:ca?.played??0,b:cb?.played??0},established:{a:(ca?.played??0)>=ESTABLISHED_MATCHES,b:(cb?.played??0)>=ESTABLISHED_MATCHES},aWins:outcome(a),bWins:outcome(b),weight:input.bestOf===1?'Single game \u00b7 33% rating weight':'Regular match \u00b7 full rating weight'};
}
