export function scoreError(a:string,b:string,games:unknown,bestOf:unknown):string|null {
 if(a===b)return 'Choose two different players.';
 if(![1,3,5,7].includes(bestOf as number))return 'Choose a single game or best of 3, 5, or 7.';
 if(!Array.isArray(games)||games.length<1||games.length>(bestOf as number))return 'Enter a complete match.';
 const needed=Math.floor((bestOf as number)/2)+1,wins=[0,0];
 for(let i=0;i<games.length;i++){
  if(Math.max(...wins)>=needed)return 'Remove games after the match was won.';
  const g=games[i];if(!Array.isArray(g)||g.length!==2||g.some(n=>!Number.isInteger(n)||n<0||n>999))return `Game ${i+1}: use whole-number scores from 0 to 999.`;
  const hi=Math.max(...g),lo=Math.min(...g);if(hi<11||(hi===11?lo>9:hi-lo!==2))return `Game ${i+1}: play to 11 and win by two.`;
  wins[g[0]>g[1]?0:1]++;
 }
 return Math.max(...wins)===needed?null:`Enter all games (${needed} wins needed).`;
}
