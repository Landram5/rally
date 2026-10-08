import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {env} from 'cloudflare:workers';
import PublicHeader from '@/app/public-header';
import HeadToHeadView,{headToHeadHeadline} from '@/app/head-to-head-view';
import {getPublicHeadToHead} from '@/lib/public-rally';

export const dynamic='force-dynamic';
type Props={params:Promise<{a:string;b:string}>};
async function pair(a:string,b:string){return env.DB?getPublicHeadToHead(env.DB,a,b):null}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {a,b}=await params,h=await pair(a,b);
 if(!h)return {title:'Head-to-head not found \u00b7 Rally'};
 const title=`${h.a.name} vs ${h.b.name} \u00b7 Rally head-to-head`,description=headToHeadHeadline(h.a.name,h.b.name,h.meetings),[x,y]=[h.a.id,h.b.id].sort();
 return {title,description,alternates:{canonical:`/head-to-head/${encodeURIComponent(x)}/${encodeURIComponent(y)}`},openGraph:{title,description,type:'website'}};
}

export default async function HeadToHeadPage({params}:Props){
 const {a,b}=await params,h=await pair(a,b);if(!h)notFound();
 return <><PublicHeader/><main className="public-page"><HeadToHeadView a={h.a} b={h.b} meetings={h.meetings}/></main></>;
}
