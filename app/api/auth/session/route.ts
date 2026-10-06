import {getAuthenticatedUser} from '@/lib/auth';

export const dynamic='force-dynamic';
export async function GET(){
 const user=await getAuthenticatedUser();
 return Response.json({user:user?{displayName:user.displayName}:null},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
}
