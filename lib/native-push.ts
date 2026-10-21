import {AppError} from './rally-errors';
// APNs device tokens are hex. Keep the length range loose because Apple has changed it before.
export function validateDevice(body:unknown){
 const b=(body&&typeof body==='object'?body:{}) as {token?:unknown;environment?:unknown};
 const token=typeof b.token==='string'?b.token.toLowerCase():'';
 if(!/^[a-f0-9]{64,200}$/.test(token))throw new AppError(400,'Invalid device token.');
 if(b.environment!=='sandbox'&&b.environment!=='production')throw new AppError(400,'Invalid push environment.');
 return {token,environment:b.environment};
}
// At most five devices per account. A token seen on a new login moves to that account, like web push endpoints.
export async function saveNativeDevice(db:D1Database,player:string,body:unknown){
 const d=validateDevice(body);
 const result=await db.prepare(`INSERT INTO native_push_devices(token,player_id,environment,created_at)
 SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND auth_id IS NOT NULL AND deleted_at IS NULL)
 AND ((SELECT count(*) FROM native_push_devices WHERE player_id=? AND token<>?)<5)
 ON CONFLICT(token) DO UPDATE SET player_id=excluded.player_id,environment=excluded.environment,created_at=excluded.created_at`).bind(d.token,player,d.environment,new Date().toISOString(),player,player,d.token).run();
 if(!result.meta.changes)throw new AppError(409,'Remove another device before enabling push here.');
}
export async function removeNativeDevice(db:D1Database,player:string,body:unknown){
 const token=typeof (body as {token?:unknown}|null)?.token==='string'?(body as {token:string}).token.toLowerCase():'';
 if(!/^[a-f0-9]{64,200}$/.test(token))throw new AppError(400,'Invalid device token.');
 await db.prepare('DELETE FROM native_push_devices WHERE token=? AND player_id=?').bind(token,player).run();
}
