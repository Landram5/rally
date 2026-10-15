import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {adminOverview,isSiteAdminEmail} from '@/lib/admin-overview';
import PublicHeader from '../public-header';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Admin · Rally',robots:{index:false,follow:false}};
const ago=(iso:string)=>{const h=Math.round((Date.now()-Date.parse(iso))/3600000);return h<1?'just now':h<48?`${h} hours ago`:`${Math.round(h/24)} days ago`;};
// Site administrators only: everything waiting on you, with links to where it is handled.
export default async function AdminPage(){
 const user=await getAuthenticatedUser().catch(()=>null);
 if(!user||!isSiteAdminEmail(env.RALLY_ADMIN_EMAILS,user.email))notFound();
 const o=await adminOverview(env.DB);
 const waiting=o.pendingClubs.length+o.reports.safety+o.feedbackOpen;
 return <><PublicHeader/><main className="admin-page">
  <h1>Admin</h1>
  <p className="admin-lede">{waiting?`${waiting} ${waiting===1?'item is':'items are'} waiting for you.`:'Nothing is waiting for you.'}</p>
  <section aria-labelledby="admin-clubs"><h2 id="admin-clubs">Clubs to verify ({o.pendingClubs.length})</h2>
   {o.pendingClubs.length?<ul className="admin-list">{o.pendingClubs.map(c=><li key={c.id}><span><b>{c.name}</b><small>{c.location} · {c.members} {c.members===1?'member':'members'} · created {ago(c.createdAt)}</small></span><span className="admin-links"><Link href={`/clubs/${encodeURIComponent(c.id)}`}>View</Link><Link href="/clubhouse?tab=clubs">Verify or reject</Link></span></li>)}</ul>:<p>No clubs are waiting. New clubs already work for their members; verifying one lists it publicly.</p>}</section>
  <section aria-labelledby="admin-reports"><h2 id="admin-reports">Reports</h2>
   <p><b>{o.reports.safety}</b> open {o.reports.safety===1?'report':'reports'} from messages and group chats. <Link href="/clubhouse?tab=messages">Open Messages, then the ⋯ menu, then Safety reports</Link>.</p>
   <p><b>{o.reports.clubChats}</b> open club chat {o.reports.clubChats===1?'report':'reports'}, handled by each club&rsquo;s organizers.</p></section>
  <section aria-labelledby="admin-feedback"><h2 id="admin-feedback">Feedback</h2><p><b>{o.feedbackOpen}</b> open {o.feedbackOpen===1?'request':'requests'}. <Link href="/feedback">Open the feedback inbox</Link>.</p></section>
  <section aria-labelledby="admin-activity"><h2 id="admin-activity">Activity</h2>
   <dl className="admin-stats"><div><dt>Players</dt><dd>{o.activity.players}</dd></div><div><dt>New this week</dt><dd>{o.activity.newPlayersThisWeek}</dd></div><div><dt>Verified clubs</dt><dd>{o.activity.verifiedClubs}</dd></div><div><dt>Matches this week</dt><dd>{o.activity.matchesThisWeek}</dd></div></dl></section>
  <section aria-labelledby="admin-health"><h2 id="admin-health">System</h2>
   <p>{o.health.ok?'Everything is running.':'Something needs attention.'} Database {o.health.database?'answers':'is not answering'}.{o.health.scheduled?` Background jobs last ran ${ago(o.health.scheduled.ranAt)}${o.health.scheduled.stale?' (stalled)':''}.`:' Background jobs have not run since the last deploy yet.'}</p>
   {!!o.health.scheduled?.failedJobs.length&&<p className="auth-error">Failing: {o.health.scheduled.failedJobs.join(', ')}.</p>}
   <p><Link href="/api/health">Health check</Link> · see MONITORING.md for the outside uptime watcher.</p></section>
 </main></>;
}
