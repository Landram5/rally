import type {Data} from '../app/rally-app';
import type {DoublesFeedItem} from './doubles';
import type {DoublesMatch} from './doubles-rating';
import {profileFrom,standingsFrom} from './doubles-view';
// The sample demo keeps doubles results in memory. These helpers mirror the server rules closely enough to try the feature.
export type DemoDoubles={id:string;club_id:string;a1:string;a2:string;b1:string;b2:string;games:[number,number][];best_of:number;played_on:string;status:'pending'|'confirmed'|'voided';submitted_by:string;confirmed_by:string|null;tournament_id:string|null;revision:number;created_at:string;tournament_weight?:number};
const nameOf=(data:Data)=>(id:string)=>data.players.find(p=>p.id===id)?.name??'Player';
const members=(data:Data,club:string)=>new Set(data.memberships.filter(m=>m.status==='active'&&(club==='all'||m.club_id===club)&&data.players.some(p=>p.id===m.player_id&&!p.is_guest)).map(m=>m.player_id));
const asMatches=(data:Data):DoublesMatch[]=>(data.doublesMatches??[]).map(m=>({...m}));
export function demoDoublesFeed(data:Data,club:string):DoublesFeedItem[]{
 const name=nameOf(data),me=data.me?.id??'';
 return (data.doublesMatches??[]).filter(m=>club==='all'||m.club_id===club).sort((a,b)=>b.played_on.localeCompare(a.played_on)||b.created_at.localeCompare(a.created_at)).slice(0,20).map(m=>({...m,names:Object.fromEntries([m.a1,m.a2,m.b1,m.b2].map(id=>[id,name(id)])),canConfirm:m.status==='pending'&&m.submitted_by!==me,canVoid:m.status!=='voided',clubName:data.clubs.find(c=>c.id===m.club_id)?.name??'Club'}) as DoublesFeedItem);
}
export const demoDoublesStandings=(data:Data,club:string)=>standingsFrom(asMatches(data).filter(m=>m.status==='confirmed'),members(data,club),nameOf(data));
export const demoDoublesProfile=(data:Data,playerId:string)=>profileFrom(asMatches(data).filter(m=>m.status==='confirmed'),playerId,nameOf(data)(playerId),nameOf(data));
// Sample actions for recording, confirming and voiding. Throws the same plain-language errors the server would.
export function applyDemoDoubles(d:Data,p:Record<string,unknown>,action:string){
 d.doublesMatches??=[];
 if(action==='record_doubles_match'){
  const ids=[p.a1,p.a2,p.b1,p.b2].map(String);if(new Set(ids).size!==4)throw new Error('Choose four different players, two on each side.');
  const games=p.games as [number,number][];if(!Array.isArray(games)||!games.length)throw new Error('Enter at least one game score.');
  const club=String(p.clubId),ok=members(d,club);if(!ids.every(id=>ok.has(id)))throw new Error('All four players must be club members.');
  const canManage=!!d.clubs.find(c=>c.id===club)?.canManage;
  d.doublesMatches.push({id:String(p.id??crypto.randomUUID()),club_id:club,a1:ids[0],a2:ids[1],b1:ids[2],b2:ids[3],games,best_of:Number(p.bestOf)||3,played_on:String(p.date),status:canManage?'confirmed':'pending',submitted_by:d.me!.id,confirmed_by:canManage?d.me!.id:null,tournament_id:null,revision:0,created_at:new Date().toISOString()});
 }else{
  const m=d.doublesMatches.find(x=>x.id===p.id);if(!m)throw new Error('Match not found.');
  if(action==='confirm_doubles_match'){if(m.status!=='pending')throw new Error('This result was already handled.');m.status='confirmed';m.confirmed_by=d.me!.id;}
  else{if(m.status==='voided')throw new Error('This result was already voided.');m.status='voided';}
  m.revision++;
 }
}
