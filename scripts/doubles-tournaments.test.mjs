import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
const names=['doubles','doubles-rating','seeding','rally-errors','match-rules','account-deletion','record-ownership','account-write-guard','club-seasons','notification-preferences','summary-cache','feedback-progress','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','rally-service','palettes','announcements','club-sessions','ui-preferences','open-play','public-rally','tournament-engine','tournament-service','tournament-scheduling','live-score','live-draft','head-to-head','match-stakes','player-highlights','public-leaderboard','fixture-label','bracket-layout'];
for(const name of names){let code;try{code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");}catch{continue}writeFileSync(`.test-runtime/${name}.mjs`,code);}
const {makeService}=await import('../.test-runtime/rally-service.mjs');
const {readDoublesRatings}=await import('../.test-runtime/doubles.mjs');
const {beginDeletion}=await import('../.test-runtime/account-deletion.mjs');
const {calculateRatings}=await import('../.test-runtime/seeding.mjs');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
 const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a),all=(q,...a)=>sql.prepare(q).all(...a);
 function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return one(q,...args)??null},async all(){return {results:all(q,...args)}},async run(){return {success:true,meta:run(q,...args)}},execute(){return {success:true,meta:run(q,...args)}}}}
 const db={prepare:stmt,beforeBatch:null,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
 for(const p of ['owner','p1','p2','p3','p4','p5','p6','p7','p8','outsider'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p.toUpperCase(),'2026-10-01');
 run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES('club','Club','City','owner','2026-10-01','approved')");
 for(const [p,role] of [['owner','owner'],...['p1','p2','p3','p4','p5','p6','p7','p8'].map(p=>[p,'member'])])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,'club',?,?,'active','2026-10-01')",p,p,role);
 const service=makeService(db),act=(p,b)=>service.act(p+'-auth',b);
 const go=(p,id,action,body={})=>act(p,{id,action,revision:one('SELECT revision FROM tournaments WHERE id=?',id).revision,operationId:crypto.randomUUID(),...body});
 const doublesEvent=(id,capacity=8,format='Single elimination')=>act('owner',{action:'create_tournament',id,clubId:'club',name:id,date:'2026-10-20',format,capacity,teamSize:2});
 return {sql,db,run,one,all,act,go,doublesEvent,service};
}
{
 // Creating a doubles event, and registration rules.
 const {sql,act,go,one,all,doublesEvent}=fixture();
 await assert.rejects(act('owner',{action:'create_tournament',id:'bad',clubId:'club',name:'x',date:'2026-10-20',format:'Swiss',capacity:8,teamSize:3}),e=>e.status===400,'only singles or doubles');
 await act('owner',{action:'create_tournament',id:'singles',clubId:'club',name:'Singles',date:'2026-10-20',format:'Single elimination',capacity:8});assert.equal(one("SELECT team_size FROM tournaments WHERE id='singles'").team_size,1,'singles stays the default');
 await assert.rejects(go('owner','singles','enter_team',{partnerId:'p2'}),e=>e.status===409,'singles events do not take teams');
 await doublesEvent('d',4);assert.equal(one("SELECT team_size FROM tournaments WHERE id='d'").team_size,2);
 await assert.rejects(go('p1','d','enter_tournament',{playerId:'p1'}),e=>e.status===409,'doubles events do not take single entries');
 await assert.rejects(go('p1','d','join_waitlist',{playerId:'p1'}),e=>e.status===409);
 await go('p1','d','enter_team',{partnerId:'p2'});assert.equal(all("SELECT p1,p2 FROM doubles_teams WHERE tournament_id='d'").length,1);
 await assert.rejects(go('p1','d','enter_team',{partnerId:'p3'}),e=>e.status===409,'a player is on one team only');
 await assert.rejects(go('p3','d','enter_team',{partnerId:'p2'}),e=>e.status===409,'a partner already on a team cannot be taken');
 await assert.rejects(go('p3','d','enter_team',{partnerId:'p3'}),e=>e.status===400,'a team needs two different players');
 await assert.rejects(go('p3','d','enter_team',{partnerId:'outsider'}),e=>e.status===403,'non-members need the visitor setting');
 await assert.rejects(go('p3','d','enter_team',{playerId:'p5',partnerId:'p4'}),e=>e.status===403,'players cannot enter a team they are not on');
 await go('owner','d','enter_team',{playerId:'p3',partnerId:'p4'});assert.equal(all("SELECT id FROM doubles_teams WHERE tournament_id='d'").length,2,'an organizer can enter a team');
 await go('p5','d','enter_team',{partnerId:'p6'});await go('p7','d','enter_team',{partnerId:'p8'});
 await assert.rejects(go('outsider','d','enter_team',{partnerId:'p1'}),e=>e.status===403||e.status===409);
 await assert.rejects(go('owner','d','enter_team',{playerId:'p1',partnerId:'owner'}),e=>e.status===409||e.status===403,'the field is full');
 // Withdrawal: team members or an organizer only.
 const team=one("SELECT id FROM doubles_teams WHERE p1='p5'").id;
 await assert.rejects(go('p1','d','remove_team',{teamId:team}),e=>e.status===403,'another team cannot withdraw this one');
 await go('p6','d','remove_team',{teamId:team});assert.equal(all("SELECT id FROM doubles_teams WHERE tournament_id='d'").length,3,'a team member can withdraw their team');
 await go('p5','d','enter_team',{partnerId:'p6'});assert.equal(all("SELECT id FROM doubles_teams WHERE tournament_id='d'").length,4,'players can register again after withdrawing');
 await assert.rejects(go('owner','d','set_capacity',{capacity:3}),e=>e.status===400,'the limit cannot drop below the teams entered');
 // The database also refuses a player on two teams or a team in a singles event.
 assert.throws(()=>sql.prepare("INSERT INTO doubles_teams(id,tournament_id,p1,p2,created_at) VALUES('x','d','p1','owner','2026-10-01')").run(),/one team/);
 assert.throws(()=>sql.prepare("INSERT INTO doubles_teams(id,tournament_id,p1,p2,created_at) VALUES('y','singles','p1','owner','2026-10-01')").run(),/doubles event/);
 sql.close();
}
{
 // Running a doubles tournament: draw, results, corrections, ratings.
 const {sql,db,act,go,one,all,doublesEvent}=fixture();
 await doublesEvent('d',4);const teamsIn=[['p1','p2'],['p3','p4'],['p5','p6'],['p7','p8']];for(const [a,b] of teamsIn)await go('owner','d','enter_team',{playerId:a,partnerId:b});
 await assert.rejects(go('p1','d','score_fixture',{fixtureId:'x',games:[[11,5],[11,5]]}),e=>e.status===403||e.status===409,'nothing to score before the draw');
 await go('owner','d','start_tournament',{bestOf:3});
 const draw=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='d'").state_json),teamIds=all("SELECT id FROM doubles_teams WHERE tournament_id='d' ORDER BY created_at,id").map(t=>t.id);
 assert.deepEqual([...draw.seeds].sort(),[...teamIds].sort(),'the draw is seeded with team ids, not player ids');assert.ok(!draw.seeds.some(s=>s.startsWith('p')||s==='owner'));
 await assert.rejects(go('owner','d','enter_team',{partnerId:'p2'}),e=>e.status===409,'registration is closed once the draw starts');
 const first=draw.fixtures.find(f=>f.status==='ready');
 await assert.rejects(go('outsider','d','score_fixture',{fixtureId:first.id,games:[[11,5],[11,7]]}),e=>e.status===403,'only organizers and scorekeepers score');
 await go('owner','d','score_fixture',{fixtureId:first.id,games:[[11,5],[11,7]]});
 const row=one("SELECT * FROM doubles_matches WHERE id=?",`t_d_${first.id}`);assert.ok(row,'the result is a doubles match');assert.equal(row.tournament_id,'d');assert.equal(row.status,'confirmed');
 const members=t=>all('SELECT p1,p2 FROM doubles_teams WHERE id=?',t)[0];const A=members(first.a),B=members(first.b);assert.deepEqual([row.a1,row.a2,row.b1,row.b2],[A.p1,A.p2,B.p1,B.p2],'the four players are the two teams');
 assert.equal(one("SELECT count(*) n FROM matches WHERE tournament_id='d'").n,0,'nothing is written to the singles table');
 assert.equal(one("SELECT count(*) n FROM doubles_audit WHERE match_id=? AND action='tournament_result'",row.id).n,1);
 // A result is corrected by resetting it (which voids the match) and scoring it again (which reuses the same match).
 await assert.rejects(go('owner','d','score_fixture',{fixtureId:first.id,games:[[5,11],[7,11]]}),e=>e.status===400,'a played fixture must be reset first');
 await go('owner','d','reset_fixture',{fixtureId:first.id,note:'Wrong table'});assert.equal(one("SELECT status FROM doubles_matches WHERE id=?",row.id).status,'voided','a reset voids the doubles match');
 await go('owner','d','score_fixture',{fixtureId:first.id,games:[[5,11],[7,11]]});assert.equal(one("SELECT status FROM doubles_matches WHERE id=?",row.id).status,'confirmed','scoring again restores it');assert.equal(JSON.parse(one("SELECT games FROM doubles_matches WHERE id=?",row.id).games)[0][0],5,'with the corrected score');assert.equal(one("SELECT count(*) n FROM doubles_matches WHERE tournament_id='d'").n,1,'still one match');
 await go('owner','d','reset_fixture',{fixtureId:first.id,note:'Replay it'});
 // Finish the event: every fixture becomes a doubles match and ratings follow.
 for(let guard=0;guard<10;guard++){const d=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='d'").state_json),next=d.fixtures.find(f=>f.status==='ready');if(!next)break;await go('owner','d','score_fixture',{fixtureId:next.id,games:[[11,3],[11,4]]});}
 assert.equal(one("SELECT status FROM tournaments WHERE id='d'").status,'completed');assert.equal(one("SELECT count(*) n FROM doubles_matches WHERE tournament_id='d' AND status='confirmed'").n,3,'semi-finals and final');
 const ratings=await readDoublesRatings(db,{},'2026-12-31');assert.ok(ratings.ratings.size>=8,'all eight players are rated');
 const champion=all("SELECT a1,a2,b1,b2,games FROM doubles_matches WHERE tournament_id='d' ORDER BY created_at DESC,rowid DESC LIMIT 1")[0];assert.ok(champion);
 // Singles ratings are untouched.
 assert.equal(calculateRatings(all("SELECT id,a,b,games,status,played_on,club_id,best_of,tournament_id,created_at FROM matches"),'2026-12-31').size,0);
 // Doubles tournament matches count at the tournament weight (2x).
 const tournamentChange=ratings.changes.find(c=>c.matchId.startsWith('t_d_')&&c.won);assert.ok(tournamentChange&&tournamentChange.delta>0);
 sql.close();
}
{
 // Deleting a doubles tournament voids its matches; deleting a player's account keeps the team result.
 const {sql,db,act,go,one,all,doublesEvent}=fixture();
 await doublesEvent('d',4);for(const [a,b] of [['p1','p2'],['p3','p4']])await go('owner','d','enter_team',{playerId:a,partnerId:b});
 await go('owner','d','start_tournament',{bestOf:3});
 const f=JSON.parse(one("SELECT state_json FROM tournaments WHERE id='d'").state_json).fixtures[0];await go('owner','d','score_fixture',{fixtureId:f.id,games:[[11,2],[11,3]]});
 await beginDeletion(db,'p2-auth','remove_history');
 assert.equal(one('PRAGMA foreign_key_check'),undefined,'deleting a team member leaves no dangling references');
 assert.equal(all("SELECT p1,p2 FROM doubles_teams WHERE tournament_id='d' ORDER BY created_at").length,2,'the team stays in the finished draw');
 await act('owner',{action:'delete_tournament',id:'d',confirmation:'DELETE',revision:one("SELECT revision FROM tournaments WHERE id='d'").revision,operationId:crypto.randomUUID()});
 assert.equal(one("SELECT count(*) n FROM doubles_matches WHERE tournament_id='d' AND status!='voided'").n,0,'deleting the tournament voids its doubles matches');sql.close();
}
{
 // A player deleting their account while registration is open leaves the team list; the open team is removed.
 const {sql,db,act,go,one,all,doublesEvent}=fixture();await doublesEvent('d',4);await go('p1','d','enter_team',{partnerId:'p2'});
 await beginDeletion(db,'p1-auth','keep_results');assert.equal(all("SELECT id FROM doubles_teams WHERE tournament_id='d'").length,0,'a team in open registration is removed with its member');assert.equal(one('PRAGMA foreign_key_check'),undefined);sql.close();
}
{
 // Guest merging: a guest's team follows the account; where both profiles are on teams in one event the old identity stays as a placeholder.
 for(const shared of [false,true]){
  const {sql,run,act,go,one,all,doublesEvent}=fixture();run("INSERT INTO profiles(id,name,created_at) VALUES('guest','Guest','2026-10-01')");run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('guest','club','guest','guest','active','2026-10-01')");
  await doublesEvent('e',4);await go('owner','e','enter_team',{playerId:'guest',partnerId:'p2'});if(shared)await go('owner','e','enter_team',{playerId:'p1',partnerId:'p3'});
  await act('p1',{action:'request_guest_claim',id:'claim',guestId:'guest',clubId:'club',note:'That was me.'});
  const approve=(extra={})=>act('owner',{action:'review_guest_claim',id:'claim',status:'approved',confirmation:'MERGE',...extra});
  if(shared){
   await assert.rejects(approve(),e=>e.status===409,'both profiles on teams in one event blocks the merge');
   const preview=await act('owner',{action:'preview_guest_merge',id:'claim'});assert.deepEqual(preview.preview.sharedEvents.map(e=>e.id),['e']);
   await approve({repair:true});assert.equal(all("SELECT id FROM doubles_teams WHERE p1='guest' OR p2='guest'").length,1,'the old identity keeps its team as a placeholder');
  }else{
   await approve();assert.equal(all("SELECT p1,p2 FROM doubles_teams WHERE tournament_id='e'")[0].p1,'p1','the team now belongs to the account');
  }
  assert.equal(one('PRAGMA foreign_key_check'),undefined);sql.close();
 }
}
{
 // What the app reads: teams appear as entries under their own id, with names and the tournament's team size.
 const {sql,go,doublesEvent,service,one}=fixture();await doublesEvent('d',4);await go('p1','d','enter_team',{partnerId:'p2'});await go('p3','d','enter_team',{partnerId:'p4'});
 const full=await service.read('owner-auth',{}),event=full.tournaments.find(t=>t.id==='d');
 assert.equal(event.team_size,2);assert.equal(event.entry_count??full.entries.filter(e=>e.tournament_id==='d').length,2,'two teams are entered');
 const team=full.teams.find(t=>t.p1==='p1');assert.equal(team.name,'P1 & P2','teams are named after their players');assert.ok(full.entries.some(e=>e.player_id===team.id&&e.tournament_id==='d'),'the team is an entry under its own id');
 assert.ok(full.players.every(p=>p.id!==team.id),'teams never appear in the player list');
 const compact=await service.read('p1-auth',{compact:true});assert.ok(compact.entries.some(e=>e.player_id===team.id),'a player sees their own team as their entry');assert.ok(!compact.entries.some(e=>e.player_id!==team.id&&e.tournament_id==='d'),'but not other teams');
 assert.equal(compact.tournaments.find(t=>t.id==='d').entry_count,2);sql.close();
}
console.log('Doubles tournaments passed: creation, team registration rules and constraints, draws seeded by team, results as doubles matches (not singles), correction and reset, ratings, deletion and account removal.');
