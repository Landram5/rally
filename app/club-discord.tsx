'use client';
/* eslint-disable react-hooks/set-state-in-effect */
import {useCallback,useEffect,useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
type Status={configured:boolean;inviteUrl:string|null;link:{channelName:string;linkedAt:string}|null};
type Code={code:string;expiresAt:string};
async function call(init?:RequestInit,query=''){
 const r=await fetch('/api/discord'+query,{cache:'no-store',...init}),b=await r.json().catch(()=>({})) as {error?:string};
 if(!r.ok)throw new Error(b.error||'Could not reach the Discord link.');return b;
}
// Club > Manage > Discord: link the club chat to a Discord channel, or unlink it.
export default function ClubDiscord({clubId,demo=false}:{clubId:string;demo?:boolean}){
 const [status,setStatus]=useState<Status|null>(demo?{configured:true,inviteUrl:'#',link:null}:null),[code,setCode]=useState<Code|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{try{setStatus(await call(undefined,'?club='+encodeURIComponent(clubId)) as Status);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load the Discord link.');}},[clubId]);
 useEffect(()=>{if(!demo)void load();},[demo,load]);
 async function generate(){
  setBusy(true);
  try{if(demo){setCode({code:'K7M2QX',expiresAt:new Date(Date.now()+900000).toISOString()});return;}setCode(await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'code',clubId})}) as Code);}
  catch(e){toast.error(e instanceof Error?e.message:'Could not create a code.');}finally{setBusy(false);}
 }
 async function unlink(){
  if(!window.confirm('Unlink Discord? Messages will stop going between this club chat and the channel.'))return;
  setBusy(true);
  try{if(demo){setStatus(s=>s&&{...s,link:null});}else{await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'unlink',clubId})});await load();}setCode(null);toast.success('Discord unlinked.');}
  catch(e){toast.error(e instanceof Error?e.message:'Could not unlink.');}finally{setBusy(false);}
 }
 if(!status&&!error)return null;
 return <section className="panel club-detail-section club-discord" aria-label="Discord"><h2>Discord</h2>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {status&&(!status.configured?<p>The Discord bot has not been set up for this Rally site yet. Ask the Rally administrator to configure it.</p>
   :status.link?<><p>Linked to <b>#{status.link.channelName||'a Discord channel'}</b>. Messages in the club chat and in that channel appear in both places. Photos and videos stay in Rally and show up in Discord as a note.</p><Button variant="outline" disabled={busy} onClick={()=>void unlink()}>Unlink Discord</Button></>
   :<><p>Bridge your club chat with a Discord channel so members on either side can talk to each other.</p>
    {code?<ol className="discord-steps"><li>Add the Rally bot to your Discord server.{status.inviteUrl&&<div className="discord-invite"><Button asChild><a href={status.inviteUrl} target="_blank" rel="noreferrer">Invite the bot</a></Button></div>}</li><li>In the channel you want to link, a server admin runs <code>/rally link</code> and enters this code: <b className="discord-code">{code.code}</b></li><li>The code works for 15 minutes. This page updates when you refresh.</li></ol>
     :<Button disabled={busy} onClick={()=>void generate()}>Link a Discord channel</Button>}
    {code&&<div className="discord-actions"><Button variant="outline" size="sm" onClick={()=>void load()}>Check link</Button><Button variant="ghost" size="sm" onClick={()=>setCode(null)}>Done</Button></div>}</>)}
 </section>;
}
