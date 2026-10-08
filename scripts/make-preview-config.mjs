// Builds a PREVIEW deployment config from the production build output.
// The preview is a separate Worker ("rally-preview") with its own database: no custom-domain routes,
// no cron trigger, no secrets. It can never touch production data or rallytt.net.
// Usage: pnpm build && node scripts/make-preview-config.mjs <preview-d1-database-id>
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const databaseId=process.argv[2];
if(!databaseId||!/^[0-9a-f-]{36}$/.test(databaseId))throw new Error('Pass the preview D1 database id (create it with: wrangler d1 create rally-preview).');
const production=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
if(databaseId===production.d1_databases?.[0]?.database_id)throw new Error('Refusing to use the production database for a preview.');
const {configPath:_a,userConfigPath:_b,...rest}=production;
const preview={...rest,name:'rally-preview',topLevelName:'rally-preview',routes:[],triggers:{crons:[]},keep_vars:false,workers_dev:true,observability:{enabled:false},
 d1_databases:[{binding:'DB',database_name:'rally-preview',database_id:databaseId,migrations_dir:path.resolve('drizzle')}],
 ratelimits:(production.ratelimits??[]).map((r,i)=>({...r,namespace_id:String(72001+i)}))};
writeFileSync('dist/server/wrangler.preview.json',JSON.stringify(preview));
console.log('Wrote dist/server/wrangler.preview.json for Worker "rally-preview" (no routes, no cron, database '+databaseId+').');
