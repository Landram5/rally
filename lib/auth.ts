import {createServerClient, type CookieOptions} from '@supabase/ssr';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {deletionPending} from './account-deletion';

export type RallyUser={id:string;email:string;displayName:string;emailVerified:boolean};

function authConfig(){
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!key)throw new Error('Authentication is not configured.');
 return {url,key};
}

export async function createAuthClient(){
 const {url,key}=authConfig(),store=await cookies();
 return createServerClient(url,key,{cookies:{
  getAll:()=>store.getAll(),
  setAll:(items:{name:string;value:string;options:CookieOptions}[])=>{for(const item of items)store.set(item.name,item.value,item.options)},
 }});
}

export async function getAuthenticatedUser():Promise<RallyUser|null>{
 const client=await createAuthClient();
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)return null;
 if(await deletionPending(env.DB,data.user.id))return null;
 const email=data.user.email?.trim();
 if(!email)return null;
 const metadata=data.user.user_metadata as Record<string,unknown>;
 const candidate=[metadata.display_name,metadata.full_name,metadata.name].find(value=>typeof value==='string'&&value.trim());
 return {id:data.user.id,email,displayName:typeof candidate==='string'?candidate.trim():email.split('@')[0],emailVerified:!!data.user.email_confirmed_at};
}
