export function photoCrop(width:number,height:number,zoom=1,x=50,y=50){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid image dimensions.');
 const z=Math.max(1,Math.min(3,Number.isFinite(zoom)?zoom:1)),side=Math.min(width,height)/z;
 const clamp=(v:number)=>Math.max(0,Math.min(100,Number.isFinite(v)?v:50))/100;
 return {x:(width-side)*clamp(x),y:(height-side)*clamp(y),side};
}
export function repositionCrop(width:number,height:number,zoom:number,source:{x:number;y:number},anchor:{x:number;y:number}){
 const next=photoCrop(width,height,zoom);
 const left=Math.max(0,Math.min(width-next.side,source.x-anchor.x*next.side));
 const top=Math.max(0,Math.min(height-next.side,source.y-anchor.y*next.side));
 return {zoom:Math.min(3,Math.max(1,zoom)),x:width===next.side?50:left/(width-next.side)*100,y:height===next.side?50:top/(height-next.side)*100};
}
