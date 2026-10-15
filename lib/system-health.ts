import {emailAdmins} from './admin-email';
// Is Rally alive? The scheduled job (every five minutes) leaves a heartbeat; /api/health reports on it, and an administrator
// is emailed when a maintenance job fails (at most once every six hours, so a long outage is one email, not hundreds).
export const STALE_MINUTES=20,ALERT_EVERY_HOURS=6;
type Row={ran_at:string;failed:string;last_alert_at:string|null};
export async function recordRun(db:D1Database,failed:string[],now=new Date()){
 await db.prepare("INSERT INTO system_status(name,ran_at,failed) VALUES('scheduled',?,?) ON CONFLICT(name) DO UPDATE SET ran_at=excluded.ran_at,failed=excluded.failed").bind(now.toISOString(),failed.join(',')).run();
}
export async function healthReport(db:D1Database,now=new Date()){
 let dbOk=false,row:Row|null=null;
 try{row=await db.prepare("SELECT ran_at,failed,last_alert_at FROM system_status WHERE name='scheduled'").first<Row>();dbOk=true;}catch{/* reported as database down */}
 const age=row?Math.max(0,Math.round((now.getTime()-Date.parse(row.ran_at))/1000)):null,stale=age!==null&&age>STALE_MINUTES*60;
 return {ok:dbOk&&!stale,database:dbOk,checkedAt:now.toISOString(),scheduled:row?{ranAt:row.ran_at,ageSeconds:age,stale,failedJobs:row.failed?row.failed.split(','):[]}:null};
}
type AlertEnv={DB:D1Database;RALLY_ADMIN_EMAILS?:string;RESEND_API_KEY?:string;NOTIFICATION_FROM?:string};
// Emails the administrators about failed jobs, once per quiet period. Returns true when an email went out.
export async function alertIfNeeded(env:AlertEnv,failed:string[],now=new Date(),http:typeof fetch=fetch){
 if(!failed.length)return false;
 const cutoff=new Date(now.getTime()-ALERT_EVERY_HOURS*3600000).toISOString();
 // Claim the quiet period first so overlapping runs send one email.
 const claim=await env.DB.prepare("UPDATE system_status SET last_alert_at=? WHERE name='scheduled' AND (last_alert_at IS NULL OR last_alert_at<?)").bind(now.toISOString(),cutoff).run();
 if(!claim.meta.changes)return false;
 const sent=await emailAdmins(env,{subject:`Rally: ${failed.length===1?'a maintenance job failed':failed.length+' maintenance jobs failed'}`,key:`jobs-${now.toISOString().slice(0,13)}`,
  text:`These scheduled jobs failed on their last run: ${failed.join(', ')}.\n\nRally keeps running, but this work (alerts, reminders, cleanup or Discord posts) is not happening. Details are in the Cloudflare Workers logs for rally-table-tennis.\n\nYou will get at most one of these emails every ${ALERT_EVERY_HOURS} hours.\nHealth check: https://rallytt.net/api/health`},http);
 // Nothing was sent (no email provider): give the quiet period back so a later run can try.
 if(!sent)await env.DB.prepare("UPDATE system_status SET last_alert_at=NULL WHERE name='scheduled' AND last_alert_at=?").bind(now.toISOString()).run();
 return sent>0;
}
