import {createClient} from '@supabase/supabase-js';

// Server-only: this module is imported by the Worker and server routes, never UI.
export function createAuthAdmin(env: Pick<Cloudflare.Env,'SUPABASE_URL'|'SUPABASE_SECRET_KEY'>) {
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_SECRET_KEY?.trim();
 if(!url||!key)throw new Error('Account deletion is not configured.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
}
