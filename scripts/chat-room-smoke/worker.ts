// Local smoke test harness for the chat room and chat media (no auth, fake in-memory database). Run through scripts/chat-room-smoke.mjs.
import {serveChatMedia,uploadChatMedia} from '../../lib/chat-media';
export {ChatRoom} from '../../lib/chat-room';
type Env={CHAT_ROOM:DurableObjectNamespace;CHAT_MEDIA:R2Bucket};
const media=new Map<string,Record<string,unknown>>();
const fakeDb={prepare(sql:string){let args:unknown[]=[];const stmt={bind(...a:unknown[]){args=a;return stmt;},
 async first(){
  if(sql.includes('FROM memberships'))return {role:'member',muted:0};
  if(sql.includes('count(*)'))return {n:0};
  if(sql.includes('FROM chat_media cm'))return media.get(String(args[0]))??null;
  return null;},
 async run(){if(sql.startsWith('INSERT INTO chat_media')){const [id,club,uploader,kind,type,bytes,key,at]=args;media.set(String(id),{club_id:club,r2_key:key,content_type:type,bytes,attached_at:at,uploader_id:uploader,deleted_at:null});}return {success:true};}};return stmt;}} as unknown as D1Database;
export default {async fetch(request:Request,env:Env){
 const url=new URL(request.url);
 if(url.pathname==='/upload')try{return Response.json(await uploadChatMedia({DB:fakeDb,CHAT_MEDIA:env.CHAT_MEDIA},'p1','club1',request));}catch(e){return Response.json({error:(e as Error).message,status:(e as {status?:number}).status},{status:(e as {status?:number}).status??500});}
 if(url.pathname.startsWith('/media/'))try{return await serveChatMedia({DB:fakeDb,CHAT_MEDIA:env.CHAT_MEDIA},'p1',url.pathname.slice(7),request.headers.get('range'));}catch(e){return new Response((e as Error).message,{status:(e as {status?:number}).status??500});}
 const room=env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(url.searchParams.get('club')??'a'));
 const h=new Headers(request.headers),p=url.searchParams.get('player');if(p)h.set('x-chat-player',p);
 return room.fetch(new Request('https://room'+url.pathname,{method:request.method,headers:h,body:request.method==='POST'?request.body:undefined}));
}};
