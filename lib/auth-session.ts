import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';

export async function refreshPageSession(request:NextRequest,config:{url:string;key:string},createClient= createServerClient){
 let response=NextResponse.next({request});
 const client=createClient(config.url,config.key,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll:(items,headers)=>{
   // The page must read the renewed token and the browser must retain it.
   for(const {name,value} of items)request.cookies.set(name,value);
   response=NextResponse.next({request});
   for(const {name,value,options} of items)response.cookies.set(name,value,options);
   for(const [name,value] of Object.entries(headers??{}))response.headers.set(name,value);
   response.headers.set('Cache-Control','private, no-store');
  },
 }});
 // Validate with Auth; cookie contents alone are never an identity check.
 await client.auth.getUser();
 return response;
}
