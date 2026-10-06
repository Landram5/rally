import {stats,tally,type Match} from './rally';
import {calculateRatings,type SeedMatch} from './seeding';
type OpponentRecord=Pick<ReturnType<typeof stats>,'played'|'wins'|'losses'|'gamesWon'>;
export type ClubhouseSummary={stats:Record<string,ReturnType<typeof stats>>;ratings:Record<string,{rating:number;played:number;wins:number;distinctOpponents:number}>;opponents:Record<string,Record<string,OpponentRecord>>;confirmed:number;games:number;recorded:number};
export function clubhouseSummaries(matches:(SeedMatch&{club_id:string})[],clubIds:string[]):Record<string,ClubhouseSummary>{
 const result:Record<string,ClubhouseSummary>=Object.create(null);
 for(const scope of ['all',...clubIds]){const source=scope==='all'?matches:matches.filter(m=>m.club_id===scope),converted:Match[]=source.filter(m=>m.status==='confirmed').map(m=>({id:m.id,a:m.a,b:m.b,games:typeof m.games==='string'?JSON.parse(m.games):m.games,date:m.played_on,club:m.club_id,status:'confirmed',kind:m.tournament_id?'Tournament':'Club play'}));const records:ClubhouseSummary['stats']=Object.create(null),opponents:ClubhouseSummary['opponents']=Object.create(null);
  for(const m of converted){const score=tally(m.games),points=m.games.reduce((sum,g)=>[sum[0]+g[0],sum[1]+g[1]],[0,0]);for(const [side,id] of [m.a,m.b].entries()){const other=side===0?m.b:m.a,won=score[side]>score[1-side],s=records[id]??(records[id]=stats(id,[]));s.played++;s.wins+=Number(won);s.losses+=Number(!won);s.gamesWon+=score[side];s.gamesLost+=score[1-side];s.pointsWon+=points[side];s.pointsLost+=points[1-side];if(s.form.length<5)s.form.push(won?'W':'L');opponents[id]??=Object.create(null);const h=opponents[id][other]??(opponents[id][other]={played:0,wins:0,losses:0,gamesWon:0});h.played++;h.wins+=Number(won);h.losses+=Number(!won);h.gamesWon+=score[side];}}
  for(const s of Object.values(records))s.winRate=Math.round(s.wins/s.played*100);
  result[scope]={stats:Object.fromEntries(Object.entries(records)),ratings:Object.fromEntries(calculateRatings(source)),opponents:Object.fromEntries(Object.entries(opponents).map(([id,record])=>[id,Object.fromEntries(Object.entries(record))])),confirmed:converted.length,games:converted.reduce((sum,m)=>sum+m.games.length,0),recorded:source.length};
 }
 // Server Components can pass plain objects to client components, but not
 // null-prototype dictionaries. Keep safe dictionaries internal to aggregation.
 return Object.fromEntries(Object.entries(result));
}
