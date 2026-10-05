'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export default function SignOutButton(){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 return <button className="account-signout" disabled={busy} onClick={async()=>{setBusy(true);try{await fetch('/api/auth/signout',{method:'POST'});router.push('/login');router.refresh()}finally{setBusy(false)}}}>{busy?'Signing out…':'Sign out'}</button>;
}
