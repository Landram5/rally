import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','club-sessions','weekly-sessions','rally-service','tournament-service','tournament-scheduling','tournament-engine','match-rules','rally-errors','seeding','public-rally'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
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
const {scheduleDraw,expireWaitlistOffers}=await import('../.test-runtime/tournament-scheduling.mjs');
const {createDraw}=await import('../.test-runtime/tournament-engine.mjs');
const start='2099-01-01T10:00:00.000Z';
for(const format of ['Round robin','Single elimination','Double elimination']){
 const draw=createDraw(['a','b','c','d','e'],format,3),scheduled=scheduleDraw(draw,2,20,start),byId=new Map(scheduled.plans.map(p=>[p.fixture_id,p]));
 for(const a of scheduled.plans)for(const b of scheduled.plans){if(a===b)continue;const overlap=a.starts_at<b.ends_at&&b.starts_at<a.ends_at;if(!overlap)continue;assert.notEqual(a.court,b.court,'table double booking');const fa=draw.fixtures.find(f=>f.id===a.fixture_id),fb=draw.fixtures.find(f=>f.id===b.fixture_id);assert.equal([fa.a,fa.b].some(id=>id&&[fb.a,fb.b].includes(id)),false,'known player double booking');}
 for(const f of draw.fixtures){const plan=byId.get(f.id);if(!plan)continue;for(const id of [f.sourceA?.fixtureId,f.sourceB?.fixtureId,f.conditionFixtureId])if(id&&byId.has(id))assert.ok(plan.starts_at>=byId.get(id).ends_at,'dependency finishes first');}
 assert.ok(scheduled.endsAt<=scheduleDraw(draw,1,20,start).endsAt);if(format==='Double elimination')assert.ok(byId.has('gf2'),'conditional reset final allowed for');
}
{
 const f=fixture(),{go,event,one,run,db,sql}=f;await event('roles',4);for(const playerId of ['owner','member','guest'])await go('owner','roles','enter_tournament',{playerId});
 await assert.rejects(go('owner','roles','set_scorekeeper',{playerId:'visitor',enabled:true}),e=>e.status===400);
 await go('owner','roles','set_scorekeeper',{playerId:'member',enabled:true});await go('owner','roles','start_tournament',{seeds:['owner','member','guest'],bestOf:3});
 const draw=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='roles'").state_json),ready=draw.fixtures.find(f=>f.status==='ready');
 for(const action of ['set_capacity','schedule_tournament','set_scorekeeper','reset_fixture','withdraw_player','set_fixture_plan'])await assert.rejects(go('member','roles',action,{capacity:6,tableCount:2,matchMinutes:20,playerId:'guest',enabled:true,fixtureId:ready.id,note:'Reset'}),e=>e.status===403);
 await assert.rejects(go('member','roles','score_fixture',{fixtureId:ready.id,forfeitWinner:ready.a}),e=>e.status===403);
 const payload={action:'score_fixture',id:'roles',revision:one("SELECT revision FROM tournaments WHERE id='roles'").revision,operationId:crypto.randomUUID(),fixtureId:ready.id,games:[[11,5],[11,7]]};
 db.beforeBatch=()=>run("DELETE FROM tournament_scorekeepers WHERE player_id='member'");await assert.rejects(f.act('member',payload),e=>e.status===409);assert.equal(one('SELECT count(*) n FROM matches').n,0,'revocation prevents partial results');
 await go('owner','roles','set_scorekeeper',{playerId:'member',enabled:true});payload.revision=one("SELECT revision FROM tournaments WHERE id='roles'").revision;await f.act('member',payload);assert.equal(one('SELECT count(*) n FROM matches').n,1);
 run("UPDATE memberships SET status='removed' WHERE player_id='member'");await assert.rejects(f.act('member',payload),e=>e.status===403,'revoked scorekeeper cannot replay even an old successful request');assert.equal(one("SELECT count(*) n FROM tournament_scorekeepers WHERE player_id='member'").n,0);run("UPDATE memberships SET status='active' WHERE player_id='member'");await assert.rejects(go('member','roles','score_fixture',{fixtureId:draw.fixtures.find(f=>f.id!==ready.id).id,games:[[11,5],[11,7]]}),e=>e.status===403);
 sql.close();
}
{
 const {event,go,one,sql}=fixture();await event('schedule',4);for(const playerId of ['owner','member','guest'])await go('owner','schedule','enter_tournament',{playerId});await go('owner','schedule','start_tournament',{seeds:['owner','member','guest'],bestOf:3});
 await go('owner','schedule','schedule_tournament',{tableCount:2,matchMinutes:20,startsAt:start});assert.equal(one("SELECT table_count FROM tournaments WHERE id='schedule'").table_count,2);assert.ok(one("SELECT estimated_ends_at FROM tournaments WHERE id='schedule'").estimated_ends_at);assert.ok(one('SELECT count(*) n FROM tournament_fixture_plans').n>0);
 const draw=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='schedule'").state_json),ready=draw.fixtures.find(f=>f.status==='ready');await go('owner','schedule','set_fixture_plan',{fixtureId:ready.id,court:'Table 2',called:true});
 const call=one('SELECT called_at,starts_at FROM tournament_fixture_plans WHERE fixture_id=?',ready.id);await assert.rejects(go('owner','schedule','schedule_tournament',{tableCount:1,matchMinutes:20}),e=>e.status===409);
 await go('owner','schedule','schedule_tournament',{tableCount:2,matchMinutes:20});assert.equal(one('SELECT called_at FROM tournament_fixture_plans WHERE fixture_id=?',ready.id).called_at,call.called_at);await go('owner','schedule','score_fixture',{fixtureId:ready.id,games:[[11,5],[11,7]]});assert.equal(one('SELECT called_at FROM tournament_fixture_plans WHERE fixture_id=?',ready.id).called_at,null);sql.close();
}
{
 const f=fixture(),{event,go,one,run,sql,db}=f;await event('queue');await go('owner','queue','set_registration_policy',{allowVisitors:true});for(const playerId of ['owner','visitor'])await go(playerId,'queue','enter_tournament',{playerId});for(const playerId of ['second','third'])await go(playerId,'queue','join_waitlist',{playerId});
 run("UPDATE tournament_waitlist SET created_at=CASE player_id WHEN 'second' THEN '2026-01-01' ELSE '2026-01-02' END");await go('visitor','queue','remove_entry',{playerId:'visitor'});assert.ok(one("SELECT claim_expires_at FROM tournament_waitlist WHERE player_id='second'").claim_expires_at);assert.equal(one("SELECT claim_expires_at FROM tournament_waitlist WHERE player_id='third'").claim_expires_at,null);
 await assert.rejects(go('third','queue','claim_waitlist_place',{playerId:'second'}),e=>e.status===403);await assert.rejects(go('third','queue','enter_tournament',{playerId:'third'}),e=>e.status===409);
 await go('owner','queue','set_capacity',{capacity:3});await assert.rejects(go('owner','queue','set_capacity',{capacity:2}),e=>e.status===400);await assert.rejects(go('owner','queue','start_tournament',{seeds:['owner'],bestOf:3}),e=>e.status===409);
 db.beforeBatch=()=>run("UPDATE tournament_waitlist SET claim_expires_at='2000-01-01' WHERE player_id='second'");await assert.rejects(go('second','queue','claim_waitlist_place',{playerId:'second'}),e=>e.status===409);assert.equal(one("SELECT count(*) n FROM entries WHERE player_id='second'").n,0);
 await expireWaitlistOffers(db);assert.equal(one("SELECT count(*) n FROM tournament_waitlist WHERE player_id='second'").n,0);await go('third','queue','claim_waitlist_place',{playerId:'third'});assert.equal(one("SELECT count(*) n FROM entries WHERE player_id='third'").n,1);sql.close();
}
console.log('Passed: scorekeeper restrictions/revocation rollback, conflict-free table/player schedules, bracket dependencies/reset-final estimate, called-match locks, FIFO reserved offers and claim expiry.');

{
 const {event,go,one,run,db,sql}=fixture();await event('expire');await go('owner','expire','set_registration_policy',{allowVisitors:true});for(const playerId of ['owner','visitor'])await go(playerId,'expire','enter_tournament',{playerId});for(const playerId of ['second','third'])await go(playerId,'expire','join_waitlist',{playerId});run("UPDATE tournament_waitlist SET created_at=CASE player_id WHEN 'second' THEN '2026-01-01' ELSE '2026-01-02' END");await go('visitor','expire','remove_entry',{playerId:'visitor'});run("UPDATE tournament_waitlist SET claim_expires_at='2000-01-01' WHERE player_id='second'");await expireWaitlistOffers(db);assert.ok(one("SELECT claim_expires_at FROM tournament_waitlist WHERE player_id='third'").claim_expires_at,'expired FIFO head offers next player');assert.equal(one("SELECT count(*) n FROM entries").n,1,'offer does not enroll silently');sql.close();
}
{
 const draw=createDraw(['a','b','c','d'],'Round robin',3),ready=draw.fixtures.filter(f=>f.status==='ready'),called=ready.slice(0,2).map(f=>({fixture_id:f.id,court:'Table 1',starts_at:'2026-01-01T10:00:00Z',ends_at:'2026-01-01T10:20:00Z',called_at:'2026-01-01T10:00:00Z'}));assert.throws(()=>scheduleDraw(draw,2,20,start,called),e=>e.status===409,'future schedule still detects conflicting existing calls');
}
