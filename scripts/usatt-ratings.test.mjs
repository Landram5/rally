import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','rally-service','tournament-service','tournament-engine','match-rules','rally-errors','seeding','public-rally'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {makeService}=await import('../.test-runtime/rally-service.mjs');
const {readActivityPage}=await import('../.test-runtime/activity-pages.mjs');
const {calculateRatings,ratingHistory,performanceEstimate,pointExchange,suggestSeeds}=await import('../.test-runtime/seeding.mjs');
const {seasonStandings}=await import('../.test-runtime/club-seasons.mjs');
const boundaries=[[0,8,8],[12,8,8],[13,7,10],[37,7,10],[38,6,13],[62,6,13],[63,5,16],[87,5,16],[88,4,20],[112,4,20],[113,3,25],[137,3,25],[138,2,30],[162,2,30],[163,2,35],[187,2,35],[188,1,40],[212,1,40],[213,1,45],[237,1,45],[238,0,50],[800,0,50]];
for(const [gap,expected,upset] of boundaries){assert.equal(pointExchange(1500+gap,1500),expected);assert.equal(pointExchange(1500,1500+gap),upset);}
assert.equal(performanceEstimate([1800,1620,1500],[1400,1460,1525]),1570);
assert.equal(performanceEstimate([1800,1750,1730],[1400,1630,1722]),1662);
assert.equal(performanceEstimate([1800,1610,1438],[1400,1410,1420]),1528);
assert.equal(performanceEstimate([1400,1300],[1600],1000),1400);
assert.equal(performanceEstimate([1400,1300],[1600],1000,true),1350);
assert.equal(performanceEstimate([1800],[],1000),1800);
assert.equal(performanceEstimate([],[800],1000),800);
assert.equal(performanceEstimate([],[100],1000),200);
const match=(id,a,b,winner,extra={})=>({id,a,b,games:winner===a?[[11,5],[11,5]]:[[5,11],[5,11]],status:'confirmed',played_on:'2026-10-06',created_at:id,...extra});
for(const weight of [1,2,3]){const m=match('equal','a','b','a',weight===1?{}:{tournament_id:'t',tournament_weight:weight}),r=calculateRatings([m],undefined,{a:1500,b:1500});assert.equal(r.get('a').rating,1500+8*weight);assert.equal(r.get('b').rating,1500-8*weight);}
// A known reference supports opponent-based initial rating for an unrated player.
const first=ratingHistory([match('win','new','rated','new')],'new',undefined,{rated:1800});assert.equal(first.initialRating,1800);assert.equal(first.rating,1808);assert.equal(first.played,1);
const initialMixed=ratingHistory([match('win','new','low','new'),match('loss','new','high','high')],'new',undefined,{low:1200,high:1600});assert.equal(initialMixed.initialRating,1200);
const standardMatches=Array.from({length:8},(_,i)=>match('s'+i,'a','b','a')),standard=ratingHistory(standardMatches,'a',undefined,{a:1000,b:1000});assert.equal(standard.changes.reduce((s,c)=>s+c.adjustment,0),64);assert.equal(standard.rating,1104);assert.equal(standard.played,8);assert.equal(standard.changes.reduce((s,c)=>s+c.currentContribution,0),104);
const specialMatches=[match('u1','a','b','a'),match('u2','a','c','a'),match('u3','a','d','a')],special=ratingHistory(specialMatches,'a',undefined,{a:1000,b:1800,c:1900,d:2000});assert.equal(special.changes.reduce((s,c)=>s+c.adjustment,0),950);assert.equal(special.initialRating,1000);
const aged=standardMatches.map(m=>({...m,played_on:'2024-10-06'}));assert.equal(ratingHistory(aged,'a','2025-10-06',{a:1000,b:1000}).rating,1052);assert.equal(ratingHistory(aged,'a','2026-10-06',{a:1000,b:1000}).rating,1000);
const safe=calculateRatings(Array.from({length:50},(_,i)=>match('floor'+i,'a','b','a',{played_on:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)})),undefined,{a:200,b:200});assert.ok(safe.get('b').rating>=100);assert.ok(safe.get('a').rating<=300);
assert.deepEqual(calculateRatings([...standardMatches].reverse(),undefined,{a:1000,b:1000}),calculateRatings(standardMatches,undefined,{a:1000,b:1000}));
assert.equal(suggestSeeds(['unplayed'],[],undefined,{unplayed:1750})[0].rating,1750);
const season={id:'s',club_id:'club',name:'Season',starts_on:'2026-01-01',ends_on:'2026-12-31',closed_at:null,created_by:'owner',revision:0,created_at:'2026-01-01'};assert.equal(seasonStandings(season,[{player_id:'a',name:'A',status:'active',initial_rating:1500},{player_id:'b',name:'B',status:'active',initial_rating:1500}],[match('season','a','b','a')]).players[0].rating,1508);
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
 const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return one(q,...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:run(q,...args)}},execute(){return {success:true,meta:run(q,...args)}}};}
 const db={prepare:stmt,beforeBatch:null,async batch(stmts){if(this.beforeBatch){const cb=this.beforeBatch;this.beforeBatch=null;cb();}sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 for(const p of ['owner','admin','board','member','second','pending','other'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');run("INSERT INTO profiles(id,name,created_at) VALUES('guest','Guest','2026-10-01')");run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('club','Club','City','owner','2026-10-01','approved')");for(const [p,role] of [['owner','owner'],['admin','admin'],['board','board'],['member','member'],['second','member'],['guest','guest']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'club',?,?,'active','2026-10-01')",p,p,role);run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('pending','club','pending','member','pending','2026-10-01')");
 const service=makeService(db),act=(p,b,access)=>service.act(p+'-auth',b,access),payload=(player,rating=1500)=>({action:'set_initial_rating',operationId:crypto.randomUUID(),clubId:'club',playerId:player,rating,note:'Coach assessment; no official rating import.',revision:0});return {sql,db,run,one,service,act,payload};
}
{
 const {db,one,run,service,act,payload}=fixture(),p=payload('second',1750);
 await assert.rejects(()=>act('member',p),e=>e.status===403);await act('owner',p);assert.equal(one("SELECT initial_rating FROM profiles WHERE id='second'").initial_rating,1750);assert.equal(one('SELECT count(*) n FROM rating_estimate_history').n,1);const epoch=one('SELECT version FROM summary_epoch').version;assert.ok(epoch>0);await act('owner',p);assert.equal(one('SELECT count(*) n FROM rating_estimate_history').n,1);assert.equal(one('SELECT version FROM summary_epoch').version,epoch);
 await assert.rejects(()=>act('admin',{...payload('second',1800),revision:1}),e=>e.status===403);await assert.rejects(()=>act('owner',{...p,note:'Changed payload'}),e=>e.status===409);
 await act('board',payload('guest',900));await act('admin',payload('member',1250));await assert.rejects(()=>act('owner',payload('pending')),e=>e.status===404);
 for(const rating of [199,4001,1000.5])await assert.rejects(()=>act('owner',payload('owner',rating)),e=>e.status===400);await assert.rejects(()=>act('owner',{...payload('owner'),note:''}),e=>e.status===400);
 await act('owner',{...payload('second',1850),revision:1},{isSiteAdmin:true});assert.equal(one("SELECT initial_rating_revision n FROM profiles WHERE id='second'").n,2);await assert.rejects(()=>act('owner',{...payload('second',1900),revision:1},{isSiteAdmin:true}),e=>e.status===409);
 const publicRoster=await readActivityPage(db,null,{view:'members',club:'club'});assert.equal(publicRoster.items.find(p=>p.id==='second').initial_rating,1850);assert.ok(!JSON.stringify(publicRoster).includes('Coach assessment'));
 run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at) VALUES('m','club','second','member','[[11,5],[11,5]]',3,'2026-10-06','confirmed','owner','owner','2026-10-06')");
 const before=await service.read('owner-auth',{compact:true});assert.equal(before.matches[0].a_initial_rating,1850);assert.equal(before.summaries.club.ratings.second.rating,1850);assert.equal(before.players.find(p=>p.id==='second').initial_rating,1850);
 await act('owner',{...payload('second',2000),revision:2},{isSiteAdmin:true});const after=await service.read('owner-auth',{compact:true});assert.equal(after.summaries.club.ratings.second.rating,2000,'Estimate changes invalidate cached standings');assert.equal(one('PRAGMA foreign_key_check'),undefined);
 db.beforeBatch=()=>run("UPDATE memberships SET role='member' WHERE player_id='admin'");await assert.rejects(()=>act('admin',payload('owner')),e=>e.status===409);assert.equal(one("SELECT initial_rating FROM profiles WHERE id='owner'").initial_rating,null);
}
{
 const {act,payload,run,service,one}=fixture();await act('owner',payload('guest',1600));await act('member',{action:'request_guest_claim',id:'claim',clubId:'club',guestId:'guest',note:'This was my visiting record.'});await act('owner',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE'});assert.equal(one("SELECT initial_rating FROM profiles WHERE id='member'").initial_rating,1600,'Guest merge preserves an initial estimate when the account has none');assert.equal(one('PRAGMA foreign_key_check'),undefined);
}
console.log('USATT-style ratings passed exchange boundaries, published adjustment examples, initial anchors, provisional evidence, tournament multipliers, adjustments/decay, floors, chronological replay, seasons, estimate permissions, audit/idempotency, stale/revoked writes, cache invalidation, public privacy and guest merges.');
