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
