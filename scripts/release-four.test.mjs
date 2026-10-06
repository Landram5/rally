import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','rally-service','tournament-service','tournament-engine','match-rules','rally-errors','seeding','public-rally'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {makeService}=await import('../.test-runtime/rally-service.mjs');
const {matchRecord}=await import('../.test-runtime/record-ownership.mjs');
const {getPublicPlayer}=await import('../.test-runtime/public-rally.mjs');
const {beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
 const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
 function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return one(q,...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:run(q,...args)}},execute(){return {success:true,meta:run(q,...args)}}}}
 const db={prepare:stmt,beforeBatch:null,async batch(stmts){if(this.beforeBatch){const cb=this.beforeBatch;this.beforeBatch=null;cb();}sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 for(const p of ['owner','member','visitor','second','third','other'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');
 run("INSERT INTO profiles(id,name,created_at) VALUES('guest','Guest','2026-10-01')");
 run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('club','Club','City','owner','2026-10-01','approved')");
 for(const [p,role] of [['owner','owner'],['member','member'],['guest','guest']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'club',?,?,'active','2026-10-01')",p,p,role);
 const service=makeService(db),act=(p,b)=>service.act(p+'-auth',b);
 const go=async(p,id,action,body={})=>act(p,{id,action,revision:one('SELECT revision FROM tournaments WHERE id=?',id).revision,operationId:crypto.randomUUID(),...body});
 const event=async(id,capacity=2)=>act('owner',{action:'create_tournament',id,clubId:'club',name:id,date:'2026-10-20',format:'Single elimination',capacity});
 return {db,sql,run,one,service,act,go,event};
}
{
 const f=fixture(),{act,db,one,run,service}=f;
 const create={action:'create_season',id:'season',clubId:'club',name:'Fall',startsOn:'2026-09-01',endsOn:'2099-12-31'};
 await assert.rejects(act('member',create),e=>e.status===403);await act('owner',create);await act('owner',create);
 assert.equal(one('SELECT count(*) n FROM season_players').n,3);
 await act('member',{action:'withdraw_season',id:'season',playerId:'member',revision:0});
 await assert.rejects(act('member',{action:'join_season',id:'season',playerId:'member',revision:0}),e=>e.status===409);
 await act('member',{action:'join_season',id:'season',playerId:'member',revision:1});
 await assert.rejects(act('visitor',{action:'join_season',id:'season',playerId:'visitor',revision:2}),e=>e.status===403);
 db.beforeBatch=()=>run("UPDATE memberships SET status='pending' WHERE player_id='owner'");
 await assert.rejects(act('owner',{...create,id:'revoked'}),e=>e.status===409);assert.equal(one("SELECT count(*) n FROM club_seasons WHERE id='revoked'").n,0);
 run("UPDATE memberships SET status='active' WHERE player_id='owner'");
 await act('owner',{action:'close_season',id:'season',revision:2,confirmation:'CLOSE'});
 await assert.rejects(act('member',{action:'withdraw_season',id:'season',revision:3,playerId:'member'}),e=>e.status===409);
 const {seasonViews}=await import('../.test-runtime/club-seasons.mjs');
 assert.equal((await seasonViews(db,'club',null))[0].canManage,false);
 run("UPDATE clubs SET approval_status='pending' WHERE id='club'");await assert.rejects(seasonViews(db,'club',null),e=>e.status===404);
 const {defaultPreferences}=await import('../.test-runtime/notification-preferences.mjs');
 await act('member',{action:'save_notification_preferences',...defaultPreferences,match_updates:false});
 assert.equal((await service.read('member-auth')).preferences.match_updates,false);assert.equal((await service.read('owner-auth')).preferences.match_updates,true);
 await assert.rejects(act('member',{action:'save_notification_preferences',match_updates:false}),e=>e.status===400);
 await act('member',{action:'submit_feedback',id:'report',type:'bug',title:'Testing feedback',description:'Details',page:'/clubs'});
 await assert.rejects(act('member',{action:'set_feedback_status',id:'report',status:'planned',revision:0}),e=>e.status===403);
 await service.act('owner-auth',{action:'set_feedback_status',id:'report',status:'planned',revision:0,note:'Queued for review'},{isSiteAdmin:true});
 assert.equal((await service.read('member-auth')).feedback[0].updates[0].note,'Queued for review');
 assert.ok((await service.read('member-auth')).notifications.some(n=>n.kind==='feedback'));
 assert.equal((await service.read('visitor-auth')).feedback.length,0);
 await assert.rejects(service.act('owner-auth',{action:'set_feedback_status',id:'report',status:'completed',revision:0},{isSiteAdmin:true}),e=>e.status===409);
 assert.equal(one('SELECT count(*) n FROM feedback_updates').n,1);
 const {summaryVersion,cachedSummaries}=await import('../.test-runtime/summary-cache.mjs');const v=await summaryVersion(db);
 const value=await cachedSummaries(db,[],['club'],v,'public');assert.deepEqual(await cachedSummaries(db,[],['club'],v,'public'),value);
 run("UPDATE clubhouse_summary_cache SET as_of='2000-01-01',summary_json='invalid'");await cachedSummaries(db,[],['club'],v,'public');assert.equal(one('SELECT as_of FROM clubhouse_summary_cache').as_of,new Date().toISOString().slice(0,10));
 db.beforeBatch=()=>run('UPDATE summary_epoch SET version=version+1');await cachedSummaries(db,[],['other'],v,'public');assert.equal(one('SELECT count(*) n FROM clubhouse_summary_cache WHERE scope_key LIKE ?', '%other%').n,0);
 const current=await summaryVersion(db);await cachedSummaries(db,[],['club'],current,'authenticated');assert.equal(one('SELECT count(*) n FROM clubhouse_summary_cache').n,1);
 run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('cache-match','club','owner','member','[[11,5],[11,7]]',3,'2026-10-01','confirmed','owner','2026-10-01')");assert.ok(await summaryVersion(db)>current);
 const after=await summaryVersion(db);run("UPDATE matches SET status='voided' WHERE id='cache-match'");assert.ok(await summaryVersion(db)>after);
}
console.log('Release 4 passed: season permissions and races, notification preference isolation, private feedback timelines, cache expiry and concurrent invalidation.');
for(const mode of ['keep_results','remove_history']){
 const {db,run,act,one}=fixture();
 await act('owner',{action:'create_season',id:'history-season',clubId:'club',name:'History',startsOn:'2026-09-01',endsOn:'2099-12-31'});
 run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('history-match','club','owner','member','[[11,5],[11,7]]',3,'2026-10-01','confirmed','owner','2026-10-01')");
 const {seasonViews}=await import('../.test-runtime/club-seasons.mjs');
 const before=(await seasonViews(db,'club','owner'))[0].players.find(p=>p.player_id==='owner');
 await beginDeletion(db,'member-auth',mode);
 const after=(await seasonViews(db,'club','owner'))[0].players.find(p=>p.player_id==='owner');
 assert.equal(after.rating,before.rating);assert.equal(after.played,before.played);assert.equal(one('PRAGMA foreign_key_check'),undefined);
}
{
 const {seasonStandings}=await import('../.test-runtime/club-seasons.mjs');
 const season={starts_on:'2026-09-01',ends_on:'2026-10-31',closed_at:null};
 const roster=['a','b'].map(player_id=>({player_id,name:player_id,status:'active'}));
 const match={id:'match',a:'a',b:'b',games:[[11,5],[11,5]],status:'confirmed',played_on:'2026-10-01'};
 assert.equal(seasonStandings(season,roster,[match], '2026-10-06').players[0].rating,408);
 assert.equal(seasonStandings(season,roster,[{...match,tournament_id:'event',tournament_weight:3}], '2026-10-06').players[0].rating,424);
 assert.equal(seasonStandings(season,roster,[{...match,played_on:'2026-08-01'}], '2026-10-06').players[0].played,0);
 assert.equal(seasonStandings(season,roster,[{...match,status:'voided'}], '2026-10-06').players[0].played,0);
 assert.equal(seasonStandings(season,roster,[{...match,b:'outsider'}], '2026-10-06').players[0].played,0);
}
console.log('Season ratings respect date windows, confirmed status, enrollment and tournament weights; both account deletion modes preserve opponents’ season results.');
{
 const {act,service,run}=fixture();
 await act('visitor',{action:'request_join',clubId:'club'});
 for(const compact of [false,true]){
  const owner=await service.read('owner-auth',{clubId:'club',compact});
  assert.ok(owner.memberships.some(m=>m.player_id==='visitor'&&m.status==='pending'));
  assert.equal(owner.players.find(p=>p.id==='visitor')?.name,'visitor','pending applicant has a visible name for the organizer');
  const ordinary=await service.read('member-auth',{clubId:'club',compact});
  assert.ok(!ordinary.memberships.some(m=>m.player_id==='visitor'));
  assert.ok(!ordinary.players.some(p=>p.id==='visitor'),'ordinary members do not receive pending applicant profiles');
  const publicView=await service.read(null,{clubId:'club',compact});
  assert.ok(!publicView.players.some(p=>p.id==='visitor'));
 }
 for(const role of ['admin','board']){
  run('UPDATE memberships SET role=? WHERE player_id=?',role,'member');
  assert.equal((await service.read('member-auth',{clubId:'club',compact:true})).players.find(p=>p.id==='visitor')?.name,'visitor');
 }
 await act('owner',{action:'approve_member',clubId:'club',playerId:'visitor'});
 assert.ok(!(await service.read('owner-auth',{clubId:'club',compact:true})).memberships.some(m=>m.player_id==='visitor'&&m.status==='pending'));
}
console.log('Pending member identities are visible to owners/admins/board in full and compact reads, hidden from ordinary members and public reads, and removed from the queue after approval.');
