import {emailAdmins} from './admin-email';
// A new club works right away for its own people but is not listed publicly until a Rally administrator verifies it.
// This emails the administrators when one is created, so verification does not depend on someone checking the app.
type Env={RALLY_ADMIN_EMAILS?:string;RESEND_API_KEY?:string;NOTIFICATION_FROM?:string};
export const alertAdminsOfNewClub=(env:Env,club:{id:string;name:string;location:string},http:typeof fetch=fetch)=>emailAdmins(env,{
 subject:`New club to verify: ${club.name}`,key:`club-review-${club.id}`,
 text:`${club.name} (${club.location}) was just created on Rally.\n\nIt already works for its organizer and members, but it stays out of public lists until you verify it.\n\nVerify or reject it here: https://rallytt.net/clubhouse?tab=clubs\nThe club page: https://rallytt.net/clubs/${encodeURIComponent(club.id)}`},http);
