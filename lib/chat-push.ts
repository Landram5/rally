import {buildPushPayload} from '@block65/webcrypto-web-push';
import {validateSubscription} from './push-subscriptions';
import type {ChatMessage} from './chat';
// Push alerts for members who turned them on for this club, who are not in the chat right now, at most one every 10 minutes.
export async function pushChatMessage(env:Pick<Cloudflare.Env,'DB'|'VAPID_PUBLIC_KEY'|'VAPID_PRIVATE_KEY'|'VAPID_SUBJECT'>,message:ChatMessage,online:string[],now=Date.now()){
 if(!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT))return;
 const club=await env.DB.prepare('SELECT name FROM clubs WHERE id=?').bind(message.clubId).first<{name:string}>();if(!club)return;
 const since=new Date(now-600000).toISOString();
 const members=(await env.DB.prepare("SELECT cm.player_id FROM chat_members cm JOIN memberships m ON m.club_id=cm.club_id AND m.player_id=cm.player_id AND m.status='active' JOIN profiles p ON p.id=cm.player_id AND p.deleted_at IS NULL WHERE cm.club_id=? AND cm.notify=1 AND cm.player_id<>? AND cm.last_push_at<? LIMIT 100").bind(message.clubId,message.authorId??'',since).all<{player_id:string}>()).results.filter(r=>!online.includes(r.player_id));
 const detail=`${message.authorName}: ${message.body?message.body.slice(0,120):message.media?.kind==='video'?'Sent a video':'Sent a photo'}`;
 for(const member of members){
  await env.DB.prepare('UPDATE chat_members SET last_push_at=? WHERE club_id=? AND player_id=?').bind(new Date(now).toISOString(),message.clubId,member.player_id).run();
  const devices=(await env.DB.prepare('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE player_id=? LIMIT 5').bind(member.player_id).all<{id:string;endpoint:string;p256dh:string;auth:string}>()).results;
  for(const d of devices){
   try{
    const sub=validateSubscription({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}}),payload=await buildPushPayload({data:JSON.stringify({id:`chat-${message.clubId}`,title:club.name,detail,href:`/clubs/${message.clubId}?section=chat`}),options:{ttl:600}},sub,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
    const res=await fetch(sub.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(10000)});
    if(res.status===404||res.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=? AND player_id=?').bind(d.id,member.player_id).run();
   }catch{console.error('Chat push unavailable');}
  }
 }
}
