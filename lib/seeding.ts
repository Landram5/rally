export type SeedMatch={id:string;a:string;b:string;games:string|[number,number][];status:string;played_on:string;created_at?:string};
export function suggestSeeds(entrants:string[],matches:SeedMatch[]){
 const ratings=new Map<string,{rating:number;played:number;wins:number}>();
 const get=(id:string)=>{if(!ratings.has(id))ratings.set(id,{rating:1000,played:0,wins:0});return ratings.get(id)!};
 for(const m of [...matches].filter(m=>m.status==='confirmed').sort((a,b)=>a.played_on.localeCompare(b.played_on)||(a.created_at??'').localeCompare(b.created_at??'')||a.id.localeCompare(b.id))){
  const games=typeof m.games==='string'?JSON.parse(m.games) as [number,number][]:m.games;
  if(!games.length)continue;
  const aw=games.filter(g=>g[0]>g[1]).length,bw=games.length-aw;if(aw===bw)continue;
  const a=get(m.a),b=get(m.b),win=aw>bw?1:0,expected=1/(1+10**((b.rating-a.rating)/400)),delta=32*(win-expected);
  a.rating+=delta;b.rating-=delta;a.played++;b.played++;a.wins+=win;b.wins+=1-win;
 }
 const stats=entrants.map((id,index)=>({id,index,...get(id)}));
 stats.sort((a,b)=>Number(b.played>0)-Number(a.played>0)||b.rating-a.rating||b.wins-a.wins||a.index-b.index);
 return stats.map(({index,...s})=>({...s,rating:Math.round(s.rating)}));
}
