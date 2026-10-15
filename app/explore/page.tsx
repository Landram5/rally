import Home from '../page';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Explore · Rally'};
export const dynamic='force-dynamic';
export default function Explore({searchParams}:{searchParams:Promise<{view?:string;q?:string;page?:string}>}){return <Home searchParams={searchParams} publicBrowse/>;}
