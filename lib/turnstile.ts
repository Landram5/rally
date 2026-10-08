import {AppError} from './rally-errors';
export function captchaToken(value:unknown){
 if(typeof value!=='string'||!value.trim()||value.length>2048)throw new AppError(400,'Complete the security check and try again.');
 return value;
}
export async function verifyTurnstile(request:Request,value:unknown,secret?:string){
 if(!secret?.trim())throw new AppError(503,'The security check is temporarily unavailable.');
 const token=captchaToken(value);
 let result:{success?:boolean;hostname?:string;action?:string};
 try{
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,...(request.headers.get('CF-Connecting-IP')?{remoteip:request.headers.get('CF-Connecting-IP')!}:{})}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error();result=await response.json();
 }catch{throw new AppError(503,'The security check is temporarily unavailable. Try again.');}
 if(!result.success||result.hostname!==new URL(request.url).hostname||result.action!=='feedback')throw new AppError(400,'Complete the security check again.');
}
