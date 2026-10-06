import {LayoutDashboard} from 'lucide-react';
/* eslint-disable @next/next/no-img-element */
import {env} from 'cloudflare:workers';
import {makeService} from '@/lib/rally-service';
import PublicHeader from '@/app/public-header';
export const dynamic='force-dynamic';
export default async function Clubs(){const data=await makeService(env.DB).read(null);return <><PublicHeader/><main className="public-page"><div className="page-heading"><h1>Clubs</h1><a className="member-clubhouse-icon" href="/clubhouse?tab=clubs" aria-label="Member clubhouse" title="Member clubhouse"><LayoutDashboard size={22}/></a></div><div className="club-grid">{data.clubs.map(c=><a className="club-card club-directory-link" key={c.id} href={`/clubs/${c.id}`}>{c.banner_url&&<img className="club-detail-banner" src={c.banner_url} alt={`${c.name} banner`}/>}<div className="club-body"><h2>{c.name}</h2><p>{c.location}</p>{c.bio&&<p className="club-summary">{c.bio}</p>}<p>{c.activeMemberCount} members</p><span className="directory-view">View club →</span></div></a>)}</div>{!data.clubs.length&&<p>No approved clubs yet.</p>}</main></>}
