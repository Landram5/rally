'use client';
/* eslint-disable @next/next/no-img-element */
// Shared by club chat, direct messages and leader rooms: choosing, checking, shrinking and uploading a photo or video, and showing one.
export type Attachment={id:string;kind:'image'|'video';contentType:string;bytes:number;preview:string};
export const MAX_VIDEO=50*1024*1024,MAX_VIDEO_SECONDS=35;
// Photos are shrunk on the phone before upload (max 1600px, JPEG); GIFs and small photos are sent as they are.
export async function shrinkImage(file:File):Promise<Blob>{
 if(file.type==='image/gif'||file.size<400_000)return file;
 try{
  const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(res=>canvas.toBlob(res,'image/jpeg',0.82));return blob&&blob.size<file.size?blob:file;
 }catch{return file;}
}
export function videoSeconds(file:File):Promise<number>{
 return new Promise(resolve=>{const v=document.createElement('video'),url=URL.createObjectURL(file);v.preload='metadata';v.onloadedmetadata=()=>{resolve(v.duration);URL.revokeObjectURL(url)};v.onerror=()=>{resolve(NaN);URL.revokeObjectURL(url)};v.src=url;});
}
// Throws an Error with a plain-language message when the file is not acceptable or the upload fails. In the sample demo nothing is uploaded.
export async function prepareAttachment(file:File,uploadUrl:string,demo=false):Promise<Attachment>{
 const isVideo=file.type.startsWith('video/'),isImage=file.type.startsWith('image/');
 if(!isVideo&&!isImage)throw new Error('Choose a photo or a video.');
 if(isVideo){if(file.size>MAX_VIDEO)throw new Error('Videos can be up to 50 MB.');const s=await videoSeconds(file);if(Number.isFinite(s)&&s>MAX_VIDEO_SECONDS)throw new Error('Videos can be about 30 seconds long.');}
 if(demo){const src=URL.createObjectURL(file);return {id:'demo-'+Date.now(),kind:isVideo?'video':'image',contentType:file.type,bytes:file.size,preview:src};}
 const blob=isImage?await shrinkImage(file):file,r=await fetch(uploadUrl,{method:'POST',body:blob}),body=await r.json() as {id:string;kind:'image'|'video';contentType:string;bytes:number;error?:string};
 if(!r.ok)throw new Error(body.error||'The upload failed.');
 return {id:body.id,kind:body.kind,contentType:body.contentType,bytes:body.bytes,preview:URL.createObjectURL(blob)};
}
export function MediaView({kind,src,onSize}:{kind:'image'|'video';src:string;onSize?:()=>void}){
 return kind==='image'?<a href={src} target="_blank" rel="noreferrer"><img className="chat-media" src={src} alt="Shared photo" loading="lazy" onLoad={onSize}/></a>:<video className="chat-media" src={src} controls playsInline preload="metadata" onLoadedMetadata={onSize}/>;
}
export function AttachmentPreview({attachment,onRemove}:{attachment:Attachment;onRemove:()=>void}){
 return <div className="chat-attachment">{attachment.kind==='image'?<img src={attachment.preview} alt="Attachment preview"/>:<video src={attachment.preview} muted playsInline/>}<button type="button" className="chat-attachment-remove" aria-label="Remove attachment" onClick={onRemove}>×</button></div>;
}
