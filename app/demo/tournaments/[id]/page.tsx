import SamplePublic from '../../public-preview';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SamplePublic kind="tournament" id={id}/>;}
