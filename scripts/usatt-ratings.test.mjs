import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-seasons','notification-preferences','summary-cache','feedback-progress','record-ownership','dashboards','clubhouse-summary','rally','activity-pages','match-changes','head-to-head','player-highlights','match-stakes','match-filters','logistics','notifications','profile-photo','account-write-guard','account-deletion','announcements','club-sessions','weekly-sessions','rally-service','tournament-service','tournament-scheduling','tournament-engine','match-rules','rally-errors','seeding','public-rally'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
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
assert.equal(performanceEstimate([],[]),400,'unreferenced initial ratings start at 400');
assert.equal(ratingHistory([],'new').rating,400,'empty histories use the default baseline');
assert.equal(suggestSeeds(['new'],[])[0].rating,400,'unrated seed fallback uses the same baseline');
const match=(id,a,b,winner,extra={})=>({id,a,b,games:winner===a?[[11,5],[11,5]]:[[5,11],[5,11]],status:'confirmed',played_on:'2026-10-06',created_at:id,...extra});
for(const weight of [1,2,3]){const m=match('equal','a','b','a',weight===1?{}:{tournament_id:'t',tournament_weight:weight}),r=calculateRatings([m],undefined,{a:1500,b:1500});assert.equal(r.get('a').rating,1500+8*weight);assert.equal(r.get('b').rating,1500-8*weight);}
// A known reference supports opponent-based initial rating for an unrated player.
const first=ratingHistory([match('win','new','rated','new')],'new',undefined,{rated:1800});assert.equal(first.initialRating,1800);assert.equal(first.rating,1808);assert.equal(first.played,1);
const initialMixed=ratingHistory([match('win','new','low','new'),match('loss','new','high','high')],'new',undefined,{low:1200,high:1600});assert.equal(initialMixed.initialRating,1200);
const standardMatches=Array.from({length:8},(_,i)=>match('s'+i,'a','b'+i,'a')),standardEstimates={a:1000,...Object.fromEntries(standardMatches.map(m=>[m.b,1000]))},standard=ratingHistory(standardMatches,'a',undefined,standardEstimates);assert.equal(standard.changes.reduce((s,c)=>s+c.adjustment,0),64);assert.equal(standard.rating,1104);assert.equal(standard.played,8);assert.equal(standard.changes.reduce((s,c)=>s+c.currentContribution,0),104);
const specialMatches=[match('u1','a','b','a'),match('u2','a','c','a'),match('u3','a','d','a')],special=ratingHistory(specialMatches,'a',undefined,{a:1000,b:1800,c:1900,d:2000});assert.equal(special.changes.reduce((s,c)=>s+c.adjustment,0),950);assert.equal(special.initialRating,1000);
const aged=standardMatches.map(m=>({...m,played_on:'2024-10-06'}));assert.equal(ratingHistory(aged,'a','2025-10-06',standardEstimates).rating,1052);assert.equal(ratingHistory(aged,'a','2026-10-06',standardEstimates).rating,1000);
const safe=calculateRatings(Array.from({length:50},(_,i)=>match('floor'+i,'a','b','a',{played_on:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)})),undefined,{a:200,b:200});assert.ok(safe.get('b').rating>=100);assert.ok(safe.get('a').rating<=300);
assert.deepEqual(calculateRatings([...standardMatches].reverse(),undefined,standardEstimates),calculateRatings(standardMatches,undefined,standardEstimates));
assert.equal(suggestSeeds(['unplayed'],[],undefined,{unplayed:1750})[0].rating,1750);
const season={id:'s',club_id:'club',name:'Season',starts_on:'2026-01-01',ends_on:'2026-12-31',closed_at:null,created_by:'owner',revision:0,created_at:'2026-01-01'};assert.equal(seasonStandings(season,[{player_id:'a',name:'A',status:'active',initial_rating:1500},{player_id:'b',name:'B',status:'active',initial_rating:1500}],[match('season','a','b','a')]).players[0].rating,1508);

// Repeated pairs share one rolling window, with five full-weight matches.
const repeated=Array.from({length:10},(_,i)=>match('repeat'+String(i).padStart(2,'0'),'a','b','a'));
const repeatedA=ratingHistory(repeated,'a',undefined,{a:1000,b:1000}),repeatedB=ratingHistory(repeated,'b',undefined,{a:1000,b:1000});
assert.deepEqual([...repeatedA.changes].reverse().map(c=>c.repeatWeight),[1,1,1,1,1,.5,.25,0,0,0]);
assert.deepEqual([...repeatedA.changes].reverse().map(c=>c.delta),[8,8,8,8,8,4,2,0,0,0]);
assert.equal(repeatedA.rating,1046);assert.equal(repeatedB.rating,954);assert.equal(repeatedA.played,10);assert.equal(repeatedA.distinctOpponents,1);
assert.equal(repeatedA.changes.reduce((s,c)=>s+c.adjustment,0),0,'one opponent cannot trigger an underrated adjustment');
assert.deepEqual(ratingHistory([...repeated].reverse(),'a',undefined,{a:1000,b:1000}),repeatedA);
assert.equal(calculateRatings(repeated,undefined,{a:1000,b:1000}).get('a').distinctOpponents,1);
assert.equal(suggestSeeds(['a','b'],repeated,undefined,{a:1000,b:1000})[0].rating,1046);
const repeatedSeason=seasonStandings(season,[{player_id:'a',name:'A',status:'active',initial_rating:1000},{player_id:'b',name:'B',status:'active',initial_rating:1000}],repeated);
assert.equal(repeatedSeason.players[0].rating,1046);assert.equal(repeatedSeason.players[0].distinctOpponents,1);
for(const weight of [2,3]){const events=repeated.map(m=>({...m,tournament_id:'event',tournament_weight:weight}));const h=ratingHistory(events,'a',undefined,{a:1000,b:1000});assert.equal(h.rating,1000+46*weight);assert.equal(h.changes[0].delta,0,'tournaments do not bypass the limit');}
const crossBoundary=repeated.slice(0,5).map(m=>({...m,club_id:'one',played_on:'2026-10-01'}));
crossBoundary.push(match('sixth','b','a','b',{club_id:'two',tournament_id:'other',tournament_weight:3,played_on:'2026-10-02'}));
const crossing=ratingHistory(crossBoundary,'a');assert.equal(crossing.changes[0].repeatWeight,.5);assert.equal(crossing.changes[0].pairMatchNumber,6);
const windowMatches=repeated.slice(0,5).map(m=>({...m,played_on:'2026-09-01'}));windowMatches.push(match('day29','a','b','a',{played_on:'2026-09-30'}),match('day30','a','b','a',{played_on:'2026-10-01'}));
const windowHistory=ratingHistory(windowMatches,'a');assert.equal(windowHistory.changes.find(c=>c.matchId==='day29').repeatWeight,.5);assert.equal(windowHistory.changes.find(c=>c.matchId==='day30').repeatWeight,1);assert.equal(windowHistory.changes.find(c=>c.matchId==='day30').pairMatchNumber,2,'only September 30 remains in the window');
const excluded=[...repeated.slice(0,5).map(m=>({...m,status:'pending'})),match('only','a','b','a')];assert.equal(ratingHistory(excluded,'a').changes[0].repeatWeight,1,'pending matches do not consume allowance');
const counted=calculateRatings([match('recent','a','b','a'),match('old','a','c','a',{played_on:'2024-10-06'}),match('pending','a','d','a',{status:'pending'}),match('void','a','e','a',{status:'voided'}),match('future','a','f','a',{played_on:'2027-10-06'}),match('walkover','a','g','a',{games:[]})],'2026-10-06');assert.equal(counted.get('a').distinctOpponents,1,'only recent verified played opponents count');
const repeatedUpsets=ratingHistory(repeated,'a',undefined,{a:400,b:1800});assert.equal(repeatedUpsets.changes.reduce((s,c)=>s+c.adjustment,0),0,'same-opponent upset wins do not satisfy adjustment diversity');
assert.equal(ratingHistory(repeated.map(m=>({...m,played_on:'2024-10-06'})),'a','2025-10-06',{a:1000,b:1000}).rating,1023,'discounts age after being applied');
assert.equal(ratingHistory(repeated.map(m=>({...m,played_on:'2024-10-06'})),'a','2026-10-06',{a:1000,b:1000}).distinctOpponents,0);
console.log('Repeated opponents passed five full matches, symmetry, records, rolling boundaries, tournament/club crossover, adjustment diversity, aging and shared seeds/seasons.');

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
{
 const {ratingChangesByMatch}=await import('../.test-runtime/seeding.mjs');
 const sample=[
  {id:'rc1',a:'p',b:'q',games:[[11,5],[11,8]],status:'confirmed',played_on:'2026-09-01',created_at:'2026-09-01T10:00:00Z',best_of:3,club_id:'c'},
  {id:'rc2',a:'q',b:'r',games:[[11,9],[8,11],[11,7]],status:'confirmed',played_on:'2026-09-02',created_at:'2026-09-02T10:00:00Z',best_of:3,club_id:'c'},
  {id:'rc3',a:'p',b:'r',games:[[7,11],[11,9],[9,11]],status:'confirmed',played_on:'2026-09-03',created_at:'2026-09-03T10:00:00Z',best_of:3,club_id:'c'},
  {id:'rc4',a:'p',b:'q',games:[[11,0],[11,0]],status:'pending',played_on:'2026-09-04',created_at:'2026-09-04T10:00:00Z',best_of:3,club_id:'c'}];
 const shown=ratingChangesByMatch(sample,'2026-10-07');
 for(const player of ['p','q','r'])for(const c of ratingHistory(sample,player,'2026-10-07').changes)assert.equal(shown[c.matchId][player],Math.round(c.delta*10)/10,'displayed change equals the rating history change');
 assert.equal(shown.rc4,undefined,'pending results show no rating change');
 assert.deepEqual(Object.keys(shown.rc1).sort(),['p','q'],'both players receive a displayed change');
}{
 const {headToHeadSummary}=await import('../.test-runtime/head-to-head.mjs');
 const meet=[{id:'h1',playedOn:'2026-09-01',games:[[11,5],[11,8]],clubName:'C',tournamentId:null},{id:'h2',playedOn:'2026-09-10',games:[[7,11],[9,11]],clubName:'C',tournamentId:null},{id:'h3',playedOn:'2026-09-20',games:[[11,9],[8,11],[11,7]],clubName:'C',tournamentId:'t'}];
 const s=headToHeadSummary(meet);
 assert.equal(s.played,3);assert.equal(s.aWins,2);assert.equal(s.bWins,1);assert.equal(s.aGames,4);assert.equal(s.bGames,3);
 assert.equal(s.last.id,'h3','most recent meeting is last');assert.deepEqual(s.streak,{holder:'a',length:1});
 assert.equal(s.marginPerGame,Math.round((meet.flatMap(m=>m.games).reduce((n,g)=>n+g[0]-g[1],0))/7*10)/10);
 const none=headToHeadSummary([]);assert.equal(none.played,0);assert.equal(none.last,null);assert.equal(none.streak.holder,null);
}{
 const {playerHighlights,UPSET_GAP}=await import('../.test-runtime/player-highlights.mjs');
 const c=(matchId,date,won,before,after,opponentRating)=>({matchId,date,won,before,after,opponentRating,opponentId:'o'+matchId});
 const newestFirst=[c('m6','2026-06-06',false,1500,1490,1400),c('m5','2026-06-05',true,1450,1500,1600),c('m4','2026-06-04',true,1400,1450,1420),c('m3','2026-06-03',true,1380,1400,1300),c('m2','2026-06-02',false,1420,1380,1500),c('m1','2026-06-01',true,1400,1420,1380)];
 const h=playerHighlights(newestFirst);
 assert.equal(h.bestRating.value,1500);assert.equal(h.bestRating.date,'2026-06-05');
 assert.equal(h.longestWinStreak,3);assert.equal(h.currentWinStreak,0,'current streak resets on a loss');
 assert.equal(h.biggestUpset.matchId,'m5');assert.equal(h.biggestUpset.gap,150);assert.ok(UPSET_GAP>0);
 assert.equal(playerHighlights([]).bestRating,null);assert.equal(playerHighlights([]).biggestUpset,null);
 assert.equal(playerHighlights([c('x','2026-01-01',true,1400,1450,1450)]).biggestUpset,null,'a small rating gap is not an upset');
}{
 const {matchStakes}=await import('../.test-runtime/match-stakes.mjs');
 const {ratingChangesByMatch}=await import('../.test-runtime/seeding.mjs');
 const mk=(id,a,b,games,day)=>({id,a,b,games,status:'confirmed',played_on:day,created_at:day+'T10:00:00Z',best_of:3,club_id:'c',tournament_id:null});
 const history=[mk('s1','p','q',[[11,5],[11,8]],'2026-09-01'),mk('s2','p','r',[[11,6],[11,9]],'2026-09-02'),mk('s3','q','r',[[11,9],[8,11],[11,7]],'2026-09-03'),mk('s4','p','q',[[11,4],[11,6]],'2026-09-04'),mk('s5','r','q',[[11,7],[11,8]],'2026-09-05')];
 const input={bestOf:3,clubId:'c',playedOn:'2026-10-01'},today='2026-10-07';
 const stakes=matchStakes(history,'p','q',input,{},today);
 for(const [winner,key] of [['p','aWins'],['q','bWins']]){
  const real={id:'real',a:'p',b:'q',games:winner==='p'?[[11,7],[11,7]]:[[7,11],[7,11]],status:'confirmed',played_on:'2026-10-01',created_at:new Date().toISOString(),best_of:3,club_id:'c',tournament_id:null};
  const actual=ratingChangesByMatch([...history,real],today).real;
  assert.equal(stakes[key].a,actual.p,'predicted change equals the recorded change for '+key);assert.equal(stakes[key].b,actual.q);
 }
 assert.ok(stakes.aWins.a>0&&stakes.aWins.b<0&&stakes.bWins.b>0&&stakes.bWins.a<0,'winner gains and loser loses');
 assert.equal(matchStakes(history,'p','p',input,{},today),null);assert.equal(matchStakes(history,'p','q',{...input,bestOf:4},{},today),null);assert.equal(matchStakes(history,'p','q',{...input,playedOn:'not-a-date'},{},today),null);
 const single=matchStakes(history,'p','q',{...input,bestOf:1},{},today);assert.match(single.weight,/33%/);assert.ok(Math.abs(single.aWins.a)<=Math.abs(stakes.aWins.a)+1e-9,'single games carry less weight');
 assert.equal(history.length,5,'inputs are not mutated');
}console.log('USATT-style ratings passed exchange boundaries, published adjustment examples, initial anchors, provisional evidence, tournament multipliers, adjustments/decay, floors, chronological replay, seasons, estimate permissions, audit/idempotency, stale/revoked writes, cache invalidation, public privacy and guest merges.');
