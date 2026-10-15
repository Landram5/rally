import ClubDirectory from '../club-directory';
import {LayoutDashboard} from 'lucide-react';
import {env} from 'cloudflare:workers';
import {makeService} from '@/lib/rally-service';
import PublicHeader from '@/app/public-header';
import StartAClub from '@/app/start-a-club';
import {getAuthenticatedUser} from '@/lib/auth';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Clubs · Rally'};
export const dynamic='force-dynamic';
export default async function Clubs(){const data=await makeService(env.DB).read(null),signedIn=!!await getAuthenticatedUser().catch(()=>null);return <><PublicHeader/><main className="public-page"><div className="page-heading"><h1>Clubs</h1><a className="member-clubhouse-icon" href="/clubhouse?tab=clubs" aria-label="Member clubhouse" title="Member clubhouse"><LayoutDashboard size={22}/></a></div><ClubDirectory clubs={data.clubs}/><StartAClub signedIn={signedIn}/></main></>}
