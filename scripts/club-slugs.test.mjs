import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['club-slugs','rally-errors'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const s=await import('../.test-runtime/club-slugs.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(x=>x.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['a','b','c'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p,'2026-10-01');
const club=(id,_owner,status='approved')=>{run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)','o_'+id,'o_'+id+'-auth','o_'+id,'2026-10-01');run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01',?)",id,id,'City','o_'+id,status);};
club('c1','a');club('c2','b','pending');club('c3','c','rejected');
const fail=async(p,status,msg)=>assert.rejects(p,e=>e.status===status&&(!msg||msg.test(e.message)),`expected ${status}`);

// Turning a name into an address.
assert.equal(s.slugify('UMBC Table Tennis!'),'umbc-table-tennis');assert.equal(s.slugify('  Café  Pong -- Club  '),'cafe-pong-club');assert.equal(s.slugify('日本語'),'');assert.equal(s.slugify('A'.repeat(50)).length,30);
assert.equal(s.slugify('The Greater Baltimore Metropolitan Table Tennis League'),'the-greater-baltimore','cut on a word boundary');assert.ok(s.slugify('x-'.repeat(40)).length<=30&&!s.slugify('x-'.repeat(40)).endsWith('-'));
// What is allowed.
for(const ok of ['umbc','harbor-tt','club-2','abc','a1b2c3'])assert.equal(s.checkSlug(ok),ok);assert.equal(s.checkSlug('  UMBC '),'umbc','case and spaces are normalized');
for(const bad of ['ab','a'.repeat(31),'-abc','abc-','a--b','a_b','a b','ab.c','ünï','','   ',null,undefined,42])assert.throws(()=>s.checkSlug(bad),e=>e.status===400,String(bad));
for(const reserved of ['admin','api','clubs','login','join','Help','RALLY'])assert.throws(()=>s.checkSlug(reserved),e=>/reserved/.test(e.message),reserved);

// Setting an address.
assert.deepEqual(await s.setClubSlug(db,'c1','umbc','2026-10-15T00:00:00.000Z'),{slug:'umbc'});assert.equal(await s.currentSlug(db,'c1'),'umbc');
assert.deepEqual({...await s.resolveSlug(db,'UMBC')},{clubId:'c1',isCurrent:1,status:'approved'},'lookups ignore case');
await fail(s.setClubSlug(db,'c2','umbc'),409,/taken/);await fail(s.setClubSlug(db,'c2','UMBC'),409,/taken/);assert.equal(await s.currentSlug(db,'c2'),null,'a failed attempt changes nothing');
assert.deepEqual(await s.setClubSlug(db,'c1','umbc'),{slug:'umbc'},'saving the same address again is fine');
await fail(s.setClubSlug(db,'nope','abc-club'),404);await fail(s.setClubSlug(db,'c3','abc-club'),404,/not found/);
assert.equal(await s.resolveSlug(db,'nope-nothing'),null);assert.equal(await s.resolveSlug(db,'../x'),null);assert.equal(await s.resolveSlug(db,'ab'),null);
// An unverified club can have one; the page decides what to show.
await s.setClubSlug(db,'c2','harbor');assert.equal((await s.resolveSlug(db,'harbor')).status,'pending');

// Changing keeps the old address working and reserved for the same club.
await s.setClubSlug(db,'c1','umbc-tt','2026-10-16T00:00:00.000Z');assert.equal(await s.currentSlug(db,'c1'),'umbc-tt');
assert.deepEqual({...await s.resolveSlug(db,'umbc')},{clubId:'c1',isCurrent:0,status:'approved'},'the old address still opens the club');
await fail(s.setClubSlug(db,'c2','umbc'),409,/taken/);
await s.setClubSlug(db,'c1','umbc','2026-10-17T00:00:00.000Z');assert.equal(await s.currentSlug(db,'c1'),'umbc','a club can go back to an old address');assert.equal(one("SELECT count(*) n FROM club_slugs WHERE club_id='c1' AND is_current=1").n,1,'exactly one current address');
// Old addresses are capped so they cannot be hoarded.
for(let i=1;i<=9;i++)await s.setClubSlug(db,'c1','hoard-'+i,`2026-11-0${i}T00:00:00.000Z`);
assert.equal(one("SELECT count(*) n FROM club_slugs WHERE club_id='c1' AND is_current=0").n,s.MAX_OLD_SLUGS,'at most five old addresses are kept');assert.equal(one("SELECT count(*) n FROM club_slugs WHERE club_id='c1' AND is_current=1").n,1);
assert.equal(await s.resolveSlug(db,'umbc'),null,'the oldest ones are released');await s.setClubSlug(db,'c2','umbc');assert.equal(await s.currentSlug(db,'c2'),'umbc','and can be claimed by someone else');
assert.equal((await s.resolveSlug(db,'hoard-9')).isCurrent,1);
// Rejecting later hides it from the page; deleting the club frees every address.
run("UPDATE clubs SET approval_status='rejected' WHERE id='c2'");assert.equal((await s.resolveSlug(db,'umbc')).status,'rejected');
run("DELETE FROM clubs WHERE id='c2'");assert.equal(await s.resolveSlug(db,'umbc'),null);

// A new club gets an address from its name when one is free.
club('d1','a','pending');
assert.equal(await s.assignDefaultSlug(db,'d1','Harbor Paddlers','Baltimore, MD'),'harbor-paddlers');
club('d2','c','pending');assert.equal(await s.assignDefaultSlug(db,'d2','Harbor Paddlers','Baltimore, MD'),'harbor-paddlers-baltimore','a taken name falls back to name and town');
club('d3','a','pending');assert.equal(await s.assignDefaultSlug(db,'d3','Harbor Paddlers','Baltimore, MD'),'harbor-paddlers-2'.replace('-2','-2'),'then to a numbered address');
club('d4','b','pending');assert.equal(await s.assignDefaultSlug(db,'d4','日本語','Tokyo'),'tokyo','a name with no usable letters falls back to the town');club('d6','a','pending');assert.equal(await s.assignDefaultSlug(db,'d6','日本語','東京'),null,'and with nothing usable at all, no address rather than a failure');club('d5','c','pending');assert.equal(await s.assignDefaultSlug(db,'d5','Admin','X'),'admin-x'.replace('admin-x','admin-x'),'a reserved name falls back');
console.log('club slug tests passed');
