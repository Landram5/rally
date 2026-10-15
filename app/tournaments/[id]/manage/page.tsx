import TournamentWorkspace from '@/app/tournament-workspace';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Manage tournament · Rally'};
export const dynamic='force-dynamic';
export default async function ManageTournament({params}:{params:Promise<{id:string}>}){return <TournamentWorkspace id={(await params).id}/>;}
