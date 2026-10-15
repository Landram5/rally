import {AppError} from './rally-errors';
import {chatAccess} from './chat';
import {getPublicLeaderboard} from './public-leaderboard';
import type {DiscordEnv} from './discord';
// Discord extras on top of the chat bridge (lib/discord.ts):
//  - automatic posts into a linked channel (club announcements, new sessions, finished tournaments),
//  - the /club commands (leaderboard, next, player, connect),
//  - linking a Discord account to a Rally player so bridged messages show the Rally name.
type Http=typeof fetch;
const API='https://discord.com/api/v10',SITE='https://rallytt.net',CODE_MINUTES=15;
const COLOR=0xc6e04a;
export const newConnectCode=()=>{const a=crypto.getRandomValues(new Uint8Array(6)),chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...a].map(b=>chars[b%chars.length]).join('');};
type Link={webhook_id:string;webhook_token:string};
type Embed={title:string;description?:string;url?:string;timestamp?:string};
type PostRow=Link&{announce_webhook_id:string|null;announce_webhook_token:string|null;announce_matches:number};
// Announcements go to the club's announcement channel when the owner chose one, otherwise to the chat channel. Match results are opt-in.
async function post(env:DiscordEnv,clubId:string,embed:Embed,http:Http,kind:'match'|'news'='news'){
 const row=await env.DB.prepare('SELECT webhook_id,webhook_token,announce_webhook_id,announce_webhook_token,announce_matches FROM discord_links WHERE club_id=? AND announce=1').bind(clubId).first<PostRow>();if(!row)return false;
 if(kind==='match'&&!row.announce_matches)return false;
 const own=!!(row.announce_webhook_id&&row.announce_webhook_token),link={webhook_id:own?row.announce_webhook_id!:row.webhook_id,webhook_token:own?row.announce_webhook_token!:row.webhook_token};
 try{
  const res=await http(`${API}/webhooks/${link.webhook_id}/${link.webhook_token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Rally',embeds:[{...embed,title:embed.title.slice(0,250),description:embed.description?.slice(0,1500),color:COLOR}],allowed_mentions:{parse:[]}})});
  // The announcement webhook was deleted: fall back to the chat channel. The chat webhook was deleted: unlink.
  if(res.status===404||res.status===401)await env.DB.prepare(own?"UPDATE discord_links SET announce_channel_id=NULL,announce_channel_name='',announce_webhook_id=NULL,announce_webhook_token=NULL WHERE club_id=?":'DELETE FROM discord_links WHERE club_id=?').bind(clubId).run();
  return res.ok;
 }catch{console.error('Discord announcement unavailable');return false;}
}
// Posts once per (kind, ref, club); a repeat call for the same thing does nothing.
async function postOnce(env:DiscordEnv,kind:string,refId:string,clubId:string,embed:Embed,http:Http,now:string){
 const mark=await env.DB.prepare('INSERT OR IGNORE INTO discord_posted(kind,ref_id,club_id,posted_at) VALUES(?,?,?,?)').bind(kind,refId,clubId,now).run();
 if(!mark.meta?.changes)return false;
 const ok=await post(env,clubId,embed,http,kind==='match'?'match':'news');
 // Nothing was sent (no link, or Discord said no): forget it so a later attempt can still post.
 if(!ok)await env.DB.prepare('DELETE FROM discord_posted WHERE kind=? AND ref_id=? AND club_id=?').bind(kind,refId,clubId).run();
 return ok;
}
export const announceClubAnnouncement=(env:DiscordEnv,a:{id:string;clubId:string;title:string;body:string},http:Http=fetch,now=new Date().toISOString())=>
 postOnce(env,'announcement',a.id,a.clubId,{title:'📣 '+a.title,description:a.body,timestamp:now},http,now);
export async function announceSession(env:DiscordEnv,sessionId:string,http:Http=fetch,now=new Date().toISOString()){
 const s=await env.DB.prepare("SELECT id,club_id,title,location,starts_at FROM club_sessions WHERE id=? AND status='scheduled'").bind(sessionId).first<{id:string;club_id:string;title:string;location:string;starts_at:string}>();if(!s)return false;
 const when=Math.floor(Date.parse(s.starts_at)/1000);
 return postOnce(env,'session',s.id,s.club_id,{title:'🏓 New session: '+s.title,description:`<t:${when}:F> (<t:${when}:R>)${s.location?'\n📍 '+s.location:''}`,url:`${SITE}/clubs/${s.club_id}`,timestamp:now},http,now);
}
// Scheduled: tournaments that finished since the club linked Discord.
export async function announceFinishedTournaments(env:DiscordEnv,http:Http=fetch,now=new Date().toISOString()){
 if(!env.DISCORD_BOT_TOKEN?.trim())return 0;
 const rows=(await env.DB.prepare(`SELECT t.id,t.club_id,t.name,t.format FROM tournaments t JOIN discord_links l ON l.club_id=t.club_id AND l.announce=1
  WHERE t.status='completed' AND t.deleted_at IS NULL AND t.date>=substr(l.created_at,1,10) AND NOT EXISTS(SELECT 1 FROM discord_posted d WHERE d.kind='tournament' AND d.ref_id=t.id AND d.club_id=t.club_id) LIMIT 10`).all<{id:string;club_id:string;name:string;format:string}>()).results;
 let sent=0;for(const t of rows)if(await postOnce(env,'tournament',t.id,t.club_id,{title:'🏆 '+t.name+' is complete',description:`${t.format}. See the results on Rally.`,url:`${SITE}/tournaments/${t.id}`,timestamp:now},http,now))sent++;
 return sent;
}
// Scheduled: confirmed club results (not tournament bracket matches, which have their own post) played since the club linked Discord, within the last 3 days.
export async function announceConfirmedMatches(env:DiscordEnv,http:Http=fetch,now=new Date().toISOString()){
 if(!env.DISCORD_BOT_TOKEN?.trim())return 0;
 const since=new Date(Date.parse(now)-3*86400000).toISOString().slice(0,10);
 const rows=(await env.DB.prepare(`SELECT m.id,m.club_id,m.games,pa.name an,pa.deleted_at ad,pb.name bn,pb.deleted_at bd FROM matches m JOIN discord_links l ON l.club_id=m.club_id AND l.announce=1 AND l.announce_matches=1 JOIN profiles pa ON pa.id=m.a JOIN profiles pb ON pb.id=m.b
  WHERE m.status='confirmed' AND m.tournament_id IS NULL AND m.played_on>=substr(l.created_at,1,10) AND m.played_on>=? AND NOT EXISTS(SELECT 1 FROM discord_posted d WHERE d.kind='match' AND d.ref_id=m.id AND d.club_id=m.club_id) ORDER BY m.played_on,m.created_at LIMIT 10`).bind(since).all<{id:string;club_id:string;games:string;an:string;ad:string|null;bn:string;bd:string|null}>()).results;
 let sent=0;
 for(const m of rows){
  let games:[number,number][]=[];try{games=JSON.parse(m.games);}catch{/* an unreadable score is posted without game scores */}
  const aw=games.filter(g=>g[0]>g[1]).length,bw=games.length-aw,aWon=aw>bw,winner=aWon?m.an:m.bn,loser=aWon?m.bn:m.an,name=(n:string,deleted:string|null)=>deleted?'Deleted player':n;
  const w=name(winner,aWon?m.ad:m.bd),l=name(loser,aWon?m.bd:m.ad),score=`${Math.max(aw,bw)}–${Math.min(aw,bw)}`;
  if(await postOnce(env,'match',m.id,m.club_id,{title:`🏓 ${w} beat ${l} ${score}`,description:games.map(g=>aWon?`${g[0]}–${g[1]}`:`${g[1]}–${g[0]}`).join(', '),url:`${SITE}/matches/${m.id}`,timestamp:now},http,now))sent++;
 }
 return sent;
}
type Guild={id:string;name:string;type:number;position?:number};
const needAdmin=async(env:DiscordEnv,viewer:string,clubId:string)=>{const {admin}=await chatAccess(env.DB,viewer,clubId);if(!admin)throw new AppError(403,'Only club organizers can manage the Discord link.');};
async function textChannels(env:DiscordEnv,guildId:string,http:Http){
 const res=await http(`${API}/guilds/${guildId}/channels`,{headers:{Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`}}).catch(()=>null);
 if(!res||!res.ok)throw new AppError(502,'Rally could not read the channels of this Discord server. Check that the Rally bot is still in the server.');
 return ((await res.json()) as Guild[]).filter(c=>c.type===0||c.type===5).sort((a,b)=>(a.position??0)-(b.position??0)).map(c=>({id:c.id,name:c.name}));
}
export async function dropAnnounceWebhook(row:{announce_webhook_id?:string|null;announce_webhook_token?:string|null}|null,http:Http=fetch){
 if(!row?.announce_webhook_id||!row.announce_webhook_token)return;try{await http(`${API}/webhooks/${row.announce_webhook_id}/${row.announce_webhook_token}`,{method:'DELETE'});}catch{/* the webhook may already be gone */}
}
// The channels an organizer can pick for announcements (text channels of the linked server).
export async function listAnnounceChannels(env:DiscordEnv,viewer:string,clubId:string,http:Http=fetch){
 await needAdmin(env,viewer,clubId);
 const link=await env.DB.prepare('SELECT guild_id FROM discord_links WHERE club_id=?').bind(clubId).first<{guild_id:string}>();if(!link)throw new AppError(409,'This club is not linked to Discord.');
 return {channels:await textChannels(env,link.guild_id,http)};
}
// Pick the channel announcements go to (null = the chat channel). Rally makes its own webhook there, so the bot needs Manage Webhooks in that channel.
export async function setAnnounceChannel(env:DiscordEnv,viewer:string,clubId:string,channelId:string|null,http:Http=fetch){
 await needAdmin(env,viewer,clubId);
 const link=await env.DB.prepare('SELECT guild_id,channel_id,announce_webhook_id,announce_webhook_token FROM discord_links WHERE club_id=?').bind(clubId).first<{guild_id:string;channel_id:string;announce_webhook_id:string|null;announce_webhook_token:string|null}>();if(!link)throw new AppError(409,'This club is not linked to Discord.');
 if(!channelId||channelId===link.channel_id){
  await env.DB.prepare("UPDATE discord_links SET announce_channel_id=NULL,announce_channel_name='',announce_webhook_id=NULL,announce_webhook_token=NULL WHERE club_id=?").bind(clubId).run();await dropAnnounceWebhook(link,http);return {ok:true};
 }
 if(!/^\d{5,25}$/.test(channelId))throw new AppError(400,'Choose a channel.');
 const channel=(await textChannels(env,link.guild_id,http)).find(c=>c.id===channelId);if(!channel)throw new AppError(400,'That channel is not in the linked Discord server.');
 const wh=await http(`${API}/channels/${channel.id}/webhooks`,{method:'POST',headers:{Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Rally'})}).catch(()=>null);
 if(!wh||!wh.ok)throw new AppError(409,`Rally could not create a webhook in #${channel.name}. Give the Rally bot the Manage Webhooks and Send Messages permissions in that channel, then try again.`);
 const hook=await wh.json() as {id:string;token:string};
 await env.DB.prepare('UPDATE discord_links SET announce_channel_id=?,announce_channel_name=?,announce_webhook_id=?,announce_webhook_token=? WHERE club_id=?').bind(channel.id,channel.name,hook.id,hook.token,clubId).run();
 await dropAnnounceWebhook(link,http);return {ok:true,channelName:channel.name};
}
// Match results are opt-in. Turning them on starts from now: results already confirmed are marked as posted, not sent.
export async function setAnnounceMatches(env:DiscordEnv,viewer:string,clubId:string,on:boolean,now=new Date().toISOString()){
 await needAdmin(env,viewer,clubId);
 await env.DB.prepare('UPDATE discord_links SET announce_matches=? WHERE club_id=?').bind(on?1:0,clubId).run();
 if(on)await env.DB.prepare("INSERT OR IGNORE INTO discord_posted(kind,ref_id,club_id,posted_at) SELECT 'match',id,club_id,? FROM matches WHERE club_id=? AND status='confirmed' AND tournament_id IS NULL").bind(now,clubId).run();
 return {ok:true};
}
export async function setAnnounce(env:DiscordEnv,viewer:string,clubId:string,on:boolean){
 const {admin}=await chatAccess(env.DB,viewer,clubId);if(!admin)throw new AppError(403,'Only club organizers can manage the Discord link.');
 await env.DB.prepare('UPDATE discord_links SET announce=? WHERE club_id=?').bind(on?1:0,clubId).run();return {ok:true};
}
// ---- Rally side: connect a Discord account ----
export async function createConnectCode(env:DiscordEnv,profileId:string,now=new Date()){
 await env.DB.prepare('DELETE FROM discord_connect_codes WHERE profile_id=? OR expires_at<?').bind(profileId,now.toISOString()).run();
 const code=newConnectCode(),expiresAt=new Date(now.getTime()+CODE_MINUTES*60000).toISOString();
 await env.DB.prepare('INSERT INTO discord_connect_codes(code,profile_id,expires_at) VALUES(?,?,?)').bind(code,profileId,expiresAt).run();return {code,expiresAt};
}
export const connectedDiscord=async(env:DiscordEnv,profileId:string)=>!!await env.DB.prepare('SELECT 1 x FROM discord_accounts WHERE profile_id=?').bind(profileId).first();
export async function disconnectDiscord(env:DiscordEnv,profileId:string){await env.DB.prepare('DELETE FROM discord_accounts WHERE profile_id=?').bind(profileId).run();return {ok:true};}
// The Rally name for a Discord user who connected their account and is still an active member of the club.
export async function rallyNameFor(env:DiscordEnv,discordUserId:string,clubId:string){
 const r=await env.DB.prepare("SELECT p.name FROM discord_accounts a JOIN profiles p ON p.id=a.profile_id AND p.deleted_at IS NULL JOIN memberships m ON m.player_id=p.id AND m.club_id=? AND m.status='active' WHERE a.discord_user_id=?").bind(clubId,discordUserId).first<{name:string}>();
 return r?.name??null;
}
// ---- Opt-in: Rally photo as the Discord avatar ----
export const avatarOptedIn=async(env:DiscordEnv,profileId:string)=>!!await env.DB.prepare('SELECT 1 x FROM discord_avatar_optin WHERE profile_id=?').bind(profileId).first();
export async function setAvatarOptIn(env:DiscordEnv,profileId:string,on:boolean,now=new Date().toISOString()){
 await env.DB.prepare(on?'INSERT OR IGNORE INTO discord_avatar_optin(profile_id,created_at) VALUES(?,?)':'DELETE FROM discord_avatar_optin WHERE profile_id=?').bind(...(on?[profileId,now]:[profileId])).run();return {ok:true};
}
// The public photo URL for a player who opted in and has a photo; the version in the URL changes when the photo does.
export async function avatarUrlFor(env:DiscordEnv,profileId:string){
 const r=await env.DB.prepare('SELECT ph.updated_at v FROM discord_avatar_optin o JOIN profile_photos ph ON ph.player_id=o.profile_id JOIN profiles p ON p.id=o.profile_id AND p.deleted_at IS NULL WHERE o.profile_id=?').bind(profileId).first<{v:string}>();
 return r?`${SITE}/api/players/${encodeURIComponent(profileId)}/photo?v=${encodeURIComponent(r.v)}`:null;
}
// ---- Discord side: /club ----
type Option={name:string;type?:number;value?:unknown;options?:Option[]};
export type ClubInteraction={guild_id?:string;channel_id?:string;channel?:{id:string};member?:{user?:{id:string}};user?:{id:string};data?:{name?:string;options?:Option[]}};
const say=(content:string,ephemeral=false)=>Response.json({type:4,data:{content:content.slice(0,1900),...(ephemeral?{flags:64}:{}),allowed_mentions:{parse:[]}}});
export async function handleClubCommand(env:DiscordEnv,i:ClubInteraction,now=new Date()):Promise<Response>{
 const sub=i.data?.options?.[0],channel=i.channel?.id??i.channel_id,user=i.member?.user?.id??i.user?.id;
 if(sub?.name==='connect'){
  const code=String(sub.options?.find(o=>o.name==='code')?.value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6||!user)return say('Enter the 6 character code from Rally (Account > Discord).',true);
  const row=await env.DB.prepare('SELECT c.profile_id,p.name FROM discord_connect_codes c JOIN profiles p ON p.id=c.profile_id AND p.deleted_at IS NULL WHERE c.code=? AND c.expires_at>?').bind(code,now.toISOString()).first<{profile_id:string;name:string}>();
  if(!row)return say('That code is wrong or has expired. Generate a new one in Rally.',true);
  const taken=await env.DB.prepare('SELECT profile_id FROM discord_accounts WHERE discord_user_id=?').bind(user).first<{profile_id:string}>();
  if(taken&&taken.profile_id!==row.profile_id)return say('This Discord account is already connected to another Rally player. Disconnect it in Rally first.',true);
  await env.DB.batch([env.DB.prepare('DELETE FROM discord_accounts WHERE profile_id=?').bind(row.profile_id),env.DB.prepare('INSERT INTO discord_accounts(profile_id,discord_user_id,created_at) VALUES(?,?,?)').bind(row.profile_id,user,now.toISOString()),env.DB.prepare('DELETE FROM discord_connect_codes WHERE code=?').bind(code)]);
  return say(`Connected to the Rally player ${row.name}. Your messages in linked club channels will show that name.`,true);
 }
 if(sub?.name!=='leaderboard'&&sub?.name!=='next'&&sub?.name!=='player')return say('Use /club leaderboard, /club next, /club player or /club connect.',true);
 if(sub.name==='player'){
  const name=String(sub.options?.find(o=>o.name==='name')?.value??'').trim().slice(0,60);if(!name)return say('Give a player name.',true);
  const board=await getPublicLeaderboard(env.DB,{search:name});const p=board.players.find(x=>x.name.toLowerCase()===name.toLowerCase())??board.players[0];
  if(!p)return say(`No Rally player matches "${name}".`,true);
  return say(`**${p.name}** · ${p.rating===null?'unrated':`rating ${p.rating}${p.rank?` (#${p.rank})`:''}`} · ${p.wins}W–${p.losses}L\n${SITE}/players/${p.id}`);
 }
 const link=channel?await env.DB.prepare('SELECT l.club_id,c.name FROM discord_links l JOIN clubs c ON c.id=l.club_id WHERE l.channel_id=?').bind(channel).first<{club_id:string;name:string}>():null;
 if(!link)return say('This channel is not linked to a Rally club. A club organizer can link it from the club page (Manage > Discord).',true);
 if(sub.name==='leaderboard'){
  const board=await getPublicLeaderboard(env.DB,{club:link.club_id}),top=board.players.filter(p=>p.rank!==null).slice(0,10);
  if(!top.length)return say(`${link.name} has no rated players yet.`);
  return say(`**${link.name} leaderboard**\n${top.map(p=>`${p.rank}. ${p.name}: ${p.rating} (${p.wins}W–${p.losses}L)`).join('\n')}\n${SITE}/clubs/${link.club_id}`);
 }
 const iso=now.toISOString(),sessions=(await env.DB.prepare("SELECT title,starts_at FROM club_sessions WHERE club_id=? AND status='scheduled' AND ends_at>? ORDER BY starts_at LIMIT 3").bind(link.club_id,iso).all<{title:string;starts_at:string}>()).results,
  events=(await env.DB.prepare("SELECT name,date FROM tournaments WHERE club_id=? AND status IN ('registration','active') AND deleted_at IS NULL AND date>=? ORDER BY date LIMIT 3").bind(link.club_id,iso.slice(0,10)).all<{name:string;date:string}>()).results;
 if(!sessions.length&&!events.length)return say(`Nothing is scheduled for ${link.name} yet.`);
 return say(`**Coming up at ${link.name}**\n${sessions.map(s=>`🏓 ${s.title}: <t:${Math.floor(Date.parse(s.starts_at)/1000)}:F>`).join('\n')}${sessions.length&&events.length?'\n':''}${events.map(e=>`🏆 ${e.name}: ${e.date}`).join('\n')}`);
}
