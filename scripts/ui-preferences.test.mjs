import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
for(const name of ['ui-preferences','rally-errors','palettes'])writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("from './rally-errors'","from './rally-errors.mjs'").replaceAll("from './palettes'","from './palettes.mjs'"));
const {readUiPreferences,saveUiPreferences,defaultUiPreferences}=await import('../.test-runtime/ui-preferences.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:sql.prepare(q).run(...args)}}}}
const db={prepare:q=>stmt(q)};
sql.prepare('INSERT INTO profiles(id,name,created_at) VALUES(?,?,?)').run('me','Me','2026-10-08');sql.prepare('INSERT INTO profiles(id,name,created_at) VALUES(?,?,?)').run('other','Other','2026-10-08');
const profileCount=sql.prepare('SELECT count(*) n FROM profiles').get().n;
assert.equal(await readUiPreferences(db,'me'),null,'nothing saved yet');
// Partial saves keep the other fields.
let saved=await saveUiPreferences(db,'me',{palette:'ocean'});assert.deepEqual(saved,{...defaultUiPreferences,palette:'ocean'});
saved=await saveUiPreferences(db,'me',{appearance:'dark'});assert.deepEqual(saved,{palette:'ocean',appearance:'dark',onboardingHidden:false},'saving the mode keeps the colour');
saved=await saveUiPreferences(db,'me',{onboardingHidden:true});assert.deepEqual(saved,{palette:'ocean',appearance:'dark',onboardingHidden:true});
assert.deepEqual(await readUiPreferences(db,'me'),saved,'saved values read back');
assert.equal(await readUiPreferences(db,'other'),null,'another player is unaffected');
// Validation.
for(const bad of [{palette:'neon'},{palette:5},{appearance:'sepia'},{onboardingHidden:'yes'},{palette:"forest'; DROP TABLE profiles;--"}])await assert.rejects(saveUiPreferences(db,'me',bad),e=>e.status===400,JSON.stringify(bad));
assert.deepEqual(await readUiPreferences(db,'me'),saved,'rejected input changes nothing');
assert.equal(sql.prepare('SELECT count(*) n FROM profiles').get().n,profileCount,'injection attempt did nothing');
// Removed with the profile.
sql.prepare("DELETE FROM profiles WHERE id='me'").run();assert.equal(sql.prepare("SELECT count(*) n FROM ui_preferences WHERE player_id='me'").get().n,0,'preferences cascade with the profile');
console.log('UI preferences passed: partial saves, validation, isolation between players and cleanup.');