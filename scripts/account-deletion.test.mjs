import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','account-http','auth-rules','rally-errors','public-rally','announcements','club-sessions','weekly-sessions','rally-service','tournament-service','tournament-scheduling','tournament-engine','match-rules','seeding']){
 const code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");
 writeFileSync(`.test-runtime/${name}.mjs`,code);
}
const {beginDeletion,finishDeletion,retryDeletions,accountPlan,transferOwnership}=await import('../.test-runtime/account-deletion.mjs');
const {accountHandlers}=await import('../.test-runtime/account-http.mjs');
const {getPublicPlayer}=await import('../.test-runtime/public-rally.mjs');
const {makeService}=await import('../.test-runtime/rally-service.mjs');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
 const run=(s,...a)=>sql.prepare(s).run(...a),one=(s,...a)=>sql.prepare(s).get(...a);
 function stmt(query,args=[]){return {bind(...a){return stmt(query,a)},async first(){return one(query,...args)??null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){return {success:true,meta:run(query,...args)}},execute(){return {success:true,meta:run(query,...args)}}}}
 const db={prepare:stmt,beforeBatch:null,async batch(stmts){if(this.beforeBatch){const cb=this.beforeBatch;this.beforeBatch=null;cb()}sql.exec('BEGIN');try{const rows=stmts.map(s=>s.execute());sql.exec('COMMIT');return rows}catch(e){sql.exec('ROLLBACK');throw e}}};
 for(const [id,auth,name] of [['owner','owner-auth','Owner'],['player','player-auth','Personal Name'],['other','other-auth','Opponent'],['guest',null,'Guest'],['outside','outside-auth','Outside']])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',id,auth,name,'2026-01-01');
 run("INSERT INTO clubs(id,name,location,owner_id,created_at) VALUES('club','Shared Club','Location','owner','2026-01-01')");
 for(const [id,role] of [['owner','owner'],['player','member'],['other','member'],['guest','guest']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'club',?,?,'active','2026-01-01')",id,id,role);
 for(const [id,status] of [['event','active'],['event2','completed'],['future','registration']]){
  run("INSERT INTO tournaments(id,name,club_id,date,format,capacity,created_at,status,state_json) VALUES(?,?,'club','2026-01-01','Round robin',2,'2026-01-01',?,?)",id,id,status,status==='registration'?null:JSON.stringify({seeds:['player','other'],fixtures:[{a:'player',b:'other'}]}));
  run('INSERT INTO entries(id,tournament_id,player_id,created_at) VALUES(?,?,?,?)',id,id,'player','2026-01-01');
 }
 for(const [id,event] of [['m1',null],['m2',null],['m3','event'],['m4','event'],['m5','event2']]){
  run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,tournament_id,created_at) VALUES(?,'club','player','other','[[11,5],[11,6]]',3,'2026-01-01','confirmed','player','other',?,'2026-01-01')",id,event);
  run("INSERT INTO audit(id,match_id,actor_id,action,created_at) VALUES(?,?,'player','submitted','2026-01-01')",id,id);
 }
 run("INSERT INTO tournament_operations(id,tournament_id,actor_id,action,payload,before_state,after_state,revision,created_at) VALUES('own-op','event','player','score_fixture',?,NULL,NULL,1,'2026-01-01')",JSON.stringify({extra:'Personal Name'}));
 run("INSERT INTO tournament_operations(id,tournament_id,actor_id,action,payload,before_state,after_state,revision,created_at) VALUES('other-op','event','other','withdraw_player',?,NULL,?,2,'2026-01-01')",JSON.stringify({playerId:'player'}),JSON.stringify({seeds:['player','other']}));
 return {sql,run,one,db};
}
{
 const {db,one,run,sql}=fixture();
 const plan=await accountPlan(db,'owner-auth');assert.deepEqual(plan.clubs[0].successors.map(p=>p.id),['other','player']);
 await assert.rejects(beginDeletion(db,'owner-auth','keep_results'),e=>e.status===409);
 assert.equal(one('SELECT COUNT(*) n FROM account_deletions').n,0);
 await assert.rejects(transferOwnership(db,'player-auth','club','other'),e=>e.status===403);
 for(const candidate of ['guest','outside','owner','missing'])await assert.rejects(transferOwnership(db,'owner-auth','club',candidate),e=>e.status===409);
 assert.equal(one("SELECT owner_id FROM clubs WHERE id='club'").owner_id,'owner');
 // A malformed membership cannot produce a half-transferred club.
 run("UPDATE memberships SET role='member' WHERE player_id='owner'");
 await assert.rejects(transferOwnership(db,'owner-auth','club','other'),e=>e.status===409);
 assert.equal(one("SELECT owner_id FROM clubs WHERE id='club'").owner_id,'owner');
 run("UPDATE memberships SET role='owner' WHERE player_id='owner'");
 await transferOwnership(db,'owner-auth','club','other');
 assert.equal(one("SELECT owner_id FROM clubs WHERE id='club'").owner_id,'other');
 assert.equal(one("SELECT role FROM memberships WHERE player_id='other'").role,'owner');
 assert.equal(one("SELECT role FROM memberships WHERE player_id='owner'").role,'admin');
 await beginDeletion(db,'owner-auth','keep_results');
 assert.equal(one('SELECT COUNT(*) n FROM clubs').n,2,'the transferred club and reserved unaffiliated scope survive deletion');sql.close();
}
{
 const {db,one,run,sql}=fixture();await beginDeletion(db,'player-auth','keep_results');
 assert.equal(one("SELECT name FROM profiles WHERE id='player'").name,'Deleted player');
 assert.equal(one("SELECT auth_id FROM profiles WHERE id='player'").auth_id,null);
 assert.equal(await getPublicPlayer(db,'player'),null);
 assert.equal(one("SELECT COUNT(*) n FROM memberships WHERE player_id='player'").n,0);
 assert.equal(one("SELECT COUNT(*) n FROM entries WHERE player_id='player' AND tournament_id='future'").n,0);
 assert.equal(one('SELECT COUNT(*) n FROM matches').n,5);
 assert.equal(one("SELECT name FROM profiles WHERE id='other'").name,'Opponent');
 assert.equal(one("SELECT COUNT(*) n FROM tournament_operations WHERE actor_id='player'").n,0);
 await assert.rejects(makeService(db).act('player-auth',{action:'save_profile',name:'Restore'}),e=>e.status===403);
 assert.throws(()=>run("INSERT INTO profiles(id,auth_id,name,created_at) VALUES('new','player-auth','Restore','now')"));
 assert.throws(()=>run("UPDATE profiles SET name='Restore' WHERE id='player'"));
 await beginDeletion(db,'player-auth','remove_history'); // Already accepted requests cannot change mode.
 assert.ok(one("SELECT id FROM profiles WHERE id='player'"));
 let calls=0;const admin={async deleteUser(id,soft){calls++;assert.equal(id,'player-auth');assert.equal(soft,false);return {error:{code:'unexpected_failure'}}}};
 assert.equal(await finishDeletion(db,admin,'player-auth'),false);
 assert.equal(one('SELECT attempts FROM account_deletions').attempts,1);
 admin.deleteUser=async()=>({error:{code:'user_not_found'}});
 assert.deepEqual(await retryDeletions(db,admin),{processed:1,pending:0});
 assert.equal(one('SELECT COUNT(*) n FROM account_deletions').n,0);
 assert.equal(await finishDeletion(db,{deleteUser(){throw new Error('Must not call provider without queue')}},'player-auth'),true);
 assert.equal(calls,1);sql.close();
}
{
 const {db,one,sql}=fixture();await beginDeletion(db,'player-auth','remove_history');
 assert.equal(one("SELECT id FROM profiles WHERE id='player'"),undefined);
 assert.equal(await getPublicPlayer(db,'player'),null);
 assert.equal(one('SELECT COUNT(*) n FROM matches').n,5);
 assert.equal(one('SELECT COUNT(*) n FROM tournaments').n,3);
 assert.equal(one('SELECT COUNT(*) n FROM clubs').n,2,'the club and reserved unaffiliated scope survive history removal');
 const rows=sql.prepare('SELECT id,a,b FROM matches ORDER BY id').all();
 assert.notEqual(rows[0].a,rows[1].a);assert.equal(rows[2].a,rows[3].a);assert.notEqual(rows[3].a,rows[4].a);
 assert.ok(rows.every(r=>r.b==='other'));
 for(const row of rows)assert.equal(one('SELECT name FROM profiles WHERE id=?',row.a).name,'Deleted player');
 for(const table of ['profiles','memberships','matches','entries','audit','tournaments','tournament_operations']){
  const contents=JSON.stringify(sql.prepare(`SELECT * FROM ${table}`).all());
  assert.ok(!contents.includes('Personal Name'),table+' leaked name');
  assert.ok(!contents.includes('player-auth'),table+' leaked auth');
  assert.ok(!contents.includes('"player"')&&!contents.includes('\\"player\\"'),table+' kept original player ID');
 }
 const event=one("SELECT state_json FROM tournaments WHERE id='event'");
 assert.equal(JSON.parse(event.state_json).seeds[0],rows[2].a);
 assert.equal(one("SELECT player_id FROM entries WHERE tournament_id='event'").player_id,rows[2].a);
 assert.equal(one("SELECT name FROM profiles WHERE id='other'").name,'Opponent');
 assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();
}
{
 const {db,one,sql,run}=fixture();db.beforeBatch=()=>run("UPDATE tournaments SET revision=revision+1 WHERE id='event'");
 await assert.rejects(beginDeletion(db,'player-auth','remove_history'),e=>e.status===409);
 assert.equal(one("SELECT name FROM profiles WHERE id='player'").name,'Personal Name');
 assert.equal(one('SELECT COUNT(*) n FROM account_deletions').n,0);sql.close();
}
{
 const {db,one,sql,run}=fixture();db.beforeBatch=()=>run("UPDATE clubs SET owner_id='player' WHERE id='club'");
 await assert.rejects(beginDeletion(db,'player-auth','keep_results'),e=>e.status===409);
 assert.equal(one("SELECT name FROM profiles WHERE id='player'").name,'Personal Name');sql.close();
}
{
 const {db,one,sql}=fixture();await beginDeletion(db,'account-without-profile','remove_history');
 assert.ok(one("SELECT * FROM account_deletions WHERE auth_id='account-without-profile'"));
 await finishDeletion(db,{deleteUser:async()=>({error:null})},'account-without-profile');sql.close();
}
{
 const {db,one,sql}=fixture();let user={id:'player-auth',email:'private@example.com'},configured=true,providerCalls=0,signedOut=false;
 const handlers=accountHandlers({db,session:async()=>({user,signOut:async()=>{signedOut=true}}),configured:()=>configured,admin:()=>({deleteUser:async(id)=>{assert.equal(id,'player-auth');assert.equal(signedOut,true);providerCalls++;return {error:null}}})});
 const request=(body,headers={})=>new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await handlers.POST(request({action:'delete',confirmation:'DELETE',mode:'keep_results'},{origin:'https://evil.test'}))).status,403);
 assert.equal((await handlers.POST(request(null))).status,400);
 assert.equal((await handlers.POST(request({stuff:'x'.repeat(5000)}))).status,413);
 assert.equal((await handlers.POST(request({action:'delete',mode:'keep_results'}))).status,400);
 assert.equal((await handlers.POST(request({action:'delete',confirmation:'DELETE',mode:'invalid'}))).status,400);
 user=null;assert.equal((await handlers.GET()).status,401);assert.equal((await handlers.POST(request({action:'delete',confirmation:'DELETE',mode:'keep_results'}))).status,401);
 user={id:'player-auth'};configured=false;
 assert.equal((await handlers.POST(request({action:'delete',confirmation:'DELETE',mode:'keep_results'}))).status,503);
 assert.equal(one('SELECT COUNT(*) n FROM account_deletions').n,0);configured=true;
 const response=await handlers.POST(request({action:'delete',confirmation:'DELETE',mode:'keep_results',authId:'other-auth'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(providerCalls,1);
 assert.equal(one("SELECT auth_id FROM profiles WHERE id='other'").auth_id,'other-auth');sql.close();
}
{
 const {db,one,sql}=fixture();const h=accountHandlers({db,session:async()=>({user:{id:'player-auth'},signOut:async()=>{throw new Error('offline')}}),configured:()=>true,admin:()=>({deleteUser:async()=>{throw new Error('offline')}})});
 const response=await h.POST(new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json'},body:JSON.stringify({action:'delete',confirmation:'DELETE',mode:'remove_history'})}));
 assert.equal(response.status,202);assert.equal((await response.json()).pending,true);assert.ok(one('SELECT * FROM account_deletions'));
 assert.equal((await h.GET()).status,200);assert.equal((await (await h.GET()).json()).pending,true);sql.close();
}
console.log('Passed: ownership authorization and atomic transfer; both deletion modes; preserved shared records; profile hiding; recreation protection; concurrent edits rollback; provider retry/idempotency; no-profile accounts; CSRF, body limits, confirmation, server-key preflight, and self-only HTTP deletion.');
{
 const {guardAccountWrites}=await import('../.test-runtime/account-write-guard.mjs');
 const {db,one,run,sql}=fixture();
 const alreadyPrepared=guardAccountWrites(db,'player-auth').prepare("INSERT INTO profiles(id,auth_id,name,created_at) VALUES('stale','player-auth','Restored','today')");
 await beginDeletion(db,'player-auth','remove_history');
 await finishDeletion(db,{deleteUser:async()=>({error:null})},'player-auth');
 await assert.rejects(alreadyPrepared.run());
 assert.equal(one("SELECT * FROM profiles WHERE id='stale'"),undefined);
 assert.equal(one('SELECT COUNT(*) n FROM account_write_blocks').n,1);
 run("UPDATE account_write_blocks SET expires_at='2000-01-01'");
 await retryDeletions(db,{deleteUser:async()=>{throw new Error('No queued Auth deletion')}});
 assert.equal(one('SELECT COUNT(*) n FROM account_write_blocks').n,0);sql.close();
}
{
 const {db,sql}=fixture();await beginDeletion(db,'player-auth','keep_results');
 const view=await makeService(db).read('other-auth');
 assert.equal(view.deletedPlayers.find(p=>p.id==='player').name,'Deleted player');
 assert.equal(view.players.some(p=>p.id==='player'),false);
 assert.equal((await getPublicPlayer(db,'other')).matches.length,5);sql.close();
}
console.log('Passed: in-flight writes remain blocked after Auth deletion; temporary security identifiers expire; shared results label deleted players without restoring their public profiles.');

for(const mode of ['keep_results','remove_history']){
 const {db,one,sql}=fixture();
 const service=makeService(db),photo='data:image/jpeg;base64,'+readFileSync('scripts/fixtures/profile-photo.jpg').toString('base64');
 await service.act('player-auth',{action:'save_profile',name:'Player',photo,bio:'My player bio'});
 assert.equal(one('SELECT count(*) AS n FROM profile_photos').n,1);
 await service.act('player-auth',{action:'submit_feedback',id:'personal-report',type:'bug',title:'My report',description:'My private report.'});
 sql.prepare("INSERT INTO notification_reads (player_id,notification_id,read_at) VALUES ('player','test-notice','2026-10-06')").run();
 await beginDeletion(db,'player-auth',mode);
 assert.equal(one("SELECT count(*) n FROM notification_reads WHERE player_id='player'").n,0,'account deletion removes inbox read state');
 assert.equal(one('SELECT count(*) AS n FROM feedback').n,0,'deletion removes submitted feedback');
 assert.equal(one('SELECT count(*) AS n FROM profile_photos').n,0,mode+' removes photo');
 assert.equal(one("SELECT count(*) AS n FROM profiles WHERE auth_id='player-auth' OR (id='player' AND (bio!='' OR rally_id IS NOT NULL))").n,0,'deletion removes bio and Rally ID');
 await assert.rejects(service.act('player-auth',{action:'save_profile',name:'Player',photo}),e=>e.status===403);
 sql.close();
}
console.log('Passed: both account deletion modes remove photos and block late uploads.');

{
 const {db,one,sql}=fixture();
 const h=accountHandlers({db,session:async()=>({user:{id:'player-auth',email:'player@example.test'},signOut:async()=>{}}),configured:()=>true,admin:()=>({deleteUser:async()=>({error:null})})});
 const before=await (await h.GET()).json();assert.match(before.profile.rally_id,/^RLY-/);
 const r=await h.POST(new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json'},body:JSON.stringify({action:'save_profile',name:'New username',bio:'New bio',playerId:'owner'})}));
 assert.equal(r.status,200);const after=await (await h.GET()).json();
 assert.equal(after.profile.name,'New username');assert.equal(after.profile.bio,'New bio');assert.equal(after.profile.rally_id,before.profile.rally_id);
 assert.notEqual(one("SELECT name FROM profiles WHERE id='owner'").name,'New username');
 const photo='data:image/jpeg;base64,'+readFileSync('scripts/fixtures/profile-photo.jpg').toString('base64');
 const uploaded=await h.POST(new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json'},body:JSON.stringify({action:'save_profile',name:'New username',bio:'New bio',photo,playerId:'owner'})}));
 assert.equal(uploaded.status,200);assert.match((await (await h.GET()).json()).profile.photo_url,/^\/api\/players\/player\/photo\?v=/);
 assert.equal(one("SELECT count(*) n FROM profile_photos WHERE player_id='owner'").n,0);
 const removed=await h.POST(new Request('https://rally.test/api/account',{method:'POST',headers:{origin:'https://rally.test','content-type':'application/json'},body:JSON.stringify({action:'save_profile',name:'New username',bio:'New bio',photo:null})}));
 assert.equal(removed.status,200);assert.equal((await (await h.GET()).json()).profile.photo_url,null);sql.close();
}
console.log('Passed: account settings return Rally ID and save only the signed-in player username and bio.');
