import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['activity-pages','match-filters','rally-errors','profile-photo'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {readActivityPage}=await import('../.test-runtime/activity-pages.mjs');
const {matchFilters,matchesFilters}=await import('../.test-runtime/match-filters.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8'));
const run=(q,...args)=>sql.prepare(q).run(...args);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}}};}
const db={prepare:stmt};
for(const id of ['owner','a','b','c','private-owner'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',id,id+'-auth',id,'2026-10-01');
for(const [id,status] of [['club','approved'],['private','pending']]){run('INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,?,?)',id,id,'City',id==='club'?'owner':'private-owner','2026-10-01',status);run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,'owner','active','2026-10-01')",id,id,id==='club'?'owner':'private-owner');}
for(const [id,deleted] of [['event',null],['removed','2026-10-01']])run("INSERT INTO tournaments(id,club_id,name,date,format,capacity,status,best_of,created_at,deleted_at) VALUES(?,'club',?,'2026-10-02','Single elimination',4,'completed',3,'2026-10-01',?)",id,id,deleted);
for(let i=1;i<=45;i++)run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at,tournament_id) VALUES(?,'club',?,'b','[[11,5],[11,6]]',3,?,?,'a',?,?)",'m'+i,i%2?'a':'c',i<=30?'2026-10-01':'2026-10-02',i%3?'confirmed':'pending','2026-10-01T'+String(i).padStart(2,'0'),i%5===0?'event':null);
run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('hidden','private','a','b','[[11,5],[11,6]]',3,'2026-10-02','confirmed','a','2026-10-01')");
run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at,tournament_id) VALUES('deleted-event','club','a','b','[[11,5],[11,6]]',3,'2026-10-02','confirmed','a','2026-10-01','removed')");
const all=sql.prepare("SELECT * FROM matches WHERE club_id='club' AND (tournament_id IS NULL OR tournament_id='event')").all();
for(const options of [{},{player:'a'},{mine:true},{player:'c',mine:true},{from:'2026-10-02',to:'2026-10-02'},{tournament:'none'},{tournament:'any'},{tournament:'event'},{player:'b',mine:true,tournament:'none',from:'2026-10-01',to:'2026-10-01'}]){
 const expected=all.filter(m=>matchesFilters(m,matchFilters(options),'a'));
 const first=await readActivityPage(db,'a-auth',{view:'matches',...options}),second=await readActivityPage(db,'a-auth',{view:'matches',...options,page:2}),third=await readActivityPage(db,'a-auth',{view:'matches',...options,page:3});
 assert.equal(first.total,expected.length,JSON.stringify(options));
 assert.deepEqual([...first.items,...second.items,...third.items].map(m=>m.id).sort(),expected.map(m=>m.id).sort());
 assert.equal(first.hasMore,expected.length>20);
}
const pending=await readActivityPage(db,'a-auth',{view:'matches',status:'pending',mine:true});assert.ok(pending.items.every(m=>m.status==='pending'&&m.a==='a'));assert.ok(pending.items.every(m=>!m.canConfirm&&m.canVoid===!m.tournament_id));
const other=await readActivityPage(db,'b-auth',{view:'matches',status:'pending',player:'a'});assert.ok(other.items.every(m=>m.canConfirm&&!m.canVoid));
assert.equal((await readActivityPage(db,'a-auth',{view:'matches',club:'private',player:'a'})).total,0);
assert.equal((await readActivityPage(db,'private-owner-auth',{view:'matches',club:'private',player:'a'})).total,1);
await assert.rejects(readActivityPage(db,null,{view:'matches',mine:true}),e=>e.status===401);
for(const dates of [{from:'2026-02-30'},{to:'not-a-date'},{from:'2026-10-03',to:'2026-10-02'}])await assert.rejects(readActivityPage(db,'a-auth',{view:'matches',...dates}),e=>e.status===400);
assert.equal((await readActivityPage(db,'a-auth',{view:'matches',tournament:"event' OR 1=1 --"})).total,0);
sql.close();
console.log('Match filters passed: complete pagination, player/date/tournament intersections, self-only quick filter, date validation, private-club visibility, deleted events and unchanged verification/withdrawal permissions.');
