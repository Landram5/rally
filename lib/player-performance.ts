import {ratingHistory,type SeedMatch} from './seeding';
export function playerPerformance(matches:SeedMatch[],playerId:string,asOf=new Date().toISOString().slice(0,10)){
 const history=ratingHistory(matches,playerId,asOf);let wins=0;
 const points=[...history.changes].reverse().map((c,index)=>{if(c.won)wins++;return {id:c.matchId,date:c.date,matches:index+1,wins,winRate:wins/(index+1)*100,elo:c.after};});
 return {points,rating:history.rating,asOf,played:points.length,wins,losses:points.length-wins};
}
