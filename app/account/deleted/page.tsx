import Link from 'next/link';
import PublicHeader from '@/app/public-header';
import {SUPPORT_EMAIL} from '@/lib/support';

export default async function DeletedPage({searchParams}:{searchParams:Promise<{pending?:string}>}){
 const pending=(await searchParams).pending==='1';
 return <><PublicHeader/><main className="account-settings"><p className="eyebrow">RALLY ACCOUNT</p><h1>{pending?'Deletion request received':'Account deletion complete'}</h1><p>{pending?'Your Rally access and personal profile details have been removed. The sign-in provider is temporarily unavailable; we will automatically retry the final account deletion. You do not need to submit another request.':'Your sign-in account and personal profile details have been deleted. Your selected history option has been applied.'}</p><p>Clubs and other players’ shared competition records remain.</p>{pending&&<p>If you need help with a delayed deletion, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>}<Link href="/">Return to Rally</Link></main></>;
}
