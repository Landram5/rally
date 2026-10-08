type Limiter={limit(options:{key:string}):Promise<{success:boolean}>};
export async function rateLimit(limiter:Limiter,key:string){
 try{if((await limiter.limit({key})).success)return null;}catch{return Response.json({error:'Please try again shortly.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});}
 return Response.json({error:'Too many requests. Please wait a minute and try again.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
}
export async function limitWrite(request:Request,bindings:{WRITE_LIMITER:Limiter;AUTH_LIMITER:Limiter}){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/')||!['POST','PUT','PATCH','DELETE'].includes(request.method))return null;
 const ip=request.headers.get('CF-Connecting-IP')??'local';
 return rateLimit(path.startsWith('/api/auth/')?bindings.AUTH_LIMITER:bindings.WRITE_LIMITER,ip);
}
