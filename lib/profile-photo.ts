import {AppError} from './rally-errors';
export const MAX_PHOTO_BYTES=180_000;
// Only small JPEG thumbnails are accepted; originals never enter the database.
export function validateProfilePhoto(value:unknown,maxDimension=512):string {
 const invalid=()=>{throw new AppError(400,'Choose a valid JPG, PNG, or WebP photo using the photo picker.');};
 if(typeof value!=='string'||value.length>240_023||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return invalid();
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(value.slice(23)),c=>c.charCodeAt(0));}catch{return invalid();}
 if(bytes.length>MAX_PHOTO_BYTES||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return invalid();
 let dimensions=false;
 for(let i=2;i<bytes.length-2;){
  if(bytes[i++]!==255)return invalid();while(bytes[i]===255)i++;
  const marker=bytes[i++];if(marker===218)break;
  const length=(bytes[i]<<8)|bytes[i+1];if(length<2||i+length>bytes.length)return invalid();
  if([192,193,194].includes(marker)){
   const height=(bytes[i+3]<<8)|bytes[i+4],width=(bytes[i+5]<<8)|bytes[i+6];
   if(length<8||!width||!height||width>maxDimension||height>maxDimension)return invalid();dimensions=true;
  }
  i+=length;
 }
 if(!dimensions)return invalid();return value;
}
export function profilePhotoUrl(id:string,version:string|null|undefined){return version?`/api/players/${id}/photo?v=${encodeURIComponent(version)}`:null;}
