import {env} from 'cloudflare:workers';
import {handleInteraction,verifyInteraction} from '@/lib/discord';
export const dynamic='force-dynamic';
// Discord posts slash commands here. Every request must carry a valid Ed25519 signature from Discord.
export async function POST(request:Request){
 const key=env.DISCORD_PUBLIC_KEY?.trim();
 if(!key)return new Response('Not configured',{status:404});
 const body=await request.text();
 if(!await verifyInteraction(key,request.headers.get('x-signature-ed25519'),request.headers.get('x-signature-timestamp'),body))return new Response('Invalid request signature',{status:401});
 try{return await handleInteraction(env,JSON.parse(body));}
 catch(e){console.error('Discord interaction failed',e);return Response.json({type:4,data:{content:'Something went wrong on Rally. Please try again.',flags:64}});}
}
