export function photoCrop(width:number,height:number,zoom=1,x=50,y=50){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid image dimensions.');
 const z=Math.max(1,Math.min(3,Number.isFinite(zoom)?zoom:1)),side=Math.min(width,height)/z;
 const clamp=(v:number)=>Math.max(0,Math.min(100,Number.isFinite(v)?v:50))/100;
 return {x:(width-side)*clamp(x),y:(height-side)*clamp(y),side};
}
