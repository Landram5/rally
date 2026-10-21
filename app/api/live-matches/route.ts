import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {listLiveMatches} from '@/lib/live-matches';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
// Matches your clubs' members are sharing live right now. Updates arrive on /api/chat/ws?live=<clubId>.
export async function GET(){
 try{
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to watch live matches.');
  const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)throw new AppError(403,'Create your player profile first.');
  return reply({matches:await listLiveMatches(env.DB,profile.id)});
 }catch(e){if(e instanceof AppError)return reply({error:e.message},e.status);console.error('Live matches unavailable',e);return reply({error:'Live matches are temporarily unavailable.'},503);}
}
