import Home from '../page';
export const dynamic='force-dynamic';
export default function Explore({searchParams}:{searchParams:Promise<{view?:string;q?:string;page?:string}>}){return <Home searchParams={searchParams} publicBrowse/>;}
