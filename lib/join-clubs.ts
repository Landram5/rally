// Clubs a player can ask to join (the setup flow's "Find your club" step). Joining itself is the normal
// request_join action: an organizer approves it, so nothing here grants membership.
export type JoinClub={id:string;name:string;location:string;members:number;mine:'active'|'pending'|null};
const LIMIT=25;
export async function listJoinableClubs(db:D1Database,player:string,search=''):Promise<JoinClub[]>{
 const term='%'+search.trim().slice(0,60).replace(/[\\%_]/g,'\\$&')+'%';
 const rows=(await db.prepare(`SELECT c.id,c.name,c.location,
   (SELECT count(*) FROM memberships m JOIN profiles p ON p.id=m.player_id AND p.deleted_at IS NULL WHERE m.club_id=c.id AND m.status='active') AS members,
   (SELECT mm.status FROM memberships mm WHERE mm.club_id=c.id AND mm.player_id=?) AS mine
  FROM clubs c WHERE c.approval_status='approved' AND c.id!='unaffiliated' AND (c.name LIKE ? ESCAPE '\\' OR c.location LIKE ? ESCAPE '\\')
  ORDER BY members DESC,c.name COLLATE NOCASE,c.id LIMIT ?`).bind(player,term,term,LIMIT).all<{id:string;name:string;location:string;members:number;mine:string|null}>()).results;
 return rows.map(r=>({id:r.id,name:r.name,location:r.location,members:r.members,mine:r.mine==='active'||r.mine==='pending'?r.mine:null}));
}
