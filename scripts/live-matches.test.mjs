import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['live-matches','live-draft','live-score'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'"));
const {syncLiveMatch,endLiveMatch,listLiveMatches,cleanupLiveMatches,LIVE_STALE_MS}=await import('../.test-runtime/live-matches.mjs'),{parseLiveDraft}=await import('../.test-runtime/live-draft.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:sql.prepare(q).run(...args)}}};}
const db={prepare:stmt};
for(const p of ['p1','p2','p3','out'])sql.prepare('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)').run(p,'auth-'+p,p,'2026-10-21');
for(const c of ['club','other'])sql.prepare("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')").run(c,c,'City',c==='club'?'p3':'out');
for(const [p,c,role] of [['p1','club','member'],['p2','club','member'],['p3','club','owner'],['out','other','owner']])sql.prepare("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,'active','2026-10-01')").run(p+c,c,p,role);
const events=[],publish=async(room,event)=>{events.push({room,event});};
const draft=(o={})=>({version:1,owner:'p1',id:'m1',clubId:'club',a:'p1',b:'p2',bestOf:3,date:'2026-10-21',updatedAt:'2026-10-21T12:00:00.000Z',swapped:false,shared:true,state:{points:[3,2],games:[],complete:false,history:[{points:[2,2],games:[],complete:false}]},...o});
const rows=()=>sql.prepare('SELECT * FROM live_matches').all();
// Sharing is opt-in.
await syncLiveMatch(db,'p1',draft({shared:undefined}),publish);assert.equal(rows().length,0);assert.equal(events.length,0);
await syncLiveMatch(db,'p1',draft({shared:false}),publish);assert.equal(rows().length,0);
// A shared match reaches club members, without the undo history.
await syncLiveMatch(db,'p1',draft(),publish);assert.equal(rows().length,1);assert.equal(events.length,1);
assert.equal(events[0].room,'live:club');assert.equal(events[0].event.type,'live_match');assert.deepEqual(events[0].event.state,{points:[3,2],games:[],complete:false});assert.equal('history' in events[0].event.state,false);
assert.equal((await listLiveMatches(db,'p2')).length,1);assert.equal((await listLiveMatches(db,'p3')).length,1);assert.equal((await listLiveMatches(db,'out')).length,0,'non-members cannot see it');
// Newest draft wins; an older save is ignored.
await syncLiveMatch(db,'p1',draft({updatedAt:'2026-10-21T12:00:05.000Z',state:{points:[4,2],games:[],complete:false,history:[]}}),publish);assert.equal(events.length,2);assert.deepEqual(JSON.parse(rows()[0].state_json).points,[4,2]);
await syncLiveMatch(db,'p1',draft({updatedAt:'2026-10-21T12:00:01.000Z'}),publish);assert.equal(events.length,2,'older save publishes nothing');assert.deepEqual(JSON.parse(rows()[0].state_json).points,[4,2]);
// Who may share.
await syncLiveMatch(db,'p2',draft({owner:'p2',id:'m2',a:'p1',b:'p3'}),publish);assert.equal(rows().filter(r=>r.player_id==='p2').length,0,'a member who is not playing cannot share');
await syncLiveMatch(db,'p3',draft({owner:'p3',id:'m3',a:'p1',b:'p2'}),publish);assert.equal(rows().filter(r=>r.player_id==='p3').length,1,'a club admin can share any match');
await syncLiveMatch(db,'p1',draft({id:'m4',b:'out'}),publish);assert.equal(rows().filter(r=>r.player_id==='p1').length,0,'both players must be club members, and the replaced match stops being shared');
await syncLiveMatch(db,'p1',draft({id:'m1b'}),publish);assert.equal(rows().filter(r=>r.player_id==='p1').length,1);
await syncLiveMatch(db,'p1',draft({id:'m5',clubId:'unaffiliated'}),publish);assert.equal(rows().filter(r=>r.player_id==='p1').length,0,'unaffiliated matches are not shared');
assert.equal(events.at(-1).event.type,'live_end');
// A new match replaces the old one and tells watchers the old one ended.
await syncLiveMatch(db,'p1',draft({id:'m6'}),publish);const before=events.length;await syncLiveMatch(db,'p1',draft({id:'m7',updatedAt:'2026-10-21T13:00:00.000Z'}),publish);
assert.deepEqual(events.slice(before).map(e=>e.event.type+':'+e.event.id),['live_end:m6','live_match:m7']);
// Ending.
await endLiveMatch(db,'p1',publish,'m6');assert.equal(rows().filter(r=>r.player_id==='p1').length,1,'a late delete of another match changes nothing');
await endLiveMatch(db,'p1',publish,'m7');assert.equal(rows().filter(r=>r.player_id==='p1').length,0);assert.equal(events.at(-1).event.type,'live_end');
await syncLiveMatch(db,'p1',draft({id:'m8'}),publish);await syncLiveMatch(db,'p1',draft({id:'m8',shared:false}),publish);assert.equal(rows().filter(r=>r.player_id==='p1').length,0,'turning sharing off removes it');
// Stale matches disappear.
await syncLiveMatch(db,'p1',draft({id:'m9'}),publish);const later=Date.now()+LIVE_STALE_MS+60000;assert.equal((await listLiveMatches(db,'p2',later)).length,0);await cleanupLiveMatches(db,later);assert.equal(rows().length,0);
// Deleting a player removes matches they play in or scored.
await syncLiveMatch(db,'p1',draft({id:'m10'}),publish);sql.prepare("UPDATE profiles SET deleted_at='2026-10-21',auth_id=NULL,name='Deleted player' WHERE id='p2'").run();assert.equal(rows().length,0);
// Draft validation.
assert.equal(parseLiveDraft(JSON.stringify(draft({shared:'yes'})),'p1'),null);assert.ok(parseLiveDraft(JSON.stringify(draft()),'p1'));assert.ok(parseLiveDraft(JSON.stringify(draft({shared:undefined})),'p1'),'old drafts without the field still load');
console.log('Live matches passed: opt-in sharing, club-only visibility, compact updates, newest-wins, who may share, replacement and end events, stale cleanup and deletion cleanup.');
