import {AppError} from './rally-errors';
export const pushCookie='rally-push-device';
export function validateSubscription(value:unknown){
 if(!value||typeof value!=='object')throw new AppError(400,'Invalid push subscription.');
 const s=value as {endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};
 let url:URL;try{if(typeof s.endpoint!=='string'||s.endpoint.length>2048)throw new Error();url=new URL(s.endpoint);}catch{throw new AppError(400,'Invalid push endpoint.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(url.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)))throw new AppError(400,'Unsupported push provider.');
 const key=(v:unknown,bytes:number)=>{try{if(typeof v!=='string'||!/^[-_A-Za-z0-9]+$/.test(v)||atob(v.replaceAll('-','+').replaceAll('_','/')).length!==bytes)throw new Error();return v;}catch{throw new AppError(400,'Invalid push key.');}};
 return {endpoint:url.href,expirationTime:null,keys:{p256dh:key(s.keys?.p256dh,65),auth:key(s.keys?.auth,16)}};
}
export async function saveSubscription(db:D1Database,player:string,device:string,value:unknown){
 const s=validateSubscription(value);
 try{await crypto.subtle.importKey('raw',Uint8Array.from(atob(s.keys.p256dh.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)),{name:'ECDH',namedCurve:'P-256'},false,[]);}catch{throw new AppError(400,'Invalid push public key.');}
 // At most five devices per account. Endpoint reassignment removes a previous login's delivery capability.
 const insert=db.prepare(`INSERT INTO push_subscriptions(id,player_id,endpoint,p256dh,auth,created_at)
 SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND auth_id IS NOT NULL AND deleted_at IS NULL)
 AND ((SELECT count(*) FROM push_subscriptions WHERE player_id=? AND id<>?)<5)
 ON CONFLICT(endpoint) DO UPDATE SET id=excluded.id,player_id=excluded.player_id,p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at`).bind(device,player,s.endpoint,s.keys.p256dh,s.keys.auth,new Date().toISOString(),player,player,device);
 const results=await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE id=? AND player_id=?').bind(device,player),insert]),result=results[1];
 if(!result.meta.changes)throw new AppError(409,'Remove another device before enabling push here.');
}
