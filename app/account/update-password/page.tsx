'use client';
import {useState} from 'react';
import PublicHeader from '@/app/public-header';
import {useRouter} from 'next/navigation';

export default function UpdatePasswordPage(){
 const router=useRouter();
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match.');return}setBusy(true);try{const response=await fetch('/api/auth/update-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Could not update your password.');router.push('/');router.refresh()}catch(value){setError(value instanceof Error?value.message:'Could not update your password.')}finally{setBusy(false)}}
 return <><PublicHeader/><main className="auth-shell"><section className="auth-card"><div className="auth-heading"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Choose a new password</h1><p>Use at least 8 characters.</p></div><form className="auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary-action auth-submit" disabled={busy}>{busy?'Saving…':'Save new password'}</button></form></section></main></>;
}
