import type {Draw} from './tournament-engine';
export type RallyNotification={id:string;title:string;detail:string;href:string;kind:'match'|'registration'|'tournament';read:boolean};
type Source={me:{id:string;name:string}|null;matches:{id:string;a:string;b:string;canConfirm:boolean}[];players:{id:string;name:string}[];clubs:{id:string;name:string}[];memberships:{club_id:string;player_id:string;status:string}[];entries:{tournament_id:string;player_id:string}[];tournaments:{id:string;name:string;club_id:string;date:string;capacity:number;status:string;check_in_open?:number;checkedIn?:string[];revision:number;registration_closes_at?:string|null;state:Draw|null}[]};
export function notificationsFor(data:Source,readIds:string[]=[],demo=false,today=new Date().toISOString().slice(0,10)):RallyNotification[]{
 if(!data.me)return [];const me=data.me.id,base=demo?'/demo':'/clubhouse',reads=new Set(readIds),notices:RallyNotification[]=[],name=(id:string)=>data.players.find(p=>p.id===id)?.name??'Player';
 const add=(id:string,title:string,detail:string,href:string,kind:RallyNotification['kind'])=>notices.push({id,title,detail,href,kind,read:reads.has(id)});
 for(const m of data.matches.filter(m=>m.canConfirm))add(`match-${m.id}`,'Verify a match',`${name(m.a)} vs ${name(m.b)}`,`${base}?tab=matches&match=${encodeURIComponent(m.id)}`,'match');
 for(const t of data.tournaments){const entered=data.entries.some(e=>e.tournament_id===t.id&&e.player_id===me),member=data.memberships.some(m=>m.club_id===t.club_id&&m.player_id===me&&m.status==='active'),href=`${base}?tab=tournaments&event=${t.id}`;
  if(t.status==='registration'&&member&&!entered&&t.date>=today&&(!t.registration_closes_at||t.registration_closes_at>new Date().toISOString())&&data.entries.filter(e=>e.tournament_id===t.id).length<t.capacity)add(`register-${t.id}`,'Tournament registration is open',`${t.name} · ${t.date}`,href,'registration');
  if(entered&&member&&t.check_in_open&&t.status!=='completed'&&!t.checkedIn?.includes(me))add(`checkin-${t.id}`,'Tournament check-in is open',t.name,href,'tournament');
  if(entered&&member&&t.status==='active'){
   for(const f of t.state?.fixtures.filter(f=>f.status==='ready'&&(f.a===me||f.b===me))??[])add(`fixture-${t.id}-${f.id}`,'Your tournament match is ready',`${t.name} · ${name(f.a!)} vs ${name(f.b!)}`,href,'tournament');
   add(`started-${t.id}`,'Your tournament has started',t.name,href,'tournament');
  }
  if(entered&&member&&t.status==='completed'&&Date.parse(t.date)>=Date.parse(today)-30*86400000)add(`completed-${t.id}-${t.revision}`,'Tournament results are available',t.name,href,'tournament');
 }
 return notices.slice(0,100);
}
