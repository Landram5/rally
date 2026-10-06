import ClubPage from '@/app/club-page';
import {createDemoData} from '@/lib/demo-state';
export default async function Page({params}:{params:Promise<{id:string}>}){return <ClubPage id={(await params).id} initialData={createDemoData()} demo/>;}
