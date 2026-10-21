export const EMAIL_MAX_LENGTH=254;
export const PASSWORD_MIN_LENGTH=8;
export const PASSWORD_MAX_LENGTH=128;

export function safeNextPath(value:string|null|undefined){
 if(!value||!value.startsWith('/')||value.startsWith('//'))return '/';
 try{const url=new URL(value,'https://rally.local');return url.origin==='https://rally.local'?`${url.pathname}${url.search}${url.hash}`:'/'}catch{return '/'}
}

export function validEmail(value:unknown):value is string{
 return typeof value==='string'&&value.length<=EMAIL_MAX_LENGTH&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPassword(value:unknown):value is string{
 return typeof value==='string'&&value.length>=PASSWORD_MIN_LENGTH&&value.length<=PASSWORD_MAX_LENGTH;
}

export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 return !!origin&&origin===new URL(request.url).origin;
}

// Native apps authenticate with an Authorization header, which browsers never attach on their own cross-site,
// so a Bearer request needs no same-origin check. Cookie requests still do.
export function bearerToken(headers:Headers){
 const match=/^Bearer\s+(\S+)$/i.exec(headers.get('authorization')??'');
 return match?match[1]:null;
}
export function allowedOrigin(request:Request){return !!bearerToken(request.headers)||sameOrigin(request)}
