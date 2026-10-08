import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {AppError} from '@/lib/rally-errors';
import {readDoublesFeed} from '@/lib/doubles';
import {readDoublesProfile,readDoublesStandings} from '@/lib/doubles-stats';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
// Doubles matches for the signed-in player. Writes (record, confirm, void) go through /api/rally like every other result.
export async function GET(request:Request){
 try{
  const user=await getAuthenticatedUser();if(!user)throw new AppError(401,'Sign in to see doubles matches.');
  const me=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!me)return response({matches:[]});
  const url=new URL(request.url),club=url.searchParams.get('club')??'all',offset=Number(url.searchParams.get('offset')??0);
  if(club!=='all'&&!/^[a-zA-Z0-9_-]{1,80}$/.test(club))throw new AppError(400,'Invalid club.');
  const view=url.searchParams.get('view')??'matches',player=url.searchParams.get('player')??me.id;
  if(view==='standings')return response(await readDoublesStandings(env.DB,me.id,club));
  if(view==='profile'){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(player))throw new AppError(400,'Invalid player.');const profile=await readDoublesProfile(env.DB,me.id,player);if(!profile)throw new AppError(404,'Doubles results are not available for this player.');return response(profile);}
  const matches=await readDoublesFeed(env.DB,me.id,club,20,Number.isFinite(offset)?offset:0);
  return response({matches});
 }catch(e){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Doubles feed unavailable',e);return response({error:'Doubles matches are temporarily unavailable.'},503);}
}
