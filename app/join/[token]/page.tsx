import type {Metadata} from 'next';
import {env} from 'cloudflare:workers';
import Link from 'next/link';
import {getAuthenticatedUser} from '@/lib/auth';
import {InviteError,previewInvite,type InvitePreview} from '@/lib/club-invites';
import PublicHeader from '../../public-header';
import JoinInvite from '../../join-invite';
export const dynamic='force-dynamic';
// An invite link is a secret: keep it out of search results and referrers.
export const metadata:Metadata={title:'Join a club · Rally',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function JoinPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 let preview:InvitePreview|null=null,problem='';
 try{preview=await previewInvite(env.DB,token);}catch(e){problem=e instanceof InviteError?e.message:'This invite link is not available right now. Please try again.';}
 const signedIn=!!await getAuthenticatedUser().catch(()=>null);
 return <><PublicHeader/><main className="join-page">{preview?<JoinInvite token={token} club={preview} signedIn={signedIn}/>
  :<section className="join-card"><h1>This link will not work</h1><p>{problem}</p><Link className="primary-action" href="/clubs">Find a club</Link></section>}</main></>;
}
