import {env} from 'cloudflare:workers';
import {getAuthenticatedUser} from '@/lib/auth';
import {readActivityPage} from '@/lib/activity-pages';
import {seasonViews} from '@/lib/club-seasons';
import {matchRecord} from '@/lib/record-ownership';
import {ratingHistory,ratingEstimates} from '@/lib/seeding';
import {matchStakes} from '@/lib/match-stakes';
import {playerPerformance} from '@/lib/player-performance';
import {getPublicDirectory} from '@/lib/public-rally';
import {AppError,makeService} from '@/lib/rally-service';
import {rateLimit} from '@/lib/write-limits';
import {verifyTurnstile} from '@/lib/turnstile';
export const dynamic='force-dynamic';
function service(){if(!env.DB)throw new Error('Database unavailable');return makeService(env.DB)}
function isSiteAdmin(email:string){return (env.RALLY_ADMIN_EMAILS??'').split(',').some(value=>value.trim().toLowerCase()===email.toLowerCase())}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})}
function error(e:unknown){if(e instanceof AppError)return response({error:e.message},e.status);console.error('Rally data error',e);return response({error:'Your data is temporarily unavailable. Please try again.'},503)}
export async function GET(request:Request){try{const query=new URL(request.url).searchParams,user=await getAuthenticatedUser(),siteAdmin=!!user&&isSiteAdmin(user.email),view=query.get('view');
 if(view==='performance'){const player=query.get('player');if(!player){const directory=await getPublicDirectory(env.DB,'players',query.get('search')??'');return response({players:directory.players.map(p=>({id:p.id,name:p.name}))});}const data=await service().read(null),visible=data.players.some(p=>p.id===player);if(!visible&&!await env.DB.prepare('SELECT 1 FROM profiles WHERE id=? AND deleted_at IS NULL').bind(player).first())return response({error:'Player unavailable.'},404);return response(playerPerformance(visible?(query.get('club')&&query.get('club')!=='all'?data.matches.filter(m=>m.club_id===query.get('club')):data.matches):[],player,undefined,visible?ratingEstimates(data.players):{}));}
 if(view==='seasons'){const profile=user?await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>():null;return response(await seasonViews(env.DB,query.get('club')??'',profile?.id??null));}
 if(view==='members'||view==='matches'||view==='tournaments')return response(await readActivityPage(env.DB,user?.id??null,{view,club:query.get('club')??'all',search:query.get('search')??'',role:query.get('role')??'all',status:query.get('status')??'all',page:Number(query.get('page')??1),match:query.get('match')??'',player:query.get('player')??'',tournament:query.get('tournament')??'all',from:query.get('from')??'',to:query.get('to')??'',mine:query.get('mine')==='1',isSiteAdmin:siteAdmin}));
 if(!user)return response({error:'Sign in to open the Rally clubhouse.'},401);
 if(view==='match-record'){const profile=await env.DB.prepare('SELECT id FROM profiles WHERE auth_id=? AND deleted_at IS NULL').bind(user.id).first<{id:string}>();if(!profile)return response({error:'Create your player profile first.'},403);return response(await matchRecord(env.DB,profile.id,query.get('match')??''));}
 const data=await service().read(user.id,{isSiteAdmin:siteAdmin,compact:query.get('compact')==='1'&&!view,clubId:query.get('clubScope')??undefined});
 if(view==='rating'){const player=query.get('player')??'',club=query.get('club')??'all';if(!data.players.some(p=>p.id===player))return response({error:'Player unavailable.'},404);return response(ratingHistory(club==='all'?data.matches:data.matches.filter(m=>m.club_id===club),player,undefined,ratingEstimates(data.players)));}
 if(view==='stakes'){const a=query.get('a')??'',b=query.get('b')??'',club=query.get('club')??'',bestOf=Number(query.get('bestOf')),playedOn=query.get('date')??'';if(!data.players.some(p=>p.id===a)||!data.players.some(p=>p.id===b)||(club!=='unaffiliated'&&!data.clubs.some(c=>c.id===club)))return response({error:'Choose two available players and a club.'},400);const stakes=matchStakes(data.matches,a,b,{bestOf,clubId:club,playedOn},ratingEstimates(data.players));return stakes?response(stakes):response({error:'Choose two different players, a match format and a date.'},400);}
 if(view==='event'){const id=query.get('event'),event=data.tournaments.find(t=>t.id===id);if(!event)return response({error:'Tournament unavailable.'},404);return response({event,entries:data.entries.filter(e=>e.tournament_id===id),memberships:data.memberships.filter(m=>m.club_id===event.club_id),players:data.players.filter(p=>data.memberships.some(m=>m.club_id===event.club_id&&m.player_id===p.id)||data.entries.some(e=>e.tournament_id===id&&e.player_id===p.id)||event.waitlist?.some((w:{player_id:string})=>w.player_id===p.id))});}
 return response({...data,account:{email:user.email,displayName:user.displayName,emailVerified:user.emailVerified},isSiteAdmin:siteAdmin});
 }catch(e){return error(e)}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return response({error:'Request origin not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'JSON required.'},415);
 const user=await getAuthenticatedUser();if(!user)return response({error:'Sign in to save changes.'},401);
 const limited=await rateLimit(env.USER_WRITE_LIMITER,user.id);if(limited)return limited;
 if(Number(request.headers.get('content-length')??0)>262144)return response({error:'Request too large.'},413);
 const raw=await request.text();if(raw.length>262144)return response({error:'Request too large.'},413);
 let body;try{body=JSON.parse(raw)}catch{return response({error:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Invalid request.'},400);
 if(body.action==='submit_feedback')await verifyTurnstile(request,body.captchaToken,env.TURNSTILE_SECRET_KEY);
 if(body.action==='create_club'&&!user.emailVerified)return response({error:'Verify your email address before creating a club.'},403);
 return response(await service().act(user.id,body,{isSiteAdmin:isSiteAdmin(user.email),reviewerId:user.id}));
}catch(e){return error(e)}}
