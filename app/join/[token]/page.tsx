import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import Link from 'next/link';
import {getAuthenticatedUser} from '@/lib/auth';
import {InviteError,hasPlayerProfile,previewInvite,type InvitePreview} from '@/lib/club-invites';
import PublicHeader from '../../public-header';
import JoinInvite from '../../join-invite';
export const dynamic='force-dynamic';
// An invite link is a secret: keep it out of search results and referrers. Chats still get a friendly preview card.
export async function generateMetadata({params}:{params:Promise<{token:string}>}):Promise<Metadata>{
 const base:Metadata={title:'Join a club · Rally',robots:{index:false,follow:false},referrer:'no-referrer'};
 try{
  const p=await previewInvite(env.DB,(await params).token),title=`Join ${p.name} on Rally`,description=`${p.name} (${p.location}) invited you. Tap to join.`,image=`/og/club/${encodeURIComponent(p.clubId)}?invite=1`;
  return {...base,title,description,openGraph:{type:'website',siteName:'Rally',title,description,images:[{url:image,width:1200,height:630,alt:title}]},twitter:{card:'summary_large_image',title,description,images:[image]}};
 }catch{return base;}
}
export default async function JoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 let preview:InvitePreview|null=null,problem='';
 try{preview=await previewInvite(env.DB,token);}catch(e){problem=e instanceof InviteError?e.message:'This invite link is not available right now. Please try again.';}
 const user=await getAuthenticatedUser().catch(()=>null),signedIn=!!user,hasProfile=!!user&&await hasPlayerProfile(env.DB,user.id).catch(()=>false);
 return <><PublicHeader/><main className="join-page">{preview?<JoinInvite token={token} club={preview} signedIn={signedIn} hasProfile={hasProfile}/>
  :<section className="join-card"><h1>This link will not work</h1><p>{problem}</p><Link className="primary-action" href="/clubs">Find a club</Link></section>}</main></>;
}
