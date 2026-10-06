import {env} from 'cloudflare:workers';
import {NextResponse,type NextRequest} from 'next/server';
import {refreshPageSession} from './lib/auth-session';

export async function proxy(request:NextRequest){
 const url=env.SUPABASE_URL?.trim(),key=env.SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!key)return NextResponse.next();
 return refreshPageSession(request,{url,key});
}
// API/Auth route handlers already persist cookie writes. Refresh page requests
// before rendering, including public pages and Home Screen launches.
export const config={matcher:['/((?!api/|auth/|_next/|.*\\.[^/]+$).*)']};
