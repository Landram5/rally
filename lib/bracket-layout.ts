import type {Draw} from './tournament-engine';
export function doubleBracketLayout(draw:Draw){
 const card=260,gap=64,row=236,header=72;
 const winners=draw.fixtures.filter(f=>f.bracket==='winners'),losers=draw.fixtures.filter(f=>f.bracket==='losers');
 const rounds=Math.max(1,...winners.map(f=>f.bracketRound??1)),winnerRows=Math.max(1,winners.filter(f=>f.bracketRound===1).length),loserRows=Math.max(1,losers.filter(f=>f.bracketRound===1).length);
 const winnerHeight=winnerRows*row,loserTop=header+winnerHeight+96,loserHeight=loserRows*row,finalColumn=Math.max(1,2*rounds-1);
 const nodes=draw.fixtures.map(f=>{const r=f.bracketRound??1;if(f.bracket==='winners')return {id:f.id,x:2*(r-1)*(card+gap),y:header+(f.slot+.5)*2**(r-1)*row-99};if(f.bracket==='losers'){const count=losers.filter(p=>p.bracketRound===r).length;return {id:f.id,x:(r-1)*(card+gap),y:loserTop+(f.slot+.5)*loserHeight/Math.max(1,count)-99};}return {id:f.id,x:(finalColumn+r-1)*(card+gap),y:(header+winnerHeight/2+loserTop+loserHeight/2)/2-99};});
 return {nodes,width:(finalColumn+2)*(card+gap),height:loserTop+loserHeight+24,loserTop,winnerHeight};
}
