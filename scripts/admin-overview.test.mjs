import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['admin-overview','system-health','admin-email'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const a=await import('../.test-runtime/admin-overview.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...x)=>sql.prepare(q).run(...x);
function stmt(q,args=[]){return {bind(...x){return stmt(q,x)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt};
// Who counts as an administrator.
assert.equal(a.isSiteAdminEmail('A@x.com, b@y.com','a@X.com'),true,'case-insensitive');assert.equal(a.isSiteAdminEmail('a@x.com','b@x.com'),false);assert.equal(a.isSiteAdminEmail(undefined,'a@x.com'),false,'no list, no administrators');assert.equal(a.isSiteAdminEmail('a@x.com',null),false);assert.equal(a.isSiteAdminEmail('',''),false);assert.equal(a.isSiteAdminEmail('a@x.com, ,','  '),false);
const now=new Date('2026-10-15T12:00:00.000Z');
let o=await a.adminOverview(db,now);assert.deepEqual({clubs:o.pendingClubs.length,safety:o.reports.safety,feedback:o.feedbackOpen,players:o.activity.players},{clubs:0,safety:0,feedback:0,players:0},'an empty site is all zeros');assert.equal(o.health.ok,true);
for(const [id,days] of [['p1',1],['p2',3],['p3',30],['p4',2]])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',id,id+'-auth',id,new Date(now.getTime()-days*86400000).toISOString());
run("UPDATE profiles SET deleted_at='2026-10-14',auth_id=NULL,name='Deleted player' WHERE id='p4'");run("INSERT INTO profiles(id,name,created_at) VALUES('guest1','Guest','2026-10-14T00:00:00.000Z')");
for(const [id,owner,status,created] of [['c1','p1','pending','2026-10-14T10:00:00.000Z'],['c2','p2','pending','2026-10-13T10:00:00.000Z'],['c3','p3','approved','2026-09-01T00:00:00.000Z']])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,?,?)",id,'Club '+id,'City',owner,created,status);
run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES('m1','c1','p1','owner','active','2026-10-14'),('m2','c1','p2','member','pending','2026-10-14')");
o=await a.adminOverview(db,now);
assert.deepEqual(o.pendingClubs.map(c=>c.id),['c2','c1'],'unverified clubs, oldest first');assert.equal(o.pendingClubs[1].members,1,'members counted without pending requests');
assert.deepEqual({players:o.activity.players,newWeek:o.activity.newPlayersThisWeek,verified:o.activity.verifiedClubs},{players:3,newWeek:2,verified:1},'accounts only: no guests, no deleted players; the 30-day-old account is not new');
// Reports and feedback: only unresolved ones count.
run("INSERT INTO safety_reports(id,kind,reporter_id,target_id,created_at,resolved_at) VALUES('r1','dm','p1','p2','2026-10-14',NULL),('r2','user','p1','p2','2026-10-14','2026-10-15'),('r3','room','p2','p1','2026-10-14',NULL)");
run("INSERT INTO feedback(id,submitted_by,type,title,description,status,created_at,updated_at) VALUES('f1','p1','bug','t','d','open','2026-10-14','2026-10-14'),('f2','p1','bug','t','d','done','2026-10-14','2026-10-14')");
run("INSERT INTO chat_messages(id,club_id,author_id,author_name,body,client_id,created_at) VALUES('cm1','c1','p1','p1','hi','x','2026-10-14T00:00:00.000Z')");run("INSERT INTO chat_reports(id,message_id,club_id,reporter_id,created_at) VALUES('cr1','cm1','c1','p2','2026-10-14')");
o=await a.adminOverview(db,now);assert.deepEqual({safety:o.reports.safety,chat:o.reports.clubChats,feedback:o.feedbackOpen},{safety:2,chat:1,feedback:1});
// Matches this week: confirmed and recent only.
run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,created_at) VALUES('x1','c3','p1','p2','[[11,5],[11,6]]',3,'2026-10-14','confirmed','p1','2026-10-14'),('x2','c3','p1','p2','[[11,5],[11,6]]',3,'2026-10-14','pending','p1','2026-10-14'),('x3','c3','p1','p2','[[11,5],[11,6]]',3,'2026-09-01','confirmed','p1','2026-09-01')");
assert.equal((await a.adminOverview(db,now)).activity.matchesThisWeek,1);
console.log('admin overview tests passed');
