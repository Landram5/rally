import {AppError} from './rally-errors';
export function weeklyInstant(instant:string,weeks:number,zone:string){
 let formatter:Intl.DateTimeFormat;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{throw new AppError(400,'Choose a valid time zone.');}
 const wall=(time:number)=>{const parts=Object.fromEntries(formatter.formatToParts(new Date(time)).map(p=>[p.type,p.value]));return Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)+new Date(time).getUTCMilliseconds();};
 const anchor=Date.parse(instant),wanted=wall(anchor)+weeks*7*86400000,guess=anchor+weeks*7*86400000;
 const offsets=new Set([-2,0,2].map(days=>{const time=guess+days*86400000;return wall(time)-time;}));
 const candidates=[...offsets].map(offset=>wanted-offset).sort((a,b)=>a-b),exact=candidates.filter(t=>wall(t)===wanted);
 // At an autumn overlap use the earlier instant; a nonexistent spring time moves forward by the gap.
 const chosen=exact[0]??candidates.filter(t=>wall(t)>wanted).sort((a,b)=>wall(a)-wall(b))[0];
 if(chosen===undefined)throw new AppError(400,'Could not schedule this local time.');return new Date(chosen).toISOString();
}
export type WeeklyTemplate={title:string;location:string;notes:string;starts:string;ends:string;capacity:number|null;timezone:string};
export async function expandWeeklySessions(db:D1Database,now=new Date().toISOString(),only?:string){
 const horizon=Date.parse(now)+56*86400000;
 const roots=(await db.prepare(`SELECT s.id,s.club_id,s.created_by,s.recurrence_json FROM club_sessions s JOIN clubs c ON c.id=s.club_id WHERE s.repeat_weekly=1 AND c.approval_status='approved' AND (?='' OR s.id=?) AND coalesce((SELECT max(x.starts_at) FROM club_sessions x WHERE x.series_id=s.id),'')<? ORDER BY coalesce((SELECT max(x.starts_at) FROM club_sessions x WHERE x.series_id=s.id),''),s.id LIMIT 10`).bind(only??'',only??'',new Date(horizon-7*86400000).toISOString()).all<{id:string;club_id:string;created_by:string|null;recurrence_json:string}>()).results;
 for(const root of roots){const template=JSON.parse(root.recurrence_json) as WeeklyTemplate,first=Math.max(1,Math.floor((Date.parse(now)-Date.parse(template.starts))/(7*86400000))-1),statements=[];
  for(let week=first;week<first+12;week++){const starts=weeklyInstant(template.starts,week,template.timezone),ends=new Date(Date.parse(starts)+Date.parse(template.ends)-Date.parse(template.starts)).toISOString();if(Date.parse(starts)>horizon)break;if(ends<=now)continue;
   statements.push(db.prepare(`INSERT INTO club_sessions(id,club_id,title,location,notes,starts_at,ends_at,capacity,created_by,created_at,updated_at,series_id,occurrence) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM club_sessions s JOIN clubs c ON c.id=s.club_id WHERE s.id=? AND s.repeat_weekly=1 AND c.approval_status='approved') ON CONFLICT(series_id,occurrence) WHERE series_id IS NOT NULL DO NOTHING`).bind(root.id+'-w'+week,root.club_id,template.title,template.location,template.notes,starts,ends,template.capacity,root.created_by,now,now,root.id,week,root.id));
  }if(statements.length)await db.batch(statements);
 }
}
