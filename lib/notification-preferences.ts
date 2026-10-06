import {AppError} from './rally-errors';
export type NotificationPreferences={match_updates:boolean;registration_updates:boolean;tournament_updates:boolean;record_updates:boolean;feedback_updates:boolean};
export const defaultPreferences:NotificationPreferences={match_updates:true,registration_updates:true,tournament_updates:true,record_updates:true,feedback_updates:true};
export const preferenceKey={match:'match_updates',registration:'registration_updates',tournament:'tournament_updates',record:'record_updates',feedback:'feedback_updates'} as const;
export async function readPreferences(db:D1Database,player:string):Promise<NotificationPreferences>{
 const row=await db.prepare('SELECT * FROM notification_preferences WHERE player_id=?').bind(player).first<Record<string,number>>();return Object.fromEntries(Object.keys(defaultPreferences).map(k=>[k,row?!!row[k]:true])) as NotificationPreferences;
}
export async function savePreferences(db:D1Database,player:string,body:Record<string,unknown>){
 const values=Object.keys(defaultPreferences).map(k=>{if(typeof body[k]!=='boolean')throw new AppError(400,'Choose each notification preference.');return body[k]?1:0;});
 await db.prepare('INSERT INTO notification_preferences(player_id,match_updates,registration_updates,tournament_updates,record_updates,feedback_updates) VALUES(?,?,?,?,?,?) ON CONFLICT(player_id) DO UPDATE SET match_updates=excluded.match_updates,registration_updates=excluded.registration_updates,tournament_updates=excluded.tournament_updates,record_updates=excluded.record_updates,feedback_updates=excluded.feedback_updates').bind(player,...values).run();return {ok:true};
}
