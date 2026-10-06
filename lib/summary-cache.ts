import {clubhouseSummaries,type ClubhouseSummary} from './clubhouse-summary';
import {RATING_MODEL_VERSION,type SeedMatch} from './seeding';
export async function summaryVersion(db:D1Database){return (await db.prepare('SELECT version FROM summary_epoch WHERE id=1').first<{version:number}>())?.version??0;}
export async function cachedSummaries(db:D1Database,matches:(SeedMatch&{club_id:string})[],clubs:string[],version:number,audience:string){
 const day=new Date().toISOString().slice(0,10),key=JSON.stringify([RATING_MODEL_VERSION,audience,[...clubs].sort()]);
 const cached=await db.prepare('SELECT summary_json FROM clubhouse_summary_cache c WHERE scope_key=? AND c.version=? AND as_of=? AND c.version=(SELECT version FROM summary_epoch WHERE id=1)').bind(key,version,day).first<{summary_json:string}>();
 if(cached){try{return JSON.parse(cached.summary_json) as Record<string,ClubhouseSummary>;}catch{/* Recompute invalid stored data. */}}
 const summaries=clubhouseSummaries(matches,clubs);
 // A write during the underlying read cannot store a stale result under a new epoch.
 // The cache holds aggregates only; permission checks precede every lookup.
 try{await db.batch([db.prepare('DELETE FROM clubhouse_summary_cache WHERE as_of!=? OR version!=?').bind(day,version),db.prepare('INSERT INTO clubhouse_summary_cache(scope_key,version,as_of,summary_json,created_at) SELECT ?,?,?,?,? WHERE (SELECT version FROM summary_epoch WHERE id=1)=? ON CONFLICT(scope_key) DO UPDATE SET version=excluded.version,as_of=excluded.as_of,summary_json=excluded.summary_json,created_at=excluded.created_at').bind(key,version,day,JSON.stringify(summaries),new Date().toISOString(),version)]);}catch{console.error('Standings cache write unavailable');}
 return summaries;
}
