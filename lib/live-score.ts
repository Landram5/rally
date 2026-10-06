export type ScoreSnapshot={points:[number,number];games:[number,number][];complete:boolean};
export type LiveScore=ScoreSnapshot&{history:ScoreSnapshot[]};
export function newLiveScore():LiveScore{return {points:[0,0],games:[],complete:false,history:[]};}
export function gameWins(games:[number,number][]):[number,number]{return games.reduce<[number,number]>((wins,g)=>{wins[g[0]>g[1]?0:1]++;return wins;},[0,0]);}
export function addLivePoint(state:LiveScore,side:0|1,bestOf:number):LiveScore{
 if(![3,5,7].includes(bestOf))throw new Error('Choose best of 3, 5, or 7.');if(state.complete)return state;
 if(state.points[side]>=999)throw new Error('The maximum supported score is 999.');
 const points:[number,number]=[...state.points];points[side]++;
 const history=[...state.history,{points:state.points,games:state.games,complete:state.complete}];
 if(Math.max(...points)>=11&&Math.abs(points[0]-points[1])>=2){
  const games=[...state.games,points],complete=Math.max(...gameWins(games))>=Math.floor(bestOf/2)+1;
  return {points:complete?points:[0,0],games,complete,history};
 }
 return {...state,points,history};
}
export function undoLivePoint(state:LiveScore):LiveScore{const previous=state.history.at(-1);return previous?{...previous,history:state.history.slice(0,-1)}:state;}
