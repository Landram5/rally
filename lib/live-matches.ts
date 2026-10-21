import {parseLiveDraft} from './live-draft';
// Club members watch a match its scorer chose to share. The score is unofficial: the result is still recorded and confirmed as usual.
// The scorer's draft (lib/live-draft-store) stays the source of truth; this keeps a compact copy for spectators.
export const liveRoom=(clubId:string)=>`live:${clubId}`;
export const LIVE_STALE_MS=4*3600*1000;
export type Publish=(room:string,event:unknown)=>Promise<unknown>;
type Row={id:string;player_id:string;club_id:string;a:string;b:string;best_of:number;swapped:number;state_json:string;updated_at:string};
const activeMember="EXISTS(SELECT 1 FROM memberships m JOIN clubs c ON c.id=m.club_id JOIN profiles p ON p.id=m.player_id WHERE m.club_id=l.club_id AND m.player_id=? AND m.status='active' AND c.approval_status IN ('approved','pending') AND p.deleted_at IS NULL AND p.auth_id IS NOT NULL)";
const event=(r:Row)=>({type:'live_match',id:r.id,clubId:r.club_id,scorerId:r.player_id,a:r.a,b:r.b,bestOf:r.best_of,swapped:!!r.swapped,state:JSON.parse(r.state_json),updatedAt:r.updated_at});
// The scorer must be an active member who plays in the match or administers the club, and both players must be active members.
async function canShare(db:D1Database,player:string,d:{clubId:string;a:string;b:string}){
 const row=await db.prepare("SELECT m.role,(SELECT count(*) FROM memberships x WHERE x.club_id=m.club_id AND x.player_id IN (?,?) AND x.status='active') both_in FROM memberships m JOIN clubs c ON c.id=m.club_id WHERE m.club_id=? AND m.player_id=? AND m.status='active' AND c.approval_status IN ('approved','pending')").bind(d.a,d.b,d.clubId,player).first<{role:string;both_in:number}>();
 return !!row&&row.both_in===2&&(d.a===player||d.b===player||['owner','admin','board'].includes(row.role));
}
// Called after each draft save. Sharing is opt-in: a draft without `shared: true` removes any live copy.
export async function syncLiveMatch(db:D1Database,player:string,body:unknown,publish:Publish){
 if((body as {shared?:unknown}|null)?.shared!==true)return endLiveMatch(db,player,publish);
 const d=parseLiveDraft(JSON.stringify(body),player);
 if(!d||d.clubId==='unaffiliated'||!await canShare(db,player,d))return endLiveMatch(db,player,publish);
 const prior=await db.prepare('SELECT id,club_id FROM live_matches WHERE player_id=?').bind(player).first<{id:string;club_id:string}>();
 if(prior&&prior.id!==d.id)await publish(liveRoom(prior.club_id),{type:'live_end',id:prior.id,clubId:prior.club_id});
 const state=JSON.stringify({points:d.state.points,games:d.state.games,complete:d.state.complete}),now=new Date().toISOString();
 const result=await db.prepare(`INSERT INTO live_matches(id,player_id,club_id,a,b,best_of,swapped,state_json,draft_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(player_id) DO UPDATE SET id=excluded.id,club_id=excluded.club_id,a=excluded.a,b=excluded.b,best_of=excluded.best_of,swapped=excluded.swapped,state_json=excluded.state_json,draft_at=excluded.draft_at,updated_at=excluded.updated_at
  WHERE live_matches.id<>excluded.id OR excluded.draft_at>live_matches.draft_at`).bind(d.id,player,d.clubId,d.a,d.b,d.bestOf,d.swapped?1:0,state,d.updatedAt,now).run();
 if(!result.meta.changes)return;
 await publish(liveRoom(d.clubId),event({id:d.id,player_id:player,club_id:d.clubId,a:d.a,b:d.b,best_of:d.bestOf,swapped:d.swapped?1:0,state_json:state,updated_at:now}));
}
// With `id`, only that match is removed, so a late delete cannot end a newer one.
export async function endLiveMatch(db:D1Database,player:string,publish:Publish,id?:string){
 const row=await db.prepare('SELECT id,club_id FROM live_matches WHERE player_id=?').bind(player).first<{id:string;club_id:string}>();
 if(!row||(id!==undefined&&row.id!==id))return;
 await db.prepare('DELETE FROM live_matches WHERE player_id=? AND id=?').bind(player,row.id).run();
 await publish(liveRoom(row.club_id),{type:'live_end',id:row.id,clubId:row.club_id});
}
export async function listLiveMatches(db:D1Database,viewer:string,now=Date.now()){
 const rows=(await db.prepare(`SELECT l.* FROM live_matches l WHERE l.updated_at>? AND ${activeMember} ORDER BY l.updated_at DESC LIMIT 50`).bind(new Date(now-LIVE_STALE_MS).toISOString(),viewer).all<Row>()).results;
 return rows.map(event);
}
export async function cleanupLiveMatches(db:D1Database,now=Date.now()){
 await db.prepare('DELETE FROM live_matches WHERE updated_at<=?').bind(new Date(now-LIVE_STALE_MS).toISOString()).run();
}
