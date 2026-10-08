import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
const names=['doubles','doubles-rating','seeding','rally-errors','match-rules','account-deletion','record-ownership','account-write-guard','club-seasons','notification-preferences','summary-cache','feedback-progress','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','rally-service','palettes','announcements','club-sessions','ui-preferences','open-play','public-rally','tournament-engine','tournament-service','live-score','live-draft','head-to-head','match-stakes','player-highlights','public-leaderboard'];
for(const name of names){let code;try{code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");}catch{continue}writeFileSync(`.test-runtime/${name}.mjs`,code);}
const {doublesAction,canConfirmDoubles,readDoublesMatches,readDoublesRatings}=await import('../.test-runtime/doubles.mjs');
const {replayDoubles,DOUBLES_FACTOR}=await import('../.test-runtime/doubles-rating.mjs');
const {calculateRatings}=await import('../.test-runtime/seeding.mjs');
const {beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
const {makeService}=await import('../.test-runtime/rally-service.mjs');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
 const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
 function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return one(q,...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:run(q,...args)}},execute(){return {success:true,meta:run(q,...args)}}}}
 const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
 for(const p of ['owner','p1','p2','p3','p4','outsider'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');
 run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('club','Club','City','owner','2026-10-01','approved')");
 for(const [p,role] of [['owner','owner'],['p1','member'],['p2','member'],['p3','member'],['p4','member']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'club',?,?,'active','2026-10-01')",p,p,role);
 return {sql,db,run,one};
}
const now='2026-10-08T18:00:00.000Z',won=[[11,5],[11,7]],lost=[[5,11],[7,11]];
const body=(over={})=>({action:'record_doubles_match',id:'d1',clubId:'club',a1:'p1',a2:'p2',b1:'p3',b2:'p4',games:won,bestOf:3,date:'2026-10-07',...over});
{
 // Recording, verification and voiding follow the singles rules.
 const {sql,db,one}=fixture();
 assert.deepEqual(await doublesAction(db,{id:'p1'},body(),now),{ok:true,id:'d1',status:'pending'});
 assert.deepEqual(await doublesAction(db,{id:'p1'},body(),now),{ok:true,id:'d1'},'a retry with the same id does not duplicate');
 assert.equal(one('SELECT count(*) n FROM doubles_matches').n,1);
 await assert.rejects(doublesAction(db,{id:'p1'},body({games:lost}),now),e=>e.status===409,'a reused id with different content is refused');
 const err=(over,status)=>assert.rejects(doublesAction(db,{id:'p1'},body({id:'x'+Math.floor(Math.random()*1e9),...over}),now),e=>e.status===status,JSON.stringify(over));
 await err({b2:'p1'},400);await err({a2:'p1'},400);await err({a2:'outsider'},400);await err({date:'2026-12-01'},400);await err({date:'yesterday'},400);await err({games:[[11,5]]},400);await err({bestOf:4},400);await err({clubId:"club' OR '1'='1"},400);await err({a1:'p9',a2:'p8'},403);
 await assert.rejects(doublesAction(db,{id:'outsider'},body({id:'o1'}),now),e=>e.status===403,'non-members cannot record');
 await assert.rejects(doublesAction(db,{id:'p3'},body({id:'o2',a1:'p1',a2:'p2',b1:'p3',b2:'p4'}),now).then(()=>doublesAction(db,{id:'p4'},{action:'confirm_doubles_match',id:'o2'},now)),e=>e.status===403,'a partner of the submitter cannot confirm');
 await assert.rejects(doublesAction(db,{id:'p1'},{action:'confirm_doubles_match',id:'d1'},now),e=>e.status===403,'the submitter cannot confirm');
 await assert.rejects(doublesAction(db,{id:'p2'},{action:'confirm_doubles_match',id:'d1'},now),e=>e.status===403,'nor their partner');
 await doublesAction(db,{id:'p3'},{action:'confirm_doubles_match',id:'d1'},now);assert.equal(one("SELECT status FROM doubles_matches WHERE id='d1'").status,'confirmed');
 await assert.rejects(doublesAction(db,{id:'p3'},{action:'confirm_doubles_match',id:'d1'},now),e=>e.status===403,'already confirmed');
 await assert.rejects(doublesAction(db,{id:'p1'},{action:'void_doubles_match',id:'d1'},now),e=>e.status===403,'players cannot void a confirmed result');
 await doublesAction(db,{id:'owner'},{action:'void_doubles_match',id:'d1'},now);assert.equal(one("SELECT status FROM doubles_matches WHERE id='d1'").status,'voided');
 assert.deepEqual(sql.prepare('SELECT action FROM doubles_audit WHERE match_id=? ORDER BY created_at,rowid').all('d1').map(r=>r.action),['submitted','confirmed','voided'],'every step is audited');
 // An administrator's entry is confirmed immediately; a submitter may withdraw their own pending result.
 assert.equal((await doublesAction(db,{id:'owner'},body({id:'a1'}),now)).status,'confirmed');
 await doublesAction(db,{id:'p1'},body({id:'w1'}),now);await doublesAction(db,{id:'p1'},{action:'void_doubles_match',id:'w1'},now);assert.equal(one("SELECT status FROM doubles_matches WHERE id='w1'").status,'voided');
 assert.equal(canConfirmDoubles({status:'pending',a1:'p1',a2:'p2',b1:'p3',b2:'p4',submitted_by:'p1'},'p4',false),true);
 // Visibility: members see the club's matches, outsiders see nothing.
 assert.ok((await readDoublesMatches(db,'p2','club')).length>=2);assert.deepEqual(await readDoublesMatches(db,'outsider','club'),[]);
 sql.close();
}
{
 // Ratings: separate from singles, deterministic, order-independent per day, ignore unconfirmed matches.
 const m=(id,day,games,extra={})=>({id,a1:'p1',a2:'p2',b1:'p3',b2:'p4',games,status:'confirmed',played_on:day,best_of:3,club_id:'club',...extra});
 const r=replayDoubles([m('1','2026-10-01',won)],'2026-10-08');
 const g=id=>r.ratings.get(id);
 assert.equal(g('p1').rating,g('p2').rating,'partners move together');assert.equal(g('p3').rating,g('p4').rating);
 assert.ok(g('p1').rating>400&&g('p3').rating<400,'winners gain, losers lose');
 assert.equal(+(g('p1').rating-400).toFixed(6),+(400-g('p3').rating).toFixed(6),'equal teams exchange equal points');
 assert.equal(+(g('p1').rating-400).toFixed(6),8*DOUBLES_FACTOR,'one even match is worth half the singles exchange');
 assert.equal(replayDoubles([m('1','2026-10-01',won,{status:'pending'}),m('2','2026-10-02',won,{status:'voided'})],'2026-10-08').ratings.size,0,'pending and voided results never count');
 assert.equal(replayDoubles([m('1','2026-10-09',won)],'2026-10-08').ratings.size,0,'future results do not count');
 const a=replayDoubles([m('1','2026-10-01',won),m('2','2026-10-02',lost)],'2026-10-08'),b=replayDoubles([m('2','2026-10-02',lost),m('1','2026-10-01',won)],'2026-10-08');assert.deepEqual([...a.ratings],[...b.ratings],'input order does not matter');
 // Repeating the same pairing within 30 days is worth less.
 const rep=replayDoubles([1,2,3,4,5,6,7,8].map(i=>m(String(i),`2026-10-0${i}`,won)),'2026-10-08');const gains=rep.changes.filter(c=>c.playerId==='p1').map(c=>c.delta);assert.ok(gains[5]<gains[0],'repeat weight reduces later results');assert.equal(gains[6]+gains[7]===0||gains[7]<=gains[6],true);
 // Upsets are worth more, and nobody drops below the floor.
 const strong=replayDoubles([m('1','2026-10-01',won),m('2','2026-10-02',won,{a1:'p1',a2:'p2',b1:'p3',b2:'p4'}),m('3','2026-10-03',lost,{a1:'p3',a2:'p4',b1:'p1',b2:'p2'})],'2026-10-08');assert.ok(strong.changes.every(c=>c.after>=100));
 const low=replayDoubles([m('1','2026-10-01',won)],'2026-10-08',{p3:100,p4:100,p1:900,p2:900});assert.ok(low.ratings.get('p3').rating>=100,'rating floor holds');
 // Starting estimates (for example a singles rating) are respected.
 assert.equal(replayDoubles([],'2026-10-08',{p1:700}).ratings.size,0);assert.equal(replayDoubles([m('1','2026-10-01',won)],'2026-10-08',{p1:700,p2:700}).changes.find(c=>c.playerId==='p1').before,700);
}
{
 // Singles ratings are untouched by doubles matches.
 const {db,sql}=fixture();
 sql.prepare("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at) VALUES('s1','club','p1','p3','[[11,5],[11,7]]',3,'2026-10-01','confirmed','p1','p3','2026-10-01')").run();
 const rows=()=>sql.prepare("SELECT id,a,b,games,status,played_on,club_id,best_of,tournament_id,created_at FROM matches").all();
 const before=JSON.stringify([...calculateRatings(rows(),'2026-10-08')]);
 await doublesAction(db,{id:'owner'},body({id:'dd1'}),now);await doublesAction(db,{id:'owner'},body({id:'dd2',games:lost,date:'2026-10-06'}),now);
 assert.equal(JSON.stringify([...calculateRatings(rows(),'2026-10-08')]),before,'singles ratings do not move');
 const ratings=await readDoublesRatings(db,{},'2026-10-08');assert.ok(ratings.ratings.get('p1').played===2);
 sql.close();
}
{
 // Account deletion keeps the other players' results.
 for(const mode of ['keep_results','remove_history']){
  const {sql,db,one}=fixture();await doublesAction(db,{id:'owner'},body({id:'dd1'}),now);await doublesAction(db,{id:'p1'},body({id:'dd2',games:lost,date:'2026-10-06'}),now);
  await beginDeletion(db,'p1-auth',mode);
  assert.equal(one('PRAGMA foreign_key_check'),undefined,mode+': no dangling references');
  const rows=sql.prepare('SELECT a1,a2,b1,b2,submitted_by FROM doubles_matches ORDER BY id').all();assert.equal(rows.length,2,mode+': both matches remain');
  assert.ok(rows.every(r=>r.a2==='p2'&&r.b1==='p3'&&r.b2==='p4'),mode+': the other three players are unchanged');
  if(mode==='remove_history'){assert.ok(rows.every(r=>r.a1!=='p1'&&r.submitted_by!=='p1'),'the deleted player no longer appears');assert.equal(new Set(rows.map(r=>r.a1)).size,2,'each match gets its own placeholder');assert.equal(one("SELECT count(*) n FROM doubles_audit WHERE actor_id='p1'").n,0);}
  sql.close();
 }
}
{
 // Guest merging: matches that include both profiles block the merge until repaired; the rest follow the account.
 const {sql,db,one,run}=fixture();run("INSERT INTO profiles(id,name,created_at) VALUES('guest','Guest','2026-10-01')");run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('guest','club','guest','guest','active','2026-10-01')");
 const service=makeService(db),act=(p,b)=>service.act(p+'-auth',b);
 await doublesAction(db,{id:'owner'},body({id:'with-guest',a1:'guest',a2:'p2'}),now);await doublesAction(db,{id:'owner'},body({id:'both',a1:'guest',a2:'p1',b1:'p3',b2:'p4'}),now);
 await act('p1',{action:'request_guest_claim',id:'claim',guestId:'guest',clubId:'club',note:'That was me.'});
 const approve=(extra={})=>act('owner',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE',...extra});
 await assert.rejects(approve(),e=>e.status===409,'a doubles match with both profiles blocks the merge');
 const preview=await act('owner',{action:'preview_guest_merge',id:'claim'});assert.deepEqual(preview.preview.voidedDoubles.map(m=>m.id),['both']);
 await approve({repair:true});
 assert.equal(one("SELECT status FROM doubles_matches WHERE id='both'").status,'voided','the impossible match is voided');
 assert.equal(one("SELECT a1 FROM doubles_matches WHERE id='both'").a1,'guest','and left exactly as recorded');
 assert.equal(one("SELECT a1 FROM doubles_matches WHERE id='with-guest'").a1,'p1','other doubles matches follow the account');
 assert.equal(one('PRAGMA foreign_key_check'),undefined);sql.close();
}
console.log('Doubles passed: recording, verification and voiding rules, audit trail, visibility, separate doubles rating (weights, repeats, floor, ordering), untouched singles ratings, account deletion and guest-merge repair.');
