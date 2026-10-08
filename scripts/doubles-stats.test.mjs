import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['doubles','doubles-rating','doubles-view','doubles-stats','public-doubles','seeding','rally-errors','match-rules','account-deletion','record-ownership','account-write-guard','club-seasons','notification-preferences','summary-cache','feedback-progress','dashboards','clubhouse-summary','rally','activity-pages','match-changes','match-filters','logistics','notifications','profile-photo','rally-service','palettes','announcements','club-sessions','ui-preferences','open-play','public-rally','tournament-engine','tournament-service','live-score','live-draft','head-to-head','match-stakes','player-highlights','public-leaderboard']){let code;try{code=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'");}catch{continue}writeFileSync(`.test-runtime/${name}.mjs`,code);}
const {readDoublesStandings,readDoublesProfile}=await import('../.test-runtime/doubles-stats.mjs');
const {readDoublesRatings}=await import('../.test-runtime/doubles.mjs');
const {getPublicDoublesMatch,getPublicPair,getPublicDoublesBoard,getPublicDoublesPlayer,getPublicPairHeadToHead}=await import('../.test-runtime/public-doubles.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true}}}}
const db={prepare:stmt};
for(const p of ['owner','p1','p2','p3','p4','out'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p.toUpperCase(),'2026-10-01');
for(const c of ['club','other'])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,c,'City',c==='club'?'owner':'out');
for(const [p,c] of [['owner','club'],['p1','club'],['p2','club'],['p3','club'],['p4','club'],['out','other']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,'member','active','2026-10-01')",p+c,c,p);
const add=(id,date,games,tid=null)=>run("INSERT INTO doubles_matches(id,club_id,a1,a2,b1,b2,games,best_of,played_on,status,submitted_by,tournament_id,created_at) VALUES(?,'club','p1','p2','p3','p4',?,3,?,'confirmed','p1',?,?)",id,JSON.stringify(games),date,tid,date+'T10:00:00Z');
add('m1','2026-09-01',[[11,5],[11,7]]);add('m2','2026-09-10',[[11,5],[7,11],[11,8]]);add('m3','2026-09-20',[[5,11],[6,11]]);
{
 const s=await readDoublesStandings(db,'p1','club');
 assert.equal(s.players.length,4);assert.equal(s.players[0].played,3);
 assert.deepEqual(s.players.map(p=>p.name).sort(),['P1','P2','P3','P4']);
 const top=s.pairs.find(p=>p.ids.join()==='p1,p2');assert.equal(top.played,3);assert.equal(top.wins,2);
 assert.equal((await readDoublesStandings(db,'out','other')).players.length,0,'a member of another club sees only their own club');
 assert.equal((await readDoublesStandings(db,'p1','other')).players.length,0,'a club you do not belong to is empty');
 const all=await readDoublesStandings(db,'p1','all');assert.equal(all.players.length,4);
}
{
 const me=await readDoublesProfile(db,'p1','p1');assert.equal(me.played,3);assert.equal(me.wins,2);assert.equal(me.history.length,3);assert.equal(me.partners[0].id,'p2');
 assert.ok(await readDoublesProfile(db,'p3','p1'),'club-mates can see each other');
 assert.equal(await readDoublesProfile(db,'out','p1'),null,'people with no club in common cannot');
 assert.equal(await readDoublesProfile(db,'p1','missing'),null);
}
{
 // Public pages: a confirmed result and a pair's record together, only for approved clubs and existing players.
 const m=await getPublicDoublesMatch(db,'m1');
 assert.deepEqual(m.sides.map(s=>s.names.join(' & ')),['P1 & P2','P3 & P4']);assert.ok(m.changes.p1>0&&m.changes.p3<0&&m.changes.p1===m.changes.p2,'both partners share the change');
 assert.equal(await getPublicDoublesMatch(db,'nope'),null);assert.equal(await getPublicDoublesMatch(db,'bad id!'),null);
 const pair=await getPublicPair(db,'p2','p1');assert.equal(pair.played,3);assert.equal(pair.wins,2);assert.equal(pair.recent.length,3);assert.deepEqual(pair.opponents.map(o=>o.ids.join()),['p3,p4']);
 assert.equal(await getPublicPair(db,'p1','p3'),null,'players who never partnered have no pair page');
 const board=await getPublicDoublesBoard(db);assert.equal(board.players.length,4);assert.ok(board.pairs.some(p=>p.ids.join()==='p1,p2'&&p.wins===2),'the public board lists pairs with two or more matches');
 const single=await getPublicDoublesPlayer(db,'p1');assert.equal(single.played,3);assert.equal(single.partners[0].id,'p2');assert.equal(await getPublicDoublesPlayer(db,'owner'),null,'players without doubles results have no section');
 const hh=await getPublicPairHeadToHead(db,['p1','p2'],['p3','p4']);assert.deepEqual([hh.a.wins,hh.b.wins,hh.matches.length],[2,1,3]);assert.deepEqual((await getPublicPairHeadToHead(db,['p3','p4'],['p1','p2'])).a.wins,1,'the record flips with the viewpoint');
 assert.equal(await getPublicPairHeadToHead(db,['p1','p2'],['p1','p3']),null,'overlapping pairs have no head-to-head');assert.equal(await getPublicPairHeadToHead(db,['p1','p2'],['p3','owner']),null);assert.equal(await getPublicPair(db,'p1','p1'),null);
 run("UPDATE clubs SET approval_status='pending' WHERE id='club'");assert.equal(await getPublicDoublesMatch(db,'m1'),null,'unapproved clubs are never public');assert.equal(await getPublicPair(db,'p1','p2'),null);
 run("UPDATE clubs SET approval_status='approved' WHERE id='club'");
 run("UPDATE profiles SET deleted_at='2026-10-08',auth_id=NULL,name='Deleted player' WHERE id='p4'");assert.equal(await getPublicDoublesMatch(db,'m1'),null,'a deleted player removes the public result');
}{
 // A cross-club tournament (weight 3) moves ratings more than a normal tournament (weight 2) and more than a casual match.
 const delta=async(weight)=>{run("INSERT INTO tournaments(id,name,club_id,date,format,capacity,created_at,rating_weight) VALUES(?,?,'club','2026-10-01','Swiss',8,'2026-10-01',?)",'t'+weight,'T',weight);
  run('DELETE FROM doubles_matches');add('w','2026-10-01',[[11,5],[11,7]],'t'+weight);
  const r=await readDoublesRatings(db);return r.ratings.get('p1').rating-400;};
 const two=await delta(2),three=await delta(3);
 assert.ok(three>two&&Math.abs(three/two-1.5)<0.01,`weight 3 is 1.5x weight 2 (${two} vs ${three})`);
}
console.log('doubles stats tests passed');
