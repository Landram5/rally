import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','club-sessions','weekly-sessions','rally-service','tournament-service','tournament-scheduling','tournament-engine','match-rules','rally-errors','seeding','public-rally'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
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
 const f=fixture(),{sql,event,go,one,service,act}=f;
 await event('open');await assert.rejects(go('visitor','open','enter_tournament',{playerId:'visitor'}),e=>e.status===403);
 await go('owner','open','set_registration_policy',{allowVisitors:true});
 for(const p of ['owner','visitor'])await go(p,'open','enter_tournament',{playerId:p});
 assert.equal(one("SELECT count(*) n FROM memberships WHERE player_id='visitor'").n,0,'visitor registration does not join host club');
 assert.ok((await service.read('owner-auth',{clubId:'club'})).players.some(p=>p.id==='visitor'),'scoped event displays visitor');
 for(const p of ['second','third'])await go(p,'open','join_waitlist',{playerId:p});
 // Deterministic queue order independent of a millisecond tie in local tests.
 f.run("UPDATE tournament_waitlist SET created_at=CASE player_id WHEN 'second' THEN '2026-10-01T00:00:00Z' ELSE '2026-10-02T00:00:00Z' END");
 assert.equal((await service.read('third-auth')).tournaments.find(t=>t.id==='open').waitlist[0].position,2);
 await assert.rejects(go('third','open','enter_tournament',{playerId:'third'}),e=>e.status===409);
 await assert.rejects(go('visitor','open','remove_entry',{playerId:'owner'}),e=>e.status===403);
 await go('visitor','open','remove_entry',{playerId:'visitor'});
 assert.ok(one("SELECT claim_expires_at FROM tournament_waitlist WHERE player_id='second'").claim_expires_at,'oldest queued player offered a place');
 await go('second','open','claim_waitlist_place',{playerId:'second'});
 await go('owner','open','set_capacity',{capacity:3});await go('third','open','claim_waitlist_place',{playerId:'third'});assert.ok(one("SELECT 1 FROM entries WHERE player_id='third'"));
 await go('owner','open','set_event_logistics',{checkInOpen:true});await go('second','open','set_check_in',{playerId:'second',checkedIn:true});
 assert.ok(one("SELECT checked_in_at FROM entries WHERE player_id='second'").checked_in_at,'nonmember entrant may check in');
 await go('visitor','open','join_waitlist',{playerId:'visitor'});
 f.run("UPDATE tournaments SET registration_closes_at='2000-01-01T00:00:00Z' WHERE id='open'");
 await go('third','open','remove_entry',{playerId:'third'});assert.equal(one("SELECT count(*) n FROM entries WHERE player_id='visitor'").n,0,'deadline prevents promotion');
 f.run("UPDATE tournaments SET registration_closes_at=NULL WHERE id='open'");
 await go('visitor','open','enter_tournament',{playerId:'visitor'});assert.ok(one("SELECT 1 FROM entries WHERE player_id='visitor'"));
 await act('owner',{action:'mark_notifications_read'});
 sql.close();
}
console.log('Passed: visiting-player opt-in, scoped visibility, no implicit membership, self-only registration, FIFO promotion, deadline enforcement, check-in and queue fairness.');
{
 const {db,sql,run,one,act,event,go}=fixture();
 await event('guest-event');await go('owner','guest-event','enter_tournament',{playerId:'guest'});await go('owner','guest-event','enter_tournament',{playerId:'member'});await go('owner','guest-event','start_tournament',{seeds:['guest','member'],bestOf:3});
 const draw=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='guest-event'").state_json);await go('owner','guest-event','score_fixture',{fixtureId:draw.fixtures[0].id,games:[[11,5],[11,7]]});
 const request={action:'request_guest_claim',id:'claim',guestId:'guest',clubId:'club',note:'I played the guest final.'};await act('visitor',request);await act('visitor',request);
 await assert.rejects(act('other',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE'}),e=>e.status===403);
 await act('owner',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE'});
 assert.equal(one("SELECT merged_into FROM profiles WHERE id='guest'").merged_into,'visitor');assert.equal(one("SELECT a FROM matches WHERE tournament_id='guest-event'").a,'visitor');
 assert.equal((await getPublicPlayer(db,'guest')).id,'visitor','old guest link follows claimed account');
 assert.ok(JSON.parse(one("SELECT state_json FROM tournaments WHERE id='guest-event'").state_json).seeds.includes('visitor'));
 assert.equal(one("SELECT player_id FROM memberships WHERE player_id='visitor'").player_id,'visitor');
 await beginDeletion(db,'visitor-auth','remove_history');assert.equal(one("SELECT 1 FROM profiles WHERE id='visitor'"),undefined);assert.equal(one("SELECT count(*) n FROM guest_claims").n,0);assert.equal(one('PRAGMA foreign_key_check'),undefined);sql.close();
}
{
 const {db,sql,act,one,run}=fixture();await act('member',{action:'request_guest_claim',id:'claim',guestId:'guest',clubId:'club',note:'Guest record'});
 run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('collision','club','guest','member','[[11,5],[11,7]]',3,'2026-10-01','confirmed','owner','2026-10-01')");
 await assert.rejects(act('owner',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE'}),e=>e.status===409);assert.equal(one("SELECT status FROM guest_claims").status,'pending');assert.equal(one("SELECT deleted_at FROM profiles WHERE id='guest'").deleted_at,null);sql.close();
}
console.log('Passed: organizer-approved guest merging, draw/results/memberships and old-link preservation, collision rejection and deletion of merged accounts without foreign-key failures.');
{
 const {db,sql,act,one}=fixture();await act('member',{action:'record_match',id:'regular',clubId:'club',a:'member',b:'owner',games:[[11,5],[11,6]],bestOf:3,date:'2026-10-01'});
 const request={action:'request_match_review',id:'review',matchId:'regular',note:'Scores were reversed.'};await act('member',request);await act('member',request);
 await assert.rejects(act('other',request),e=>e.status===403);await assert.rejects(matchRecord(db,'other','regular'),e=>e.status===403);
 await act('owner',{action:'confirm_match',id:'regular'});
 await assert.rejects(act('owner',{action:'resolve_match_review',id:'review',matchId:'regular',status:'resolved',note:'Verified'}),e=>e.status===409,'confirmation alone cannot resolve disputed scores');
 await assert.rejects(act('member',{action:'correct_match',matchId:'regular',revision:1,note:'Correcting',games:[[5,11],[6,11]]}),e=>e.status===403);
 await act('owner',{action:'correct_match',matchId:'regular',revision:one("SELECT revision FROM matches WHERE id='regular'").revision,note:'Confirmed with both players',games:[[5,11],[6,11]]});
 const history=await matchRecord(db,'member','regular');assert.equal(history.history.length,1);assert.deepEqual(JSON.parse(JSON.parse(history.history[0].before_json).games),[[11,5],[11,6]]);
 await act('owner',{action:'resolve_match_review',id:'review',matchId:'regular',status:'resolved',note:'Scores corrected with both players.'});assert.equal(one("SELECT status FROM match_reviews").status,'resolved');
 await assert.rejects(act('owner',{action:'correct_match',matchId:'regular',revision:0,note:'Stale edit',games:[[11,0],[11,0]]}),e=>e.status===409);
 await beginDeletion(db,'member-auth','remove_history');assert.equal(one('PRAGMA foreign_key_check'),undefined);assert.equal(one('SELECT count(*) n FROM match_reviews').n,0);sql.close();
}
console.log('Passed: private dispute access, retry identity, organizer-only correction, revision conflicts, original-score history, meaningful resolution and account-deletion cleanup.');

{
 const {db,sql,act,event,go,run,one}=fixture();await event('race');await go('owner','race','enter_tournament',{playerId:'guest'});await go('owner','race','enter_tournament',{playerId:'owner'});
 await act('visitor',{action:'request_guest_claim',id:'race-claim',guestId:'guest',clubId:'club',note:'Guest identity'});
 db.beforeBatch=()=>run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('new-collision','club','guest','visitor','[[11,5],[11,7]]',3,'2026-10-01','confirmed','owner','2026-10-01')");
 await assert.rejects(act('owner',{action:'review_guest_claim',id:'race-claim',status:'approved',confirmation:'MERGE'}),e=>e.status===409);
 assert.equal(one("SELECT status FROM guest_claims").status,'pending');assert.equal(one("SELECT deleted_at FROM profiles WHERE id='guest'").deleted_at,null,'concurrent identity collision rolls back whole merge');
 await act('member',{action:'record_match',id:'race-result',clubId:'club',a:'member',b:'owner',games:[[11,5],[11,6]],bestOf:3,date:'2026-10-01'});
 db.beforeBatch=()=>run("UPDATE memberships SET role='member' WHERE player_id='owner'");
 await assert.rejects(act('owner',{action:'correct_match',matchId:'race-result',revision:0,note:'Correction',games:[[5,11],[6,11]]}),e=>e.status===409);
 assert.equal(one("SELECT games FROM matches WHERE id='race-result'").games,'[[11,5],[11,6]]');assert.equal(one('SELECT count(*) n FROM match_history').n,0,'revoked organizer cannot leave partial score/history writes');sql.close();
}
{
 const {db,sql,act,event,go,one}=fixture();await event('history');for(const playerId of ['owner','member'])await go('owner','history','enter_tournament',{playerId});await go('owner','history','start_tournament',{seeds:['owner','member'],bestOf:3});
 const draw=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='history'").state_json),f=draw.fixtures[0];await go('owner','history','score_fixture',{fixtureId:f.id,games:[[11,5],[11,7]]});const matchId='t_history_'+f.id;
 await act('member',{action:'request_match_review',id:'draw-review',matchId,note:'Wrong winner recorded.'});
 await assert.rejects(go('owner','history','reset_fixture',{fixtureId:f.id}),e=>e.status===400);
 await go('owner','history','reset_fixture',{fixtureId:f.id,note:'Both players confirmed the scores were reversed.'});
 const history=await matchRecord(db,'member',matchId);assert.deepEqual(history.history.map(h=>h.action).sort(),['recorded','reset']);assert.equal(history.match.status,'voided');
 await act('owner',{action:'resolve_match_review',id:'draw-review',matchId,status:'resolved',note:'Draw reset for correct scoring.'});await go('owner','history','score_fixture',{fixtureId:f.id,games:[[5,11],[7,11]]});assert.equal((await matchRecord(db,'member',matchId)).history.length,3);sql.close();
}
console.log('Passed: concurrent collision and revoked-role rollback; tournament reset reasons, original/replacement history and disputes resolved through draw controls.');

{
 const {db,sql,event,go,one}=fixture();await event('deletion-queue');await go('owner','deletion-queue','set_registration_policy',{allowVisitors:true});for(const playerId of ['owner','visitor'])await go(playerId,'deletion-queue','enter_tournament',{playerId});await go('second','deletion-queue','join_waitlist',{playerId:'second'});await beginDeletion(db,'visitor-auth','keep_results');assert.ok(one("SELECT claim_expires_at FROM tournament_waitlist WHERE tournament_id='deletion-queue' AND player_id='second'").claim_expires_at);await go('second','deletion-queue','claim_waitlist_place',{playerId:'second'});assert.ok(one("SELECT 1 FROM entries WHERE tournament_id='deletion-queue' AND player_id='second'"));assert.equal(one('PRAGMA foreign_key_check'),undefined);sql.close();
}
console.log('Passed: deleting an account frees its registration place for the oldest eligible waiting player.');

{
 const {db,sql,act,run}=fixture();await act('member',{action:'record_match',id:'focused-result',clubId:'club',a:'member',b:'owner',games:[[11,5],[11,6]],bestOf:3,date:'2026-10-01'});
 await act('member',{action:'request_match_review',id:'focused-review',matchId:'focused-result',note:'An earlier result needs review.'});
 for(let i=0;i<110;i++){run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES(?,'club','member','owner','[[11,5],[11,6]]',3,'2026-10-01','confirmed','owner','2026-10-01')",'busy-'+i);run("INSERT INTO match_reviews(id,match_id,requested_by,note,match_revision,original_games,created_at) VALUES(?,?,'member','Review',0,'[[11,5],[11,6]]','2099-01-01')",'busy-review-'+i,'busy-'+i);}
 assert.ok((await matchRecord(db,'owner','focused-result')).reviews.some(r=>r.id==='focused-review'),'focused history is independent of the inbox request limit');sql.close();
}
console.log('Passed: an exact-match review remains accessible beyond the global 100-request queue.');
