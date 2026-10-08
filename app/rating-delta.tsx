export type RatingChanges=Record<string,Record<string,number>>;
export const formatDelta=(n:number)=>n===0?'±0.0':`${n>0?'+':'−'}${Math.abs(n).toFixed(1)}`;
export function RatingDelta({value}:{value?:number}){return value===undefined?null:<span className={`rating-delta ${value>0?'up':value<0?'down':''}`} title="Rally rating change from this result">{formatDelta(value)}</span>;}
export function MatchRatingDeltas({a,b,aName,bName,changes}:{a:string;b:string;aName:string;bName:string;changes?:Record<string,number>}){
 if(!changes||(changes[a]===undefined&&changes[b]===undefined))return null;
 return <small className="match-rating-change" aria-label="Rally rating change">{[[a,aName],[b,bName]].map(([id,name])=>changes[id]===undefined?null:<span key={id}>{name.split(' ')[0]} <RatingDelta value={changes[id]}/></span>)}</small>;
}
