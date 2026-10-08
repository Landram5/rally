import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','account-http','auth-rules','rally-errors','rally-service','doubles','doubles-rating','ui-preferences','palettes']){
 let code;try{code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");}catch{continue}
 writeFileSync(`.test-runtime/${name}.mjs`,code);
}
const {accountHandlers}=await import('../.test-runtime/account-http.mjs');
const {validatePhotoOriginal}=await import('../.test-runtime/profile-photo.mjs');
const jpeg='data:image/jpeg;base64,'+readFileSync('scripts/fixtures/profile-photo.jpg').toString('base64');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(s,...a)=>sql.prepare(s).run(...a),one=(s,...a)=>sql.prepare(s).get(...a);
function stmt(query,args=[]){return {bind(...a){return stmt(query,a)},async first(){return one(query,...args)??null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {success:true,meta:run(query,...args)}},execute(){return {success:true,meta:run(query,...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const rows=stmts.map(s=>s.execute());sql.exec('COMMIT');return rows}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const [id,auth] of [['player','player-auth'],['other','other-auth']])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',id,auth,id,'2026-10-08');
let user={id:'player-auth'};
const handlers=accountHandlers({db,session:async()=>({user,signOut:async()=>{}}),configured:()=>true,admin:()=>({deleteUser:async()=>({error:null})})});
const post=(body)=>handlers.POST(new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json'},body:JSON.stringify(body)}));
const get=(view)=>handlers.GET(new Request('https://rally.test/api/account?view='+view));
// Validator: accepts a real JPEG, rejects everything else.
assert.equal(validatePhotoOriginal(jpeg),jpeg);
for(const bad of [null,5,'data:image/png;base64,AAAA','data:image/jpeg;base64,not base64!','data:image/jpeg;base64,'+Buffer.from('plain text').toString('base64'),'data:image/jpeg;base64,'+'A'.repeat(600000)])assert.throws(()=>validatePhotoOriginal(bad),e=>e.status===400);
// No original can be stored before there is a photo.
assert.equal((await post({action:'save_photo_original',original:jpeg})).status,200);
assert.equal(one("SELECT count(*) n FROM profile_photo_originals").n,0,'no photo, no original');
// Save a photo then its original; only the owner can read it back.
assert.equal((await post({action:'save_profile',name:'player',photo:jpeg})).status,200);
assert.equal((await post({action:'save_photo_original',original:jpeg})).status,200);
assert.equal((await (await get('photo-original')).json()).original,jpeg,'owner reads the original');
user={id:'other-auth'};assert.equal((await (await get('photo-original')).json()).original,null,'another player sees nothing');
user=null;assert.equal((await get('photo-original')).status,401,'signed-out visitors get nothing');
user={id:'player-auth'};
// Bad uploads are rejected and change nothing.
assert.equal((await post({action:'save_photo_original',original:'data:image/png;base64,AAAA'})).status,400);
assert.equal((await (await get('photo-original')).json()).original,jpeg);
// Oversize bodies are still refused for ordinary actions, even though the original route allows bigger ones.
assert.equal((await post({action:'save_notification_preferences',x:'y'.repeat(5000)})).status,413);
// Removing the photo removes the original.
assert.equal((await post({action:'save_profile',name:'player',photo:null})).status,200);
assert.equal(one("SELECT count(*) n FROM profile_photo_originals").n,0,'removed with the photo');
// Deleting the account removes it too.
await post({action:'save_profile',name:'player',photo:jpeg});await post({action:'save_photo_original',original:jpeg});assert.equal(one("SELECT count(*) n FROM profile_photo_originals").n,1);
run("UPDATE profiles SET deleted_at='2026-10-09',auth_id=NULL,name='Deleted player' WHERE id='player'");assert.equal(one("SELECT count(*) n FROM profile_photo_originals").n,0,'removed on account deletion');
console.log('Photo originals passed: validation, owner-only access, replace/removal and account deletion cleanup.');