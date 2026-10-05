'use client';
import {useState} from 'react';
import {CircleDot} from 'lucide-react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import PublicHeader from '@/app/public-header';

type Mode='signin'|'signup'|'reset';

export default function LoginPage(){
 const router=useRouter();
 const searchParams=useSearchParams();
 const [mode,setMode]=useState<Mode>('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[displayName,setDisplayName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const visibleError=error||searchParams.get('error')||'';
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const path=mode==='reset'?'/api/auth/reset-password':'/api/auth/password';
   const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='reset'?{email}:{mode,email,password,displayName,next:'/'})});
   const body=await response.json() as {error?:string;needsConfirmation?:boolean};
   if(!response.ok)throw new Error(body.error||'Could not continue.');
   if(mode==='reset'){setMessage('If that email has an account, a reset link is on its way.');return}
   if(body.needsConfirmation){setMessage('Check your email to confirm your account, then sign in.');return}
   router.push('/');router.refresh();
  }catch(value){setError(value instanceof Error?value.message:'Could not continue.')}finally{setBusy(false)}
 }
 return <><PublicHeader/><main className="auth-shell"><section className="auth-card">
  <div className="auth-heading"><span className="brand-mark"><CircleDot size={26}/></span><p className="eyebrow">RALLY ACCOUNT</p><h1>{mode==='signup'?'Create your player account':mode==='reset'?'Reset your password':'Welcome back'}</h1><p>{mode==='signup'?'Use Google or create an account with your email.':mode==='reset'?'We will email you a secure password reset link.':'Sign in to manage clubs, matches, and tournaments.'}</p></div>
  {mode!=='reset'&&<><button type="button" className="google-button" onClick={()=>window.location.assign(new URL('/auth/google?next=%2F',window.location.origin).toString())}><GoogleMark/><span>Continue with Google</span></button><div className="auth-divider"><span>or continue with email</span></div></>}
  <form className="auth-form" onSubmit={submit}>
   {mode==='signup'&&<label>Display name<input autoComplete="name" maxLength={60} required value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>}
   <label>Email<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   {mode!=='reset'&&<label>Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><small>At least 8 characters</small></label>}
   {visibleError&&<p className="auth-error" role="alert">{visibleError}</p>}{message&&<p className="auth-success" role="status">{message}</p>}
   <button className="primary-action auth-submit" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button>
  </form>
  <div className="auth-switch">{mode==='signin'?<><button onClick={()=>{setMode('reset');setError('');setMessage('')}}>Forgot password?</button><span>New to Rally? <button onClick={()=>{setMode('signup');setError('');setMessage('')}}>Create an account</button></span></>:<button onClick={()=>{setMode('signin');setError('');setMessage('')}}>Back to sign in</button>}</div>
  <Link className="ios-install-link" href="/install">Install Rally on iPhone</Link>
 </section></main></>;
}

function GoogleMark(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.2L6.5 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z"/></svg>}
