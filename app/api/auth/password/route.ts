import {createAuthClient} from '@/lib/auth';
import {safeNextPath,sameOrigin,validEmail,validPassword} from '@/lib/auth-rules';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'Request origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
 if(Number(request.headers.get('content-length')??0)>8192)return reply({error:'Request too large.'},413);
 let body:Record<string,unknown>;try{body=await request.json()}catch{return reply({error:'Invalid request.'},400)}
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!validEmail(email))return reply({error:'Enter a valid email address.'},400);
 if(!validPassword(body.password))return reply({error:'Password must be 8 to 128 characters.'},400);
 const client=await createAuthClient();
 if(body.mode==='signup'){
  const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
  if(!displayName||displayName.length>60)return reply({error:'Display name is required (maximum 60 characters).'},400);
  const next=safeNextPath(typeof body.next==='string'?body.next:'/');
  const {data,error}=await client.auth.signUp({email,password:body.password,options:{data:{display_name:displayName},emailRedirectTo:`${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent(next)}`}});
  if(error)return reply({error:error.message},400);
  return reply({ok:true,needsConfirmation:!data.session});
 }
 if(body.mode!=='signin')return reply({error:'Invalid request.'},400);
 const {error}=await client.auth.signInWithPassword({email,password:body.password});
 if(error)return reply({error:'Email or password is incorrect.'},400);
 return reply({ok:true});
}
