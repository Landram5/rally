import TournamentWorkspace from '@/app/tournament-workspace';
export const dynamic='force-dynamic';
export default async function ManageTournament({params}:{params:Promise<{id:string}>}){return <TournamentWorkspace id={(await params).id}/>;}
