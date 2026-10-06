import {RallyApp} from '../rally-app';
import {redirect} from 'next/navigation';
import {getAuthenticatedUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Clubhouse(){
 if(!await getAuthenticatedUser())redirect('/');
 return <RallyApp/>;
}
