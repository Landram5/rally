// Normalized so games[i][0] is player A's points and games[i][1] is player B's.
export type H2HMeeting={id:string;playedOn:string;games:[number,number][];clubName:string;tournamentId:string|null};
export function headToHeadSummary(meetings:H2HMeeting[]){
 const sorted=[...meetings].sort((x,y)=>y.playedOn.localeCompare(x.playedOn)||y.id.localeCompare(x.id));
 let aWins=0,bWins=0,aGames=0,bGames=0,aPoints=0,bPoints=0,gameCount=0;
 const winner=(m:H2HMeeting)=>{const a=m.games.filter(g=>g[0]>g[1]).length,b=m.games.length-a;return a>b?'a':'b'};
 for(const m of sorted){const a=m.games.filter(g=>g[0]>g[1]).length,b=m.games.length-a;aGames+=a;bGames+=b;if(a>b)aWins++;else bWins++;for(const g of m.games){aPoints+=g[0];bPoints+=g[1];gameCount++;}}
 let streak=0;const streakWinner=sorted.length?winner(sorted[0]):null;for(const m of sorted){if(winner(m)!==streakWinner)break;streak++;}
 return {played:sorted.length,aWins,bWins,aGames,bGames,aPoints,bPoints,marginPerGame:gameCount?Math.round((aPoints-bPoints)/gameCount*10)/10:0,last:sorted[0]??null,lastWinner:sorted.length?winner(sorted[0]):null,streak:{holder:streakWinner as 'a'|'b'|null,length:streak},meetings:sorted};
}
