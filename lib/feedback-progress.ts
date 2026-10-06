import {AppError} from './rally-errors';
import type {Feedback} from './feedback-types';
export async function readFeedback(db:D1Database,player:string,admin:boolean):Promise<Feedback[]>{
 const reports=(await db.prepare('SELECT * FROM feedback WHERE (?=1 OR submitted_by=?) ORDER BY created_at DESC LIMIT 100').bind(admin?1:0,player).all<Feedback>()).results;
 if(!reports.length)return reports;
 const updates=(await db.prepare(`SELECT * FROM feedback_updates WHERE feedback_id IN (${reports.map(()=>'?').join(',')}) ORDER BY created_at,id`).bind(...reports.map(f=>f.id)).all<{id:string;feedback_id:string;status:string;note:string;created_at:string}>()).results;
 return reports.map(f=>({...f,updates:updates.filter(u=>u.feedback_id===f.id)}));
}
export async function updateFeedback(db:D1Database,body:Record<string,unknown>){
 if(typeof body.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(body.id))throw new AppError(400,'Invalid request.');
 if(!['open','planned','in_progress','completed','closed'].includes(String(body.status)))throw new AppError(400,'Choose a valid feedback status.');
 if(body.note!==undefined&&(typeof body.note!=='string'||body.note.trim().length>1000))throw new AppError(400,'Progress notes must be at most 1,000 characters.');
 const old=await db.prepare('SELECT revision FROM feedback WHERE id=?').bind(body.id).first<{revision:number}>();if(!old)throw new AppError(404,'Feedback not found.');if(body.revision!==undefined&&body.revision!==old.revision)throw new AppError(409,'The request changed. Refresh before updating it.');
 const now=new Date().toISOString();
 try{await db.batch([db.prepare('UPDATE feedback SET status=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(body.status,now,body.id,old.revision),db.prepare('INSERT INTO account_change_guards(changed) VALUES(changes())'),db.prepare('INSERT INTO feedback_updates(id,feedback_id,status,note,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),body.id,body.status,typeof body.note==='string'?body.note.trim():'',now)]);}catch{throw new AppError(409,'The request changed. Refresh before updating it.');}return {ok:true};
}
