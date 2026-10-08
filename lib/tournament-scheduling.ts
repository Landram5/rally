import {AppError} from './rally-errors';
import type {Draw} from './tournament-engine';
export type FixturePlan={fixture_id:string;court:string;starts_at:string;ends_at:string;called_at?:string|null};
export function scheduleDraw(draw:Draw,tables:number,minutes:number,start:string,existing:{fixture_id:string;court:string;starts_at:string|null;ends_at?:string|null;called_at?:string|null}[]=[],now=start){
 if(!Number.isInteger(tables)||tables<1||tables>64||!Number.isInteger(minutes)||minutes<5||minutes>120||!Number.isFinite(Date.parse(start)))throw new AppError(400,'Choose 1–64 tables, 5–120 minutes per match, and a valid start time.');
 const base=Date.parse(start),duration=minutes*60000,available=Array(tables).fill(base) as number[],players=new Map<string,number>(),finished=new Map<string,number>(),plans:FixturePlan[]=[];
 const locked=new Map<string,FixturePlan>(),occupiedTables=new Set<number>();
 for(const plan of existing){const fixture=draw.fixtures.find(f=>f.id===plan.fixture_id);if(fixture?.status!=='ready'||!plan.called_at||!plan.starts_at||!plan.court)continue;
  const number=/^Table ([1-9]\d*)$/.exec(plan.court)?.[1],table=Number(number)-1;if(!number||table>=tables)throw new AppError(409,'Keep enough numbered tables for matches already called, or update their assignments first.');
  if(occupiedTables.has(table))throw new AppError(409,'Two called matches share a table. Resolve their assignments first.');
  const ends=Math.max(Number.isFinite(Date.parse(plan.ends_at??''))?Date.parse(plan.ends_at!):0,Date.parse(now)+duration);occupiedTables.add(table);available[table]=Math.max(base,ends);finished.set(fixture.id,ends);
  for(const id of [fixture.a,fixture.b])if(id){if(players.has(id))throw new AppError(409,'A player has two called matches. Resolve their assignments first.');players.set(id,ends);}
  locked.set(fixture.id,{...plan,starts_at:plan.starts_at,ends_at:new Date(ends).toISOString()});
 }
 for(const f of draw.fixtures){
  if(locked.has(f.id)){plans.push(locked.get(f.id)!);continue;}
  const dependencies=[f.sourceA?.fixtureId,f.sourceB?.fixtureId,f.conditionFixtureId].filter((id):id is string=>!!id);
  if(draw.format==='Single elimination'&&f.round>1&&!f.sourceA&&!f.sourceB)dependencies.push(`r${f.round-1}m${f.slot*2+1}`,`r${f.round-1}m${f.slot*2+2}`);
  const earliest=Math.max(base,...dependencies.map(id=>finished.get(id)??base));
  if(!['ready','waiting'].includes(f.status)){finished.set(f.id,base);continue;}
  const occupants=[f.a,f.b].filter((id):id is string=>!!id),ready=Math.max(earliest,...occupants.map(id=>players.get(id)??base));
  // ponytail: greedy earliest-table scheduling, optimize globally only if measured event delays justify it.
  const table=available.indexOf(Math.min(...available)),starts=Math.max(available[table],ready),ends=starts+duration;available[table]=ends;finished.set(f.id,ends);for(const id of occupants)players.set(id,ends);
  plans.push({fixture_id:f.id,court:'Table '+(table+1),starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString()});
 }
 return {plans,endsAt:new Date(Math.max(base,...plans.map(p=>Date.parse(p.ends_at)))).toISOString()};
}
export async function expireWaitlistOffers(db:D1Database,now=new Date().toISOString()){
 await db.batch([db.prepare(`DELETE FROM tournament_waitlist WHERE claim_expires_at<=? OR id NOT IN (SELECT id FROM eligible_tournament_waitlist)`).bind(now),db.prepare(`UPDATE tournament_waitlist SET offered_at=?,claim_expires_at=(SELECT min(coalesce(t.registration_closes_at,'9999'),strftime('%Y-%m-%dT%H:%M:%fZ',?,'+'||t.claim_window_minutes||' minutes')) FROM tournaments t WHERE t.id=tournament_id) WHERE id IN (SELECT id FROM tournament_waitlist_offers)`).bind(now,now)]);
}
