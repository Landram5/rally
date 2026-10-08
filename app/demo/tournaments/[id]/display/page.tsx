import SamplePublic from '../../../public-preview';
export default async function Page({params}:{params:Promise<{id:string}>}){return <SamplePublic kind="venue" id={(await params).id}/>;}
