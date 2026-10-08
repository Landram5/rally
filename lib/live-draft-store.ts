import {AppError} from './rally-errors';
import {parseLiveDraft,type LiveMatchDraft} from './live-draft';
// One draft per account. The newest update wins, so two devices never overwrite each other with stale scores.
export async function readRemoteDraft(db:D1Database,player:string):Promise<LiveMatchDraft|null>{
 const row=await db.prepare('SELECT draft_json FROM live_drafts WHERE player_id=?').bind(player).first<{draft_json:string}>();
 return row?parseLiveDraft(row.draft_json,player):null;
}
export async function saveRemoteDraft(db:D1Database,player:string,body:unknown):Promise<{stored:boolean}>{
 const text=JSON.stringify(body);if(!text||text.length>2_000_000)throw new AppError(413,'This draft is too large to sync.');
 const draft=parseLiveDraft(text,player);if(!draft)throw new AppError(400,'This draft could not be synced.');
 const result=await db.prepare('INSERT INTO live_drafts(player_id,draft_id,draft_json,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND deleted_at IS NULL) ON CONFLICT(player_id) DO UPDATE SET draft_id=excluded.draft_id,draft_json=excluded.draft_json,updated_at=excluded.updated_at WHERE excluded.updated_at>=live_drafts.updated_at').bind(player,draft.id,text,draft.updatedAt,player).run();
 return {stored:(result.meta?.changes??0)>0};
}
// Only removes the draft it was asked about, so a late delete cannot erase a newer match.
export async function deleteRemoteDraft(db:D1Database,player:string,id:unknown){
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new AppError(400,'Invalid draft.');
 await db.prepare('DELETE FROM live_drafts WHERE player_id=? AND draft_id=?').bind(player,id).run();return {ok:true};
}
