import ClubDirectory from '../club-directory';
import {LayoutDashboard} from 'lucide-react';
import {env} from 'cloudflare:workers';
import {makeService} from '@/lib/rally-service';
import PublicHeader from '@/app/public-header';
export const dynamic='force-dynamic';
export default async function Clubs(){const data=await makeService(env.DB).read(null);return <><PublicHeader/><main className="public-page"><div className="page-heading"><h1>Clubs</h1><a className="member-clubhouse-icon" href="/clubhouse?tab=clubs" aria-label="Member clubhouse" title="Member clubhouse"><LayoutDashboard size={22}/></a></div><ClubDirectory clubs={data.clubs}/></main></>}
