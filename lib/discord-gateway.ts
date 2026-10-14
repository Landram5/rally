import {DurableObject} from 'cloudflare:workers';
import {ingestDiscordMessage,type DiscordMessage} from './discord';
// Keeps one connection to Discord's gateway open so messages in linked channels reach Rally as they are written.
// The scheduled job (and every /rally link) calls /ensure; an alarm reconnects within a minute if the connection drops.
// Needs the "Message Content" privileged intent switched on for the bot in the Discord developer portal.
const GATEWAY='https://gateway.discord.gg/?v=10&encoding=json';
const INTENTS=(1<<0)|(1<<9)|(1<<15); // guilds, guild messages, message content
const OP={DISPATCH:0,HEARTBEAT:1,IDENTIFY:2,RESUME:6,RECONNECT:7,INVALID:9,HELLO:10,ACK:11};
type Frame={op:number;d:unknown;s:number|null;t:string|null};
export class DiscordGateway extends DurableObject<Cloudflare.Env>{
 private ws:WebSocket|null=null;private seq:number|null=null;private session:string|null=null;private resumeUrl:string|null=null;private beat:ReturnType<typeof setInterval>|null=null;private acked=true;private connecting=false;
 async fetch(request:Request){
  const url=new URL(request.url);
  if(url.pathname==='/ensure'){await this.ensure();return Response.json({connected:this.open()});}
  if(url.pathname==='/status')return Response.json({connected:this.open(),session:!!this.session});
  return new Response('Not found',{status:404});
 }
 private open(){return this.ws?.readyState===WebSocket.OPEN;}
 async alarm(){await this.ensure();}
 private async ensure(){
  if(!this.env.DISCORD_BOT_TOKEN?.trim())return;
  // Only stay connected while at least one club is linked.
  if(!await this.env.DB.prepare('SELECT 1 x FROM discord_links LIMIT 1').first()){try{this.ws?.close(1000,'No links');}catch{/* already closed */}await this.ctx.storage.deleteAlarm();return;}
  await this.ctx.storage.setAlarm(Date.now()+60000);
  if(this.open()||this.connecting)return;
  this.connecting=true;
  try{
   const base=this.resumeUrl?this.resumeUrl.replace(/^wss?:/,m=>m==='wss:'?'https:':'http:'):(this.env.DISCORD_GATEWAY_URL||GATEWAY);
   const res=await fetch(base.includes('?')?base:base+'/?v=10&encoding=json',{headers:{Upgrade:'websocket'}});
   const ws=res.webSocket;if(!ws){console.error('Discord gateway refused the connection');return;}
   ws.accept();this.ws=ws;this.acked=true;
   ws.addEventListener('message',e=>{void this.onFrame(String(e.data));});
   ws.addEventListener('close',e=>this.onClose(e.code));
   ws.addEventListener('error',()=>this.onClose(0));
  }catch{console.error('Discord gateway unavailable');}
  finally{this.connecting=false;}
 }
 private onClose(code:number){
  if(this.beat){clearInterval(this.beat);this.beat=null;}
  this.ws=null;
  // 4004 bad token, 4013/4014 bad or missing intents: retrying cannot help.
  if([4004,4010,4011,4012,4013,4014].includes(code)){console.error('Discord gateway closed for good',code);void this.ctx.storage.deleteAlarm();return;}
  if(code===4007||code===4009){this.session=null;this.seq=null;this.resumeUrl=null;}
 }
 private send(op:number,d:unknown){try{this.ws?.send(JSON.stringify({op,d}));}catch{/* the close handler reconnects */}}
 private async onFrame(raw:string){
  let f:Frame;try{f=JSON.parse(raw) as Frame;}catch{return;}
  if(f.s!==null&&f.s!==undefined)this.seq=f.s;
  switch(f.op){
   case OP.HELLO:{
    const interval=(f.d as {heartbeat_interval:number}).heartbeat_interval;
    if(this.beat)clearInterval(this.beat);
    this.beat=setInterval(()=>{if(!this.acked){try{this.ws?.close(4000,'No heartbeat ack');}catch{/* already closed */}return;}this.acked=false;this.send(OP.HEARTBEAT,this.seq);},interval);
    if(this.session&&this.seq!==null)this.send(OP.RESUME,{token:this.env.DISCORD_BOT_TOKEN,session_id:this.session,seq:this.seq});
    else this.send(OP.IDENTIFY,{token:this.env.DISCORD_BOT_TOKEN,intents:INTENTS,properties:{os:'cloudflare',browser:'rally',device:'rally'}});
    break;}
   case OP.HEARTBEAT:this.send(OP.HEARTBEAT,this.seq);break;
   case OP.ACK:this.acked=true;break;
   case OP.RECONNECT:try{this.ws?.close(4000,'Reconnect requested');}catch{/* already closed */}break;
   case OP.INVALID:if(!f.d){this.session=null;this.seq=null;this.resumeUrl=null;}try{this.ws?.close(4000,'Invalid session');}catch{/* already closed */}break;
   case OP.DISPATCH:
    if(f.t==='READY'){const r=f.d as {session_id:string;resume_gateway_url:string};this.session=r.session_id;this.resumeUrl=r.resume_gateway_url;}
    else if(f.t==='MESSAGE_CREATE'){try{await ingestDiscordMessage(this.env,f.d as DiscordMessage);}catch(e){console.error('Discord message not ingested',e);}}
    break;
  }
 }
}
