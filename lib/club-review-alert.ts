// A new club works right away for its own people but is not listed publicly until a Rally administrator verifies it.
// This emails the administrators when one is created, so verification does not depend on someone checking the app.
type Env={RALLY_ADMIN_EMAILS?:string;RESEND_API_KEY?:string;NOTIFICATION_FROM?:string};
export async function alertAdminsOfNewClub(env:Env,club:{id:string;name:string;location:string},http:typeof fetch=fetch){
 const to=(env.RALLY_ADMIN_EMAILS??'').split(',').map(e=>e.trim()).filter(e=>/^[^@\s]+@[^@\s]+$/.test(e));
 if(!to.length||!env.RESEND_API_KEY||!env.NOTIFICATION_FROM)return 0;
 let sent=0;
 for(const address of to){
  try{
   const res=await http('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`club-review-${club.id}-${address}`.slice(0,250)},
    body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[address],subject:`New club to verify: ${club.name}`.slice(0,150),text:`${club.name} (${club.location}) was just created on Rally.\n\nIt already works for its organizer and members, but it stays out of public lists until you verify it.\n\nVerify or reject it here: https://rallytt.net/clubhouse?tab=clubs\nThe club page: https://rallytt.net/clubs/${encodeURIComponent(club.id)}`}),signal:AbortSignal.timeout(15000)});
   if(res.ok)sent++;
  }catch{console.error('Club review email unavailable');}
 }
 return sent;
}
