import PublicHeader from '@/app/public-header';
import AnnouncementsBoard from '@/app/announcements-board';
import {getAuthenticatedUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function AnnouncementsPage(){if(!await getAuthenticatedUser())redirect('/login?next=%2Fannouncements');return <><PublicHeader/><main className="public-page"><h1>Announcements</h1><AnnouncementsBoard/></main></>;}
