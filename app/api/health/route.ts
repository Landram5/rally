import {env} from 'cloudflare:workers';
import {healthReport} from '@/lib/system-health';
export const dynamic='force-dynamic';
// For uptime monitors: 200 when the database answers and the five-minute maintenance job is running, otherwise 503. No private data.
export async function GET(){
 const report=env.DB?await healthReport(env.DB):{ok:false,database:false,checkedAt:new Date().toISOString(),scheduled:null};
 return Response.json(report,{status:report.ok?200:503,headers:{'Cache-Control':'no-store'}});
}
