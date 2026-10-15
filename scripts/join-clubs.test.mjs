import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/join-clubs.mjs',ts.transpileModule(readFileSync('lib/join-clubs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {listJoinableClubs}=await import('../.test-runtime/join-clubs.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt};
for(const p of ['me','a','b','gone'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');
const club=(id,name,location,status='approved')=>{run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)','o_'+id,'o_'+id+'-auth','owner '+id,'2026-10-01');run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01',?)",id,name,location,'o_'+id,status);};
club('big','Harbor Table Tennis','Baltimore');club('small','Hill Paddlers','Catonsville');club('umbc','UMBC Table Tennis','Catonsville');club('pend','Not Yet Club','Nowhere','pending');club('percent','100% Club','Under_score');
const mem=(club_id,p,status)=>run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,'member',?,'2026-10-01')",club_id+p,club_id,p,status);
mem('big','a','active');mem('big','b','active');mem('small','a','active');mem('big','gone','active');
run("UPDATE profiles SET deleted_at='2026-10-02',auth_id=NULL,name='Deleted player' WHERE id='gone'");
// Approved clubs only, most members first, deleted players not counted.
let list=await listJoinableClubs(db,'me','');
assert.deepEqual(list.map(c=>c.id),['big','small','percent','umbc'],'ordered by active members, then name');
assert.equal(list.find(c=>c.id==='big').members,2,'deleted players are not counted');assert.ok(!list.some(c=>c.id==='pend'),'unapproved clubs are hidden');
assert.ok(list.every(c=>c.mine===null),'nobody has joined yet');
// The viewer's own state.
mem('small','me','pending');mem('big','me','active');
list=await listJoinableClubs(db,'me','');assert.equal(list.find(c=>c.id==='small').mine,'pending');assert.equal(list.find(c=>c.id==='big').mine,'active');assert.equal(list.find(c=>c.id==='umbc').mine,null);
assert.equal((await listJoinableClubs(db,'b','')).find(c=>c.id==='small').mine,null,'other people\'s requests are not shown');
// Search matches name or location, ignoring case; wildcard characters are literal.
assert.deepEqual((await listJoinableClubs(db,'me','umbc')).map(c=>c.id),['umbc']);
assert.deepEqual((await listJoinableClubs(db,'me','catons')).map(c=>c.id).sort(),['small','umbc'],'location matches');
assert.deepEqual((await listJoinableClubs(db,'me','100%')).map(c=>c.id),['percent'],'% is not a wildcard');assert.deepEqual((await listJoinableClubs(db,'me','%')).map(c=>c.id),['percent'],'a lone % only matches a real %');
assert.deepEqual((await listJoinableClubs(db,'me','_')).map(c=>c.id),['percent'],'_ is not a wildcard');
assert.deepEqual(await listJoinableClubs(db,'me','zzzz'),[]);
// Results are capped.
for(let i=0;i<40;i++)club('c'+i,'Bulk '+String(i).padStart(2,'0'),'Town');
assert.equal((await listJoinableClubs(db,'me','')).length,25,'at most 25 clubs per search');
console.log('join clubs tests passed');
