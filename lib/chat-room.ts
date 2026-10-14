import {DurableObject} from 'cloudflare:workers';
// One room per club. It only fans events out to connected members; messages are saved and authorised in the API before they reach it.
// Connections expire after 15 minutes so the client reconnects and membership is checked again.
const LIFETIME_MS=15*60*1000;
export class ChatRoom extends DurableObject<Cloudflare.Env>{
 async fetch(request:Request){
  const url=new URL(request.url);
  if(url.pathname==='/publish'&&request.method==='POST'){
   const event=await request.text(),now=Date.now(),online=new Set<string>();
   for(const ws of this.ctx.getWebSockets()){
    const meta=ws.deserializeAttachment() as {playerId:string;expires:number}|null;
    if(!meta||meta.expires<now){try{ws.close(4000,'Reconnect')}catch{/* already closed */}continue;}
    try{ws.send(event);online.add(meta.playerId);}catch{/* the socket closed while sending */}
   }
   return Response.json({online:[...online]});
  }
  if(url.pathname==='/connect'&&request.headers.get('Upgrade')==='websocket'){
   const player=request.headers.get('x-chat-player');if(!player)return new Response('Forbidden',{status:403});
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);
   this.ctx.acceptWebSocket(server);server.serializeAttachment({playerId:player,expires:Date.now()+LIFETIME_MS});
   return new Response(null,{status:101,webSocket:client});
  }
  return new Response('Not found',{status:404});
 }
 webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){if(message==='ping')ws.send('pong');}
 webSocketClose(ws:WebSocket,code:number){try{ws.close(code===1005?1000:code)}catch{/* already closed */}}
}
// Sends one event to everyone connected to a club's room and returns who was online.
export async function publishChat(env:{CHAT_ROOM?:DurableObjectNamespace},clubId:string,event:unknown):Promise<string[]>{
 if(!env.CHAT_ROOM)return [];
 try{const res=await env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(clubId)).fetch('https://room/publish',{method:'POST',body:JSON.stringify(event)});return ((await res.json()) as {online:string[]}).online;}
 catch{console.error('Chat live delivery unavailable');return [];}
}
