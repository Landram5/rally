import {AppError} from './rally-errors';
import {CHAT_LIMITS,chatAccess} from './chat';
// Chat photos and videos. Files live in R2; only members of the club can upload or watch them.
// Videos are not converted, so upload limits (50 MB, about 30 seconds) keep playback working on most phones.
export function sniffMedia(b:Uint8Array):{kind:'image'|'video';contentType:string}|null{
 const at=(i:number,s:string)=>[...s].every((c,k)=>b[i+k]===c.charCodeAt(0));
 if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return {kind:'image',contentType:'image/jpeg'};
 if(b[0]===0x89&&at(1,'PNG'))return {kind:'image',contentType:'image/png'};
 if(at(0,'GIF8'))return {kind:'image',contentType:'image/gif'};
 if(at(0,'RIFF')&&at(8,'WEBP'))return {kind:'image',contentType:'image/webp'};
 if(at(4,'ftyp'))return {kind:'video',contentType:at(8,'qt  ')?'video/quicktime':'video/mp4'};
 if(b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3)return {kind:'video',contentType:'video/webm'};
 return null;
}
export async function uploadChatMedia(env:{DB:D1Database;CHAT_MEDIA:R2Bucket},viewer:string,clubId:string,request:Request,now=new Date().toISOString()){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(clubId))throw new AppError(400,'Invalid club.');
 const {muted}=await chatAccess(env.DB,viewer,clubId);if(muted)throw new AppError(403,'You are muted in this chat.');
 const length=Number(request.headers.get('content-length')),body=request.body;
 if(!body||!Number.isSafeInteger(length)||length<=0)throw new AppError(411,'Choose a photo or video to upload.');
 if(length>CHAT_LIMITS.videoBytes)throw new AppError(413,'Files can be up to 50 MB. Photos up to 8 MB, videos about 30 seconds.');
 const pending=(await env.DB.prepare("SELECT count(*) n FROM chat_media WHERE uploader_id=? AND attached_at IS NULL AND created_at>?").bind(viewer,new Date(Date.parse(now)-3600000).toISOString()).first<{n:number}>())?.n??0;
 if(pending>=10)throw new AppError(429,'Send or remove your earlier attachments before adding more.');
 const reader=body.getReader(),head:Uint8Array[]=[];let got=0;
 while(got<16){const {value,done}=await reader.read();if(done)break;head.push(value);got+=value.length;}
 const first=new Uint8Array(got);let off=0;for(const c of head){first.set(c,off);off+=c.length;}
 const found=sniffMedia(first);if(!found)throw new AppError(415,'Upload a JPEG, PNG, GIF, WebP photo or an MP4, MOV or WebM video.');
 if(found.kind==='image'&&length>CHAT_LIMITS.imageBytes)throw new AppError(413,'Photos can be up to 8 MB.');
 const mediaId=crypto.randomUUID(),key=`chat/${clubId}/${mediaId}`,fixed=new FixedLengthStream(length),writer=fixed.writable.getWriter();
 const pump=(async()=>{try{for(const c of head)await writer.write(c);for(;;){const {value,done}=await reader.read();if(done)break;await writer.write(value);}await writer.close();}catch(e){await writer.abort(e).catch(()=>{});throw e;}})();
 try{await Promise.all([env.CHAT_MEDIA.put(key,fixed.readable,{httpMetadata:{contentType:found.contentType}}),pump]);}
 catch{await env.CHAT_MEDIA.delete(key).catch(()=>{});throw new AppError(400,'The upload did not finish. Please try again.');}
 try{await env.DB.prepare('INSERT INTO chat_media(id,club_id,uploader_id,kind,content_type,bytes,r2_key,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(mediaId,clubId,viewer,found.kind,found.contentType,length,key,now).run();}
 catch(e){await env.CHAT_MEDIA.delete(key).catch(()=>{});throw e;}
 return {id:mediaId,kind:found.kind,contentType:found.contentType,bytes:length};
}
// "bytes=0-99", "bytes=100-" and "bytes=-500" (the last 500 bytes). Returns null for anything else so the whole file is sent.
export function parseRange(header:string|null,size:number):{offset:number;length:number}|'invalid'|null{
 const m=header?.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))return null;
 let start:number,end:number;
 if(!m[1]){const n=Number(m[2]);if(!n)return 'invalid';start=Math.max(0,size-n);end=size-1;}
 else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
 if(start>=size||start>end)return 'invalid';
 return {offset:start,length:end-start+1};
}
export async function serveChatMedia(env:{DB:D1Database;CHAT_MEDIA:R2Bucket},viewer:string,mediaId:string,rangeHeader:string|null){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(mediaId))throw new AppError(404,'Not found.');
 const m=await env.DB.prepare('SELECT cm.club_id,cm.r2_key,cm.content_type,cm.bytes,cm.attached_at,cm.uploader_id,msg.deleted_at FROM chat_media cm LEFT JOIN chat_messages msg ON msg.media_id=cm.id WHERE cm.id=?').bind(mediaId).first<{club_id:string;r2_key:string;content_type:string;bytes:number;attached_at:string|null;uploader_id:string;deleted_at:string|null}>();
 if(!m||m.deleted_at||(!m.attached_at&&m.uploader_id!==viewer))throw new AppError(404,'Not found.');
 await chatAccess(env.DB,viewer,m.club_id);
 const range=parseRange(rangeHeader,m.bytes);
 if(range==='invalid')return new Response(null,{status:416,headers:{'Content-Range':`bytes */${m.bytes}`}});
 const object=await env.CHAT_MEDIA.get(m.r2_key,range?{range}:undefined);if(!object)throw new AppError(404,'Not found.');
 const headers=new Headers({'Content-Type':m.content_type,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",ETag:object.httpEtag,'Content-Length':String(range?range.length:m.bytes)});
 if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${m.bytes}`);return new Response((object as R2ObjectBody).body,{status:206,headers});}
 return new Response((object as R2ObjectBody).body,{headers});
}
// Attachments uploaded but never sent are removed after a day. Run from the scheduled job.
export async function cleanupChatMedia(env:{DB:D1Database;CHAT_MEDIA?:R2Bucket},now=Date.now()){
 if(!env.CHAT_MEDIA)return;
 const rows=(await env.DB.prepare('SELECT id,r2_key FROM chat_media WHERE attached_at IS NULL AND created_at<? LIMIT 50').bind(new Date(now-86400000).toISOString()).all<{id:string;r2_key:string}>()).results;
 for(const r of rows){await env.CHAT_MEDIA.delete(r.r2_key);await env.DB.prepare('DELETE FROM chat_media WHERE id=? AND attached_at IS NULL').bind(r.id).run();}
}
