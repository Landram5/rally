import {healthReport} from './system-health';
// What is waiting on a Rally administrator, in one place (/admin). Counts and short lists only; the work itself happens where it already does.
export const isSiteAdminEmail=(list:string|undefined,email:string|null|undefined)=>!!email&&(list??'').split(',').some(v=>v.trim().toLowerCase()===email.toLowerCase());
const DAY=86400000;
export async function adminOverview(db:D1Database,now=new Date()){
 const week=new Date(now.getTime()-7*DAY).toISOString(),weekDate=week.slice(0,10);
 const n=async(sql:string,...args:unknown[])=>(await db.prepare(sql).bind(...args).first<{n:number}>())?.n??0;
 const [pendingClubs,reports,clubChatReports,feedback,newPlayers,clubs,matchesWeek,players,health]=await Promise.all([
  db.prepare("SELECT c.id,c.name,c.location,c.created_at AS createdAt,(SELECT count(*) FROM memberships m WHERE m.club_id=c.id AND m.status='active') AS members FROM clubs c WHERE c.approval_status='pending' ORDER BY c.created_at LIMIT 20").all<{id:string;name:string;location:string;createdAt:string;members:number}>().then(r=>r.results),
  n("SELECT count(*) n FROM safety_reports WHERE resolved_at IS NULL"),
  n("SELECT count(*) n FROM chat_reports WHERE resolved_at IS NULL"),
  n("SELECT count(*) n FROM feedback WHERE status='open'"),
  n("SELECT count(*) n FROM profiles WHERE auth_id IS NOT NULL AND deleted_at IS NULL AND created_at>=?",week),
  n("SELECT count(*) n FROM clubs WHERE approval_status='approved' AND id!='unaffiliated'"),
  n("SELECT count(*) n FROM matches WHERE status='confirmed' AND played_on>=?",weekDate),
  n("SELECT count(*) n FROM profiles WHERE auth_id IS NOT NULL AND deleted_at IS NULL"),
  healthReport(db,now),
 ]);
 return {pendingClubs,reports:{safety:reports,clubChats:clubChatReports},feedbackOpen:feedback,activity:{newPlayersThisWeek:newPlayers,players,verifiedClubs:clubs,matchesThisWeek:matchesWeek},health};
}
