// Email to Rally administrators (RALLY_ADMIN_EMAILS) through the existing Resend setup. Returns how many were sent; never throws.
type Env={RALLY_ADMIN_EMAILS?:string;RESEND_API_KEY?:string;NOTIFICATION_FROM?:string};
export async function emailAdmins(env:Env,mail:{subject:string;text:string;key:string},http:typeof fetch=fetch){
 const to=(env.RALLY_ADMIN_EMAILS??'').split(',').map(e=>e.trim()).filter(e=>/^[^@\s]+@[^@\s]+$/.test(e));
 if(!to.length||!env.RESEND_API_KEY||!env.NOTIFICATION_FROM)return 0;
 let sent=0;
 for(const address of to){
  try{
   const res=await http('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`${mail.key}-${address}`.slice(0,250)},body:JSON.stringify({from:env.NOTIFICATION_FROM,to:[address],subject:mail.subject.slice(0,150),text:mail.text}),signal:AbortSignal.timeout(15000)});
   if(res.ok)sent++;
  }catch{console.error('Admin email unavailable');}
 }
 return sent;
}
