import {AppError} from './rally-errors';
import {chatAccess} from './chat';
import type {ChatMessage} from './chat';
import {publishChat} from './chat-room';
import {pushChatMessage} from './chat-push';
import {handleClubCommand,rallyNameFor,avatarUrlFor,dropAnnounceWebhook,RALLY_AVATAR} from './discord-club';
// Discord bridge. A club's chat is linked to one Discord channel:
//  - Rally -> Discord: each new club chat message is posted through a channel webhook under the sender's name.
//  - Discord -> Rally: the gateway connection (lib/discord-gateway.ts) hands each message from the channel to ingestDiscordMessage.
//  - /rally link <code>, /rally unlink and /rally status arrive as signed HTTP interactions.
export const DISCORD_API='https://discord.com/api/v10';
export const BRIDGE_PROFILE='discord-bridge';
export const LINK_CODE_MINUTES=15;
const MAX=2000;
export type DiscordEnv={DB:D1Database;DISCORD_BOT_TOKEN?:string;DISCORD_PUBLIC_KEY?:string;DISCORD_APP_ID?:string;CHAT_ROOM?:DurableObjectNamespace;DISCORD_GATEWAY?:DurableObjectNamespace;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string};
type Http=typeof fetch;
export const discordConfigured=(env:Pick<DiscordEnv,'DISCORD_BOT_TOKEN'|'DISCORD_PUBLIC_KEY'>)=>!!(env.DISCORD_BOT_TOKEN?.trim()&&env.DISCORD_PUBLIC_KEY?.trim());
// Permissions the bot asks for when invited: view channel, send messages, read history, manage webhooks.
export const inviteUrl=(appId?:string)=>appId&&/^\d{5,25}$/.test(appId)?`https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=536939520&scope=bot%20applications.commands`:null;
const hex=(s:string)=>Uint8Array.from(s.match(/.{1,2}/g)?.map(b=>parseInt(b,16))??[]);
// Discord signs every interaction (Ed25519 over timestamp + body). Anything unsigned or wrongly signed is rejected.
export async function verifyInteraction(publicKey:string,signature:string|null,timestamp:string|null,body:string){
 if(!signature||!timestamp||!/^[0-9a-f]{128}$/i.test(signature)||!/^[0-9a-f]{64}$/i.test(publicKey))return false;
 try{const key=await crypto.subtle.importKey('raw',hex(publicKey),{name:'Ed25519'},false,['verify']);return await crypto.subtle.verify({name:'Ed25519'},key,hex(signature),new TextEncoder().encode(timestamp+body));}catch{return false;}
}
type DiscordUser={id:string;username:string;global_name?:string|null;bot?:boolean};
export type DiscordMessage={id:string;channel_id:string;content:string;type?:number;webhook_id?:string;author:DiscordUser;member?:{nick?:string|null};mentions?:DiscordUser[];attachments?:{url:string;filename:string}[]};
// Turns Discord markup into plain text: mentions become names, @everyone/@here lose their ping, custom emoji keep their name.
export function cleanContent(msg:Pick<DiscordMessage,'content'|'mentions'>){
 const names=new Map((msg.mentions??[]).map(u=>[u.id,u.global_name||u.username]));
 return (msg.content??'').replace(/<@!?(\d+)>/g,(_,id:string)=>'@'+(names.get(id)??'user')).replace(/<@&\d+>/g,'@role').replace(/<#\d+>/g,'#channel').replace(/<a?:(\w+):\d+>/g,':$1:').replace(/@(everyone|here)/g,'@​$1').trim();
}
const displayName=(m:DiscordMessage)=>(m.member?.nick||m.author.global_name||m.author.username||'Someone').replace(/\s+/g,' ').trim().slice(0,40)||'Someone';
// Webhook usernames may not contain "discord" or "clyde".
const webhookName=(name:string)=>name.replace(/discord/gi,'Disc0rd').replace(/clyde/gi,'Cl​yde').slice(0,80)||'Rally member';
export const newCode=()=>{const a=crypto.getRandomValues(new Uint8Array(6)),chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...a].map(b=>chars[b%chars.length]).join('');};
// ---- Rally side: link management for organizers ----
export async function discordStatus(env:DiscordEnv,viewer:string,clubId:string){
 const {admin}=await chatAccess(env.DB,viewer,clubId);if(!admin)throw new AppError(403,'Only club organizers can manage the Discord link.');
 const link=await env.DB.prepare('SELECT channel_name,guild_id,created_at,announce,announce_matches,announce_channel_id,announce_channel_name,match_channel_id,match_channel_name FROM discord_links WHERE club_id=?').bind(clubId).first<{channel_name:string;guild_id:string;created_at:string;announce:number;announce_matches:number;announce_channel_id:string|null;announce_channel_name:string;match_channel_id:string|null;match_channel_name:string}>();
 return {configured:discordConfigured(env),inviteUrl:inviteUrl(env.DISCORD_APP_ID),link:link?{channelName:link.channel_name,linkedAt:link.created_at,announce:!!link.announce,announceMatches:!!link.announce_matches,announceChannel:link.announce_channel_id?{id:link.announce_channel_id,name:link.announce_channel_name}:null,matchChannel:link.match_channel_id?{id:link.match_channel_id,name:link.match_channel_name}:null}:null};
}
export async function createLinkCode(env:DiscordEnv,viewer:string,clubId:string,now=new Date()){
 const {admin}=await chatAccess(env.DB,viewer,clubId);if(!admin)throw new AppError(403,'Only club organizers can manage the Discord link.');
 if(!discordConfigured(env))throw new AppError(409,'The Discord bot is not set up for Rally yet.');
 await env.DB.prepare('DELETE FROM discord_link_codes WHERE club_id=? OR expires_at<?').bind(clubId,now.toISOString()).run();
 const code=newCode(),expires=new Date(now.getTime()+LINK_CODE_MINUTES*60000).toISOString();
 await env.DB.prepare('INSERT INTO discord_link_codes(code,club_id,created_by,expires_at) VALUES(?,?,?,?)').bind(code,clubId,viewer,expires).run();
 return {code,expiresAt:expires};
}
async function dropWebhook(link:{webhook_id:string;webhook_token:string}|null,http:Http){
 if(!link)return;try{await http(`${DISCORD_API}/webhooks/${link.webhook_id}/${link.webhook_token}`,{method:'DELETE'});}catch{/* the webhook may already be gone */}
}
export async function unlinkClub(env:DiscordEnv,viewer:string,clubId:string,http:Http=fetch){
 const {admin}=await chatAccess(env.DB,viewer,clubId);if(!admin)throw new AppError(403,'Only club organizers can manage the Discord link.');
 const link=await env.DB.prepare('SELECT webhook_id,webhook_token,announce_webhook_id,announce_webhook_token,match_webhook_id,match_webhook_token FROM discord_links WHERE club_id=?').bind(clubId).first<{webhook_id:string;webhook_token:string;announce_webhook_id:string|null;announce_webhook_token:string|null;match_webhook_id:string|null;match_webhook_token:string|null}>();
 await env.DB.prepare('DELETE FROM discord_links WHERE club_id=?').bind(clubId).run();await dropWebhook(link,http);await dropAnnounceWebhook(link,http);return {ok:true};
}
// ---- Discord side: slash commands ----
const ADMINISTRATOR=BigInt(8),MANAGE_GUILD=BigInt(32);
type Interaction={type:number;user?:{id:string};guild_id?:string;channel_id?:string;channel?:{id:string;name?:string};member?:{permissions?:string;user?:{id:string}};data?:{name?:string;options?:{name:string;type?:number;value?:unknown;options?:{name:string;value?:unknown}[]}[]}};
const say=(content:string)=>Response.json({type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
export async function handleInteraction(env:DiscordEnv,i:Interaction,http:Http=fetch,now=new Date()):Promise<Response>{
 if(i.type===1)return Response.json({type:1});
 if(i.type===2&&i.data?.name==='club')return handleClubCommand(env,i,now);
 if(i.type!==2||i.data?.name!=='rally')return say('That command is not available.');
 const sub=i.data.options?.[0],guild=i.guild_id,channel=i.channel?.id??i.channel_id;
 if(!guild||!channel)return say('Use this command in a server channel.');
 let perms=BigInt(0);try{perms=BigInt(i.member?.permissions??'0');}catch{/* treated as no permissions */}
 if(!((perms&(ADMINISTRATOR|MANAGE_GUILD))>BigInt(0)))return say('Only people with the Manage Server permission can link Rally to this channel.');
 const existing=await env.DB.prepare('SELECT club_id,webhook_id,webhook_token,channel_id,announce_webhook_id,announce_webhook_token,match_webhook_id,match_webhook_token FROM discord_links WHERE channel_id=?').bind(channel).first<{club_id:string;webhook_id:string;webhook_token:string;channel_id:string;announce_webhook_id:string|null;announce_webhook_token:string|null;match_webhook_id:string|null;match_webhook_token:string|null}>();
 if(sub?.name==='status'){
  if(!existing)return say('This channel is not linked to a Rally club. In Rally, open your club, choose Manage, and generate a link code, then run /rally link here.');
  const club=await env.DB.prepare('SELECT name FROM clubs WHERE id=?').bind(existing.club_id).first<{name:string}>();return say(`This channel is linked to the Rally club ${club?.name??'(unknown)'}. Messages go both ways.`);
 }
 if(sub?.name==='unlink'){
  if(!existing)return say('This channel is not linked to a Rally club.');
  await env.DB.prepare('DELETE FROM discord_links WHERE channel_id=?').bind(channel).run();await dropWebhook(existing,http);await dropAnnounceWebhook(existing,http);return say('Unlinked. Rally messages will no longer appear here.');
 }
 if(sub?.name!=='link')return say('Use /rally link, /rally unlink or /rally status.');
 const code=String(sub.options?.find(o=>o.name==='code')?.value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(code.length!==6)return say('Enter the 6 character code shown in Rally (club > Manage > Discord).');
 const row=await env.DB.prepare('SELECT c.club_id,cl.name,cl.approval_status FROM discord_link_codes c JOIN clubs cl ON cl.id=c.club_id WHERE c.code=? AND c.expires_at>?').bind(code,now.toISOString()).first<{club_id:string;name:string;approval_status:string}>();
 if(!row||row.approval_status==='rejected')return say('That code is wrong or has expired. Generate a new one in Rally.');
 if(existing&&existing.club_id!==row.club_id)return say('This channel is already linked to another Rally club. Run /rally unlink first.');
 const wh=await http(`${DISCORD_API}/channels/${channel}/webhooks`,{method:'POST',headers:{Authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Rally'})}).catch(()=>null);
 if(!wh||!wh.ok)return say('Rally could not create a webhook here. Give the Rally bot the Manage Webhooks and Send Messages permissions in this channel, then try again.');
 const hook=await wh.json() as {id:string;token:string};
 const previous=await env.DB.prepare('SELECT webhook_id,webhook_token,announce_webhook_id,announce_webhook_token,match_webhook_id,match_webhook_token FROM discord_links WHERE club_id=?').bind(row.club_id).first<{webhook_id:string;webhook_token:string;announce_webhook_id:string|null;announce_webhook_token:string|null;match_webhook_id:string|null;match_webhook_token:string|null}>();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM discord_links WHERE club_id=? OR channel_id=?').bind(row.club_id,channel),
  env.DB.prepare('INSERT INTO discord_links(club_id,guild_id,channel_id,channel_name,webhook_id,webhook_token,created_at) VALUES(?,?,?,?,?,?,?)').bind(row.club_id,guild,channel,i.channel?.name??'',hook.id,hook.token,now.toISOString()),
  env.DB.prepare('DELETE FROM discord_link_codes WHERE code=?').bind(code),
 ]);
 await dropWebhook(previous,http);await dropAnnounceWebhook(previous,http);
 try{await env.DISCORD_GATEWAY?.get(env.DISCORD_GATEWAY.idFromName('main')).fetch('https://gateway/ensure');}catch{/* the scheduled job will start it */}
 return say(`Linked to the Rally club ${row.name}. Messages in this channel and in the club chat now appear in both places.`);
}
// ---- Rally -> Discord ----
export async function relayToDiscord(env:DiscordEnv,message:ChatMessage,http:Http=fetch){
 if(!message.authorId)return false;
 const link=await env.DB.prepare('SELECT webhook_id,webhook_token FROM discord_links WHERE club_id=?').bind(message.clubId).first<{webhook_id:string;webhook_token:string}>();if(!link)return false;
 const note=message.media?(message.media.kind==='video'?'🎥 Shared a video in Rally':'📷 Shared a photo in Rally'):'';
 const content=[message.body,note].filter(Boolean).join('\n').slice(0,MAX);if(!content)return false;
 const avatar=await avatarUrlFor(env,message.authorId);
 try{
  const res=await http(`${DISCORD_API}/webhooks/${link.webhook_id}/${link.webhook_token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:webhookName(message.authorName),content,allowed_mentions:{parse:[]},avatar_url:avatar??RALLY_AVATAR})});
  // The webhook was deleted in Discord: stop relaying until it is linked again.
  if(res.status===404||res.status===401)await env.DB.prepare('DELETE FROM discord_links WHERE club_id=?').bind(message.clubId).run();
  return res.ok;
 }catch{console.error('Discord relay unavailable');return false;}
}
// ---- Discord -> Rally ----
export async function ingestDiscordMessage(env:DiscordEnv,msg:DiscordMessage,now=new Date().toISOString()){
 if(msg.author?.bot||msg.webhook_id||(msg.type!==undefined&&msg.type!==0&&msg.type!==19))return null;
 const link=await env.DB.prepare('SELECT club_id FROM discord_links WHERE channel_id=?').bind(msg.channel_id).first<{club_id:string}>();if(!link)return null;
 const files=(msg.attachments??[]).slice(0,4).map(a=>`📎 ${a.filename}: ${a.url}`),body=[cleanContent(msg),...files].filter(Boolean).join('\n').slice(0,MAX);if(!body)return null;
 const name=(msg.author?.id?await rallyNameFor(env,msg.author.id,link.club_id):null)||displayName(msg),id=crypto.randomUUID();
 const res=await env.DB.prepare('INSERT OR IGNORE INTO chat_messages(id,club_id,author_id,author_name,body,client_id,created_at,source,external_name) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,link.club_id,BRIDGE_PROFILE,name,body,'discord-'+msg.id,now,'discord',name).run();
 if(!res.meta?.changes)return null;
 const message:ChatMessage={id,clubId:link.club_id,authorId:null,authorName:`${name} (Discord)`,body,createdAt:now,media:null,mine:false,canDelete:false};
 const online=await publishChat(env,link.club_id,{type:'message',message});await pushChatMessage(env as Parameters<typeof pushChatMessage>[0],message,online);
 return message;
}
