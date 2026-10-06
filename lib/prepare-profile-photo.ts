export async function prepareProfilePhoto(file:File,banner=false):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG, or WebP photo.');
 if(file.size>10*1024*1024)throw new Error('Choose a photo smaller than 10 MB.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=banner?960:320;canvas.height=320;
  const context=canvas.getContext('2d');if(!context)throw new Error('Could not prepare your photo. Try another browser.');
  const ratio=canvas.width/canvas.height,sourceWidth=Math.min(image.naturalWidth,image.naturalHeight*ratio),sourceHeight=sourceWidth/ratio;
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,(image.naturalWidth-sourceWidth)/2,(image.naturalHeight-sourceHeight)/2,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
  let result=canvas.toDataURL('image/jpeg',0.85);
  for(const quality of [0.7,0.55,0.4]){if(result.length<=240023)break;result=canvas.toDataURL('image/jpeg',quality);}
  if(result.length>240023)throw new Error('This photo is too detailed. Choose a smaller photo.');
  return result;
 }catch(error){if(error instanceof Error&&error.name!=='EncodingError')throw error;throw new Error('Could not read this photo. Choose another JPG, PNG, or WebP image.');}
 finally{URL.revokeObjectURL(url);}
}
