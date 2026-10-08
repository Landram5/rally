import SamplePublic from '../../../public-preview';
export default async function Page({params}:{params:Promise<{a:string;b:string}>}){const {a,b}=await params;return <SamplePublic kind="head-to-head" id={a} id2={b}/>;}
