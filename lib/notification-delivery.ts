import {buildPushPayload} from '@block65/webcrypto-web-push';
import {createAuthAdmin} from './auth-admin';
import {makeService} from './rally-service';
import {readPreferences} from './notification-preferences';
import {validateSubscription} from './push-subscriptions';
import type {RallyNotification} from './notifications';

export function deliverable(n:RallyNotification){return !n.read&&!!n.actionNeeded&&(n.id.startsWith('match-')||n.id.startsWith('fixture-')||n.id.startsWith('remind-session-'));}
type Delivery={id:string;notification_id:string;channel:'email'|'push';device_id:string;payload:string;attempts:number;created_at:number;retry_at:number;status:string};
type Device={id:string;endpoint:string;p256dh:string;auth:string};
type Payload={title:string;detail:string;href:string;email?:string};
export async function deliverNotifications(env:Cloudflare.Env,dependencies:{inbox?:(auth:string)=>Promise<RallyNotification[]>;email?:(auth:string)=>Promise<string|null>;fetch?:typeof fetch}={}){
 const emailConfigured=!!(env.RESEND_API_KEY&&env.NOTIFICATION_FROM&&env.SUPABASE_SECRET_KEY),pushConfigured=!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);if(!emailConfigured&&!pushConfigured)return;
 const db=env.DB,now=Date.now(),http=dependencies.fetch??fetch;
 const inbox=dependencies.inbox??(async(auth:string)=>(await makeService(db).read(auth,{compact:true})).notifications);
 const email=dependencies.email??(async(auth:string)=>{const {data,error}=await createAuthAdmin(env).auth.admin.getUserById(auth);return !error&&data.user?.email_confirmed_at?data.user.email??null:null;});
 // ponytail: five subscribed accounts per five-minute scan; use event-targeted queueing when that backlog exceeds reminder timing.
 const users=(await db.prepare(`SELECT p.id,p.auth_id FROM profiles p JOIN notification_preferences n ON n.player_id=p.id LEFT JOIN notification_delivery_scans s ON s.player_id=p.id
 WHERE p.deleted_at IS NULL AND p.auth_id IS NOT NULL AND ((n.email_delivery=1 AND ?=1) OR (n.push_delivery=1 AND ?=1)) AND coalesce(s.lease_until,0)<=?
 ORDER BY coalesce(s.scanned_at,0),p.id LIMIT 5`).bind(emailConfigured?1:0,pushConfigured?1:0,now).all<{id:string;auth_id:string}>()).results;
 for(const user of users){
  const leaseUntil=Date.now()+600000;
  const lease=await db.prepare(`INSERT INTO notification_delivery_scans(player_id,scanned_at,lease_until) VALUES(?,0,?) ON CONFLICT(player_id) DO UPDATE SET lease_until=excluded.lease_until WHERE lease_until<=?`).bind(user.id,leaseUntil,Date.now()).run();if(!lease.meta.changes)continue;
  try{
   const notices=(await inbox(user.auth_id)).filter(deliverable),prefs=await readPreferences(db,user.id),devices=(await db.prepare('SELECT * FROM push_subscriptions WHERE player_id=? ORDER BY created_at LIMIT 5').bind(user.id).all<Device>()).results;
   const address=prefs.email_delivery&&emailConfigured?await email(user.auth_id):null;
   const known=(await db.prepare('SELECT notification_id,channel,device_id FROM notification_deliveries WHERE player_id=?').bind(user.id).all<{notification_id:string;channel:string;device_id:string}>()).results;
   let added=0;
   for(const n of notices){const payload:Payload={title:n.title,detail:n.detail,href:n.href};const channels=[...(address?[{channel:'email',device_id:'',payload:{...payload,email:address}}]:[]),...(prefs.push_delivery&&pushConfigured?devices.map(d=>({channel:'push',device_id:d.id,payload})):[])];
    const missing=channels.filter(c=>!known.some(k=>k.notification_id===n.id&&k.channel===c.channel&&k.device_id===c.device_id));if(!missing.length)continue;if(added++>=3)break;
    for(const c of missing)await db.prepare(`INSERT OR IGNORE INTO notification_deliveries(id,player_id,notification_id,channel,device_id,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND deleted_at IS NULL AND auth_id=?)`).bind(crypto.randomUUID(),user.id,n.id,c.channel,c.device_id,JSON.stringify(c.payload),now,user.id,user.auth_id).run();
   }
   const pending=(await db.prepare("SELECT * FROM notification_deliveries WHERE player_id=? AND status='pending' AND retry_at<=? ORDER BY created_at,id LIMIT 3").bind(user.id,now).all<Delivery>()).results;
   const fresh=(await inbox(user.auth_id)).filter(deliverable);
   for(const job of pending){
    // Recheck the inbox and account immediately before an external side effect. Sending never marks an inbox item read.
    const current=fresh.find(n=>n.id===job.notification_id),latest=await readPreferences(db,user.id),active=await db.prepare('SELECT 1 FROM profiles WHERE id=? AND auth_id=? AND deleted_at IS NULL').bind(user.id,user.auth_id).first();
    const device=job.channel==='push'?await db.prepare('SELECT * FROM push_subscriptions WHERE id=? AND player_id=?').bind(job.device_id,user.id).first<Device>():null;
    const data=JSON.parse(job.payload) as Payload;
    if(!active||!current||!latest[`${job.channel}_delivery`]||job.channel==='push'&&!device||job.channel==='email'&&(!emailConfigured||await email(user.auth_id)!==data.email)||now-job.created_at>=23*3600000){await db.prepare("UPDATE notification_deliveries SET status='skipped' WHERE id=?").bind(job.id).run();continue;}
    let status=0;
    try{if(job.channel==='email'){
      const response=await http('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[data.email],subject:data.title,text:`${data.detail}\n\nhttps://rallytt.net${data.href}\n\nManage notifications: https://rallytt.net/account`}),signal:AbortSignal.timeout(15000)});status=response.status;
     }else if(pushConfigured&&device){const subscription=validateSubscription({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}}),payload=await buildPushPayload({data:JSON.stringify({id:job.notification_id,...data}),options:{ttl:300}},subscription,{subject:env.VAPID_SUBJECT!,publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!});const response=await http(subscription.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(15000)});status=response.status;}
    }catch{console.error('Notification delivery unavailable',job.channel);}
    if(job.channel==='push'&&(status===404||status===410))await db.prepare('DELETE FROM push_subscriptions WHERE id=? AND player_id=?').bind(job.device_id,user.id).run();
    const attempts=job.attempts+1,state=status>=200&&status<300?'sent':(attempts>=5||status>=400&&status<500&&status!==408&&status!==429?'failed':'pending');
    await db.prepare('UPDATE notification_deliveries SET status=?,attempts=?,retry_at=? WHERE id=?').bind(state,attempts,now+Math.min(3600000,300000*2**job.attempts),job.id).run();
   }
  }catch{console.error('Notification scan unavailable');}
  finally{await db.prepare('UPDATE notification_delivery_scans SET scanned_at=?,lease_until=0 WHERE player_id=? AND lease_until=?').bind(Date.now(),user.id,leaseUntil).run();}
 }
}
