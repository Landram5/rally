import TournamentWorkspace from '@/app/tournament-workspace';
export default async function ManageSampleTournament({params}:{params:Promise<{id:string}>}){return <TournamentWorkspace demo id={(await params).id}/>;}
