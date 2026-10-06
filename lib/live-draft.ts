import {gameWins,type LiveScore,type ScoreSnapshot} from './live-score';
export type LiveMatchDraft={version:1;owner:string;id:string;clubId:string;a:string;b:string;bestOf:number;date:string;updatedAt:string;state:LiveScore;swapped:boolean};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
export const draftKey=(owner:string,demo=false)=>`rally-live-draft-v1:${demo?'demo':'account'}:${owner}`;
function snapshot(value:unknown,bestOf:number):value is ScoreSnapshot{
 if(!value||typeof value!=='object')return false;const s=value as ScoreSnapshot;
 const pair=(v:unknown):v is [number,number]=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=999);
 if(!pair(s.points)||!Array.isArray(s.games)||s.games.length>bestOf||typeof s.complete!=='boolean')return false;
 if(!s.games.every(g=>pair(g)&&Math.max(...g)>=11&&Math.abs(g[0]-g[1])>=2&&(Math.max(...g)===11||Math.abs(g[0]-g[1])===2)))return false;
 const wins=gameWins(s.games),target=Math.floor(bestOf/2)+1;
 if(Math.max(...wins)>target||s.complete!==(Math.max(...wins)===target))return false;
 if(s.complete)return JSON.stringify(s.points)===JSON.stringify(s.games.at(-1));
 return Math.max(...s.points)<11||Math.abs(s.points[0]-s.points[1])<2;
}
export function parseLiveDraft(raw:string|null,owner:string):LiveMatchDraft|null{
 if(!raw||raw.length>2_000_000)return null;
 try{const d=JSON.parse(raw) as LiveMatchDraft;
  if(d.version!==1||d.owner!==owner||!['id','clubId','a','b'].every(k=>typeof d[k as keyof LiveMatchDraft]==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(d[k as keyof LiveMatchDraft] as string))||d.a===d.b||![3,5,7].includes(d.bestOf)||typeof d.swapped!=='boolean')return null;
  if(typeof d.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt)))return null;
  if(!snapshot(d.state,d.bestOf)||!Array.isArray(d.state.history)||d.state.history.length>14000||!d.state.history.every(s=>snapshot(s,d.bestOf)))return null;
  return d;
 }catch{return null}
}
export function loadLiveDraft(storage:Storage,owner:string,demo=false){return parseLiveDraft(storage.getItem(draftKey(owner,demo)),owner)}
export function storeLiveDraft(storage:Storage,draft:LiveMatchDraft,demo=false){storage.setItem(draftKey(draft.owner,demo),JSON.stringify(draft))}
export function clearLiveDraft(storage:Storage,owner:string,id:string,demo=false){
 // A late save response must not remove a different, newer match draft.
 const draft=loadLiveDraft(storage,owner,demo);if(draft?.id===id)storage.removeItem(draftKey(owner,demo));
}
