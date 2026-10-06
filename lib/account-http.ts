import {profilePhotoUrl} from './profile-photo';
import {makeService} from './rally-service';
import {sameOrigin} from './auth-rules';
import {accountPlan,beginDeletion,finishDeletion,transferOwnership} from './account-deletion';
import {AppError} from './rally-errors';

type Session={user:{id:string;email?:string}|null;signOut:()=>Promise<unknown>};
type Dependencies={db:D1Database;session:()=>Promise<Session>;admin:()=>{deleteUser:(id:string,soft?:boolean)=>Promise<{error:{code?:string;status?:number}|null}>};configured:()=>boolean};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
async function readBody(request:Request):Promise<Record<string,unknown>> {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError(415,'JSON required.');
 const reader=request.body?.getReader();
 if(!reader)throw new AppError(400,'Invalid request.');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new AppError(413,'Request too large.')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AppError(400,'Invalid request.');}
 if(size>4096&&(!body||typeof body!=='object'||Array.isArray(body)||(body as Record<string,unknown>).action!=='save_profile'))throw new AppError(413,'Request too large.');
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AppError(400,'Invalid request.');return body as Record<string,unknown>;
}
function failure(error:unknown){
 if(error instanceof AppError)return reply({error:error.message},error.status);
 console.error('Account operation failed');
 return reply({error:'Account settings are temporarily unavailable. Please try again.'},503);
}
export function accountHandlers(deps:Dependencies) {
 return {
  async GET(){
   try {
    const {user}=await deps.session();if(!user)return reply({error:'Sign in to manage your account.'},401);
    const plan=await accountPlan(deps.db,user.id);
    const profile=plan.pending?null:await deps.db.prepare('SELECT p.id,p.name,p.bio,p.rally_id,ph.updated_at AS photo_version FROM profiles p LEFT JOIN profile_photos ph ON ph.player_id=p.id WHERE p.auth_id=? AND p.deleted_at IS NULL').bind(user.id).first<{id:string;name:string;bio:string;rally_id:string;photo_version:string|null}>();
    return reply({...plan,profile:profile?{id:profile.id,name:profile.name,bio:profile.bio,rally_id:profile.rally_id,photo_url:profilePhotoUrl(profile.id,profile.photo_version)}:null,email:user.email??'',deletionAvailable:deps.configured()});
   } catch(error){return failure(error)}
  },
  async POST(request:Request){
   if(!sameOrigin(request))return reply({error:'Request origin not allowed.'},403);
   try {
    const body=await readBody(request);
    const session=await deps.session(),user=session.user;
    if(!user)return reply({error:'Sign in to manage your account.'},401);
    if(body.action==='save_profile'){await makeService(deps.db).act(user.id,{action:'save_profile',name:body.name,bio:body.bio,...(body.photo!==undefined?{photo:body.photo}:{})});return reply({ok:true});}
    if(body.action==='transfer') {
     if(body.confirmation!=='TRANSFER')throw new AppError(400,'Confirm the ownership transfer.');
     if(typeof body.clubId!=='string'||typeof body.successorId!=='string'||![body.clubId,body.successorId].every(id=>/^[a-zA-Z0-9_-]{1,80}$/.test(id)))throw new AppError(400,'Select a club and its new owner.');
     await transferOwnership(deps.db,user.id,body.clubId,body.successorId);
     return reply({ok:true});
    }
    if(body.action!=='delete'||body.confirmation!=='DELETE'||!['keep_results','remove_history'].includes(String(body.mode)))throw new AppError(400,'Choose your history option and type DELETE to confirm.');
    if(!deps.configured())throw new AppError(503,'Account deletion is temporarily unavailable. Please try again later.');
    // Validate server configuration before touching application data.
    const admin=deps.admin();
    await beginDeletion(deps.db,user.id,body.mode as 'keep_results'|'remove_history');
    // Revoke refresh sessions globally before deleting Auth. D1 blocks access while
    // provider deletion is pending; server getUser checks reject deleted accounts.
    try {await session.signOut()}catch {console.error('Account deletion session revocation will be completed by Auth deletion');}
    const completed=await finishDeletion(deps.db,admin,user.id);
    return reply({ok:true,pending:!completed},completed?200:202);
   } catch(error){return failure(error)}
  },
 };
}
