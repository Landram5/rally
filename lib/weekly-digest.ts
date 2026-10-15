import {createAuthAdmin} from './auth-admin';
import {makeService} from './rally-service';
import type {RallyNotification} from './notifications';
// Optional weekly summary email (Account > Notifications > "Weekly summary email"), for people who do not install the app.
// One email per person per week, only when there is something in it, sent Monday afternoon (UTC).
type Session={title:string;clubName:string;starts_at:string;status:string;location?:string};
export type DigestInput={notifications:RallyNotification[];sessions:Session[]};
const SITE='https://rallytt.net',DAY=86400000,SEND_HOUR_UTC=13,PER_RUN=25;
// The Monday (UTC date) of the week a moment belongs to; the unit "once a week" is counted in.
export function weekOf(now:Date){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export const isSendWindow=(now:Date)=>now.getUTCDay()===1&&now.getUTCHours()>=SEND_HOUR_UTC;
const when=(iso:string)=>new Date(iso).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'});
// What goes in the email, or null when there is nothing worth sending.
export function buildDigest(input:DigestInput,now:Date){
 const waiting=input.notifications.filter(n=>!n.read&&n.actionNeeded).slice(0,8);
 const horizon=now.getTime()+7*DAY,soon=input.sessions.filter(s=>s.status==='scheduled'&&Date.parse(s.starts_at)>=now.getTime()&&Date.parse(s.starts_at)<=horizon).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,6);
 if(!waiting.length&&!soon.length)return null;
 const lines=['Here is your week on Rally.',''];
 if(waiting.length){lines.push('WAITING FOR YOU');for(const n of waiting)lines.push(`- ${n.title}: ${n.detail}`,`  ${SITE}${n.href.startsWith('/')?n.href:'/'+n.href}`);lines.push('');}
 if(soon.length){lines.push('COMING UP THIS WEEK');for(const s of soon)lines.push(`- ${s.title} (${s.clubName}): ${when(s.starts_at)}${s.location?', '+s.location:''}`);lines.push('');}
 lines.push(`Open Rally: ${SITE}/clubhouse`,'',`Stop these weekly emails: ${SITE}/account#notifications`);
 return {subject:waiting.length?`Your week on Rally: ${waiting.length} ${waiting.length===1?'thing is':'things are'} waiting`:'Your week on Rally',text:lines.join('\n')};
}
type Deps={read?:(auth:string)=>Promise<DigestInput>;email?:(auth:string)=>Promise<string|null>;fetch?:typeof fetch;now?:Date};
export async function sendWeeklyDigests(env:Cloudflare.Env,deps:Deps={}){
 const now=deps.now??new Date();
 if(!isSendWindow(now)||!env.RESEND_API_KEY||!env.NOTIFICATION_FROM||!env.SUPABASE_SECRET_KEY)return 0;
 const db=env.DB,week=weekOf(now),http=deps.fetch??fetch;
 const read=deps.read??(async(auth:string)=>{const r=await makeService(db).read(auth,{compact:true}) as unknown as DigestInput;return {notifications:r.notifications??[],sessions:r.sessions??[]};});
 const email=deps.email??(async(auth:string)=>{const {data,error}=await createAuthAdmin(env).auth.admin.getUserById(auth);return !error&&data.user?.email_confirmed_at?data.user.email??null:null;});
 const people=(await db.prepare(`SELECT p.id,p.auth_id FROM notification_preferences n JOIN profiles p ON p.id=n.player_id WHERE n.weekly_digest=1 AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM digest_sent d WHERE d.player_id=p.id AND d.week=?) ORDER BY p.id LIMIT ?`).bind(week,PER_RUN).all<{id:string;auth_id:string}>()).results;
 let sent=0,failed=0;
 for(const person of people){
  // Claim the week first so two overlapping runs never send twice; give the claim back if the email did not go out.
  const claim=await db.prepare('INSERT OR IGNORE INTO digest_sent(player_id,week,sent_at) VALUES(?,?,?)').bind(person.id,week,now.toISOString()).run();if(!claim.meta.changes)continue;
  let ok=false;
  try{
   const digest=buildDigest(await read(person.auth_id),now),address=digest?await email(person.auth_id):null;
   if(!digest||!address){ok=true;continue;} // nothing to say (or no confirmed address): the week stays claimed so it is not retried every five minutes
   const res=await http('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`digest-${person.id}-${week}`},body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[address],subject:digest.subject,text:digest.text}),signal:AbortSignal.timeout(15000)});
   ok=res.ok;if(ok)sent++;else{failed++;if(res.status>=400&&res.status<500&&res.status!==408&&res.status!==429)ok=true;} // a rejection that will not change (bad address) stays claimed: do not retry it all Monday
  }catch{failed++;console.error('Weekly summary unavailable');}
  finally{if(!ok)await db.prepare('DELETE FROM digest_sent WHERE player_id=? AND week=?').bind(person.id,week).run();}
 }
 if(failed&&!sent)throw new Error('Weekly summaries could not be sent'); // so the heartbeat and failure alert notice
 return sent;
}
