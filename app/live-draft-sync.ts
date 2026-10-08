import type {LiveMatchDraft} from '@/lib/live-draft';
// Cross-device live-score drafts and an offline outbox for finished results. Everything here is best-effort:
// the on-device draft remains the source of truth while scoring, and every failure falls back to it.

export async function fetchRemoteDraft():Promise<LiveMatchDraft|null>{
 try{const r=await fetch('/api/live-draft',{cache:'no-store'});if(!r.ok)return null;return (await r.json() as {draft:LiveMatchDraft|null}).draft??null;}catch{return null}
}
let timer:ReturnType<typeof setTimeout>|undefined,pending:LiveMatchDraft|null=null;
function send(){
 const draft=pending;pending=null;if(!draft)return;
 void fetch('/api/live-draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft),keepalive:true}).catch(()=>{});
}
// Points arrive quickly, so only the latest state is sent, at most every two seconds.
export function pushRemoteDraft(draft:LiveMatchDraft){pending=draft;if(timer)clearTimeout(timer);timer=setTimeout(send,2000);}
export function flushRemoteDraft(){if(timer)clearTimeout(timer);timer=undefined;send();}
export function dropRemoteDraft(id:string){
 pending=null;if(timer)clearTimeout(timer);timer=undefined;
 void fetch('/api/live-draft',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true}).catch(()=>{});
}
export const isNewer=(a:{updatedAt:string},b:{updatedAt:string})=>Date.parse(a.updatedAt)>Date.parse(b.updatedAt);

// Offline outbox: a finished match that could not reach the server waits here and is sent when the connection returns.
// Each payload carries its own id, so a retry can never record the match twice.
export type QueuedMatch={payload:Record<string,unknown>;queuedAt:string};
const outboxKey=(owner:string)=>`rally-match-outbox-v1:${owner}`;
export function readOutbox(owner:string):QueuedMatch[]{
 try{const parsed=JSON.parse(localStorage.getItem(outboxKey(owner))??'[]') as QueuedMatch[];return Array.isArray(parsed)?parsed.filter(i=>i&&typeof i.payload?.id==='string'&&i.payload.action==='record_match').slice(0,10):[];}catch{return []}
}
export function queueMatch(owner:string,payload:Record<string,unknown>){
 const items=readOutbox(owner).filter(i=>i.payload.id!==payload.id);items.push({payload,queuedAt:new Date().toISOString()});
 localStorage.setItem(outboxKey(owner),JSON.stringify(items.slice(-10)));
}
export function removeQueued(owner:string,id:string){
 try{localStorage.setItem(outboxKey(owner),JSON.stringify(readOutbox(owner).filter(i=>i.payload.id!==id)));}catch{/* nothing to remove */}
}
