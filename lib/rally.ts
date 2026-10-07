export type Player = {id:string;name:string;club:string;color:string};
export type Match = {id:string;a:string;b:string;games:[number,number][];date:string;club:string;status:'confirmed'|'pending';kind:'Club play'|'Tournament'};
export type Tournament = {id:string;name:string;club:string;date:string;location:string;format:'Round robin'|'Single elimination'|'Double elimination';capacity:number;entrants:string[];status:'Registration open'|'Upcoming'|'Completed'};
export const clubs=[{id:'harbor',name:'Harbor Table Tennis',location:'Baltimore, MD',initials:'HT',color:'#d9ed64'},{id:'metro',name:'Metro Table Tennis',location:'Columbia, MD',initials:'MT',color:'#bdd7ff'}];
export const players:Player[]=[{id:'alex',name:'Alex Morgan',club:'harbor',color:'#e9dcbc'},{id:'jordan',name:'Jordan Lee',club:'harbor',color:'#cedcf2'},{id:'sam',name:'Sam Rivera',club:'harbor',color:'#d5e6d5'},{id:'riley',name:'Riley Chen',club:'harbor',color:'#e7d9ed'},{id:'casey',name:'Casey Brooks',club:'metro',color:'#f0d9ce'},{id:'taylor',name:'Taylor Park',club:'metro',color:'#cce6e6'},{id:'morgan',name:'Morgan Ellis',club:'metro',color:'#e2dfba'},{id:'jamie',name:'Jamie Patel',club:'metro',color:'#dbd9f2'}];
export const name=(id:string)=>players.find(p=>p.id===id)?.name??id;
export const clubName=(id:string)=>clubs.find(c=>c.id===id)?.name??id;
export function tally(games:[number,number][]) {return games.reduce((s,g)=>{s[g[0]>g[1]?0:1]++;return s},[0,0]);}
export function validateMatch(a:string,b:string,games:[number,number][],bestOf=3):string|null {
 if(a===b)return 'Choose two different players.';
 if(!players.some(p=>p.id===a)||!players.some(p=>p.id===b))return 'Choose valid players.';
 if(![3,5,7].includes(bestOf))return 'Choose a valid match format.';
 const needed=Math.floor(bestOf/2)+1;const wins=[0,0];
 for(let i=0;i<games.length;i++){
  if(wins.some(w=>w>=needed))return 'Remove games played after the match was already won.';
  const [x,y]=games[i];const hi=Math.max(x,y),lo=Math.min(x,y);
  if(!Number.isInteger(x)||!Number.isInteger(y)||lo<0||hi<11||(hi===11?lo>9:hi-lo!==2))return `Game ${i+1}: play to 11, win by two (for example 11–9 or 13–11).`;
  wins[x>y?0:1]++;
 }
 if(Math.max(...wins)!==needed)return `Enter all games for a best-of-${bestOf} match (${needed} game wins).`;
 return null;
}
export function stats(id:string,matches:Match[]){
 const ms=matches.filter(m=>m.status==='confirmed'&&(m.a===id||m.b===id));let wins=0,gamesWon=0,gamesLost=0,pointsWon=0,pointsLost=0;
 const form=ms.map(m=>{const side=m.a===id?0:1;const s=tally(m.games);const won=s[side]>s[1-side];if(won)wins++;gamesWon+=s[side];gamesLost+=s[1-side];m.games.forEach(g=>{pointsWon+=g[side];pointsLost+=g[1-side]});return won?'W':'L'});
 return {played:ms.length,wins,losses:ms.length-wins,winRate:ms.length?Math.round(wins/ms.length*100):0,gamesWon,gamesLost,pointsWon,pointsLost,form:form.slice(0,5)};
}
export function pairs(entrants:string[],format:string):[string,string|null][] {
 if(format==='Round robin')return entrants.flatMap((a,i)=>entrants.slice(i+1).map(b=>[a,b] as [string,string]));
 if(entrants.length<2)return [];
 const size=2**Math.ceil(Math.log2(entrants.length));const padded:(string|null)[]=[...entrants,...Array(size-entrants.length).fill(null)];
 return Array.from({length:size/2},(_,i)=>[padded[i]!,padded[size-1-i]]);
}
const scorePool:[number,number][][]=[[[11,6],[11,9]],[[8,11],[11,7],[9,11]],[[11,9],[7,11],[12,10]],[[11,4],[11,8]],[[7,11],[9,11]],[[11,8],[9,11],[11,6]],[[12,10],[11,7]],[[11,13],[11,6],[7,11]],[[11,5],[11,3]],[[9,11],[11,9],[8,11]],[[13,11],[8,11],[11,9]],[[5,11],[8,11]]];
export const initialMatches:Match[]=Array.from({length:28},(_,i)=>{
 const a=players[i%8].id,b=players[(i%8+1+Math.floor(i/8))%8].id;
 const games=scorePool[(i*5+2)%scorePool.length];
 return {id:`m${i}`,a,b,games,date:`2026-09-${String(28-Math.floor(i/3)).padStart(2,'0')}`,club:players[i%8].club,status:'confirmed',kind:'Club play'};
});
export const initialTournaments:Tournament[]=[{id:'fall-open',name:'Fall Open',club:'harbor',date:'2026-10-10',location:'Baltimore, MD',format:'Single elimination',capacity:16,entrants:players.slice(0,6).map(p=>p.id),status:'Registration open'},{id:'friday-round-robin',name:'Friday Round Robin',club:'metro',date:'2026-10-02',location:'Columbia, MD',format:'Round robin',capacity:8,entrants:players.slice(2).map(p=>p.id),status:'Registration open'},{id:'club-championship',name:'Club Championship',club:'harbor',date:'2026-10-24',location:'Baltimore, MD',format:'Single elimination',capacity:16,entrants:players.slice(0,4).map(p=>p.id),status:'Upcoming'}];
