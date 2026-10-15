import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/cf-stub.mjs','export class DurableObject{}\n');
for(const name of readdirSync('lib').filter(f=>f.endsWith('.ts')).map(f=>f.slice(0,-3))){writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'").replace(/from ['"]cloudflare:workers['"]/g,"from './cf-stub.mjs'"));}
const d=await import('../.test-runtime/discord.mjs'),chat=await import('../.test-runtime/chat.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['lead','mem','other'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p==='lead'?'Lena Lead':p+' Person','2026-10-01');
for(const [c,o] of [['c1','lead'],['c2','other']])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,'Club '+c,'City',o);
for(const [p,c,role] of [['lead','c1','owner'],['mem','c1','member'],['other','c2','owner']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,'active','2026-10-01')",p+c,c,p,role);
// A key pair stands in for Discord's.
const {publicKey,privateKey}=generateKeyPairSync('ed25519'),pubHex=Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
const env={DB:db,DISCORD_BOT_TOKEN:'test-token',DISCORD_PUBLIC_KEY:pubHex,DISCORD_APP_ID:'123456789012345678'};
const fail=async(p,status)=>assert.rejects(p,e=>e.status===status,`expected ${status}`);
// Signatures: only Discord's key counts, over timestamp + body.
const body='{"type":1}',ts_='1700000000',goodSig=sign(null,Buffer.from(ts_+body),privateKey).toString('hex');
assert.equal(await d.verifyInteraction(pubHex,goodSig,ts_,body),true);assert.equal(await d.verifyInteraction(pubHex,goodSig,ts_,body+' '),false,'a changed body fails');assert.equal(await d.verifyInteraction(pubHex,goodSig,'1700000001',body),false);
assert.equal(await d.verifyInteraction(pubHex,null,ts_,body),false);assert.equal(await d.verifyInteraction(pubHex,'zz',ts_,body),false);assert.equal(await d.verifyInteraction('abcd',goodSig,ts_,body),false);
assert.equal(await d.verifyInteraction(Buffer.from(generateKeyPairSync('ed25519').publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),goodSig,ts_,body),false,'another key fails');
// Markup cleanup.
assert.equal(d.cleanContent({content:'hi <@1> and <@!2> <@&9> in <#5> @everyone @here <:wave:77> <a:party:78>',mentions:[{id:'1',username:'ann',global_name:'Ann'},{id:'2',username:'bob'}]}),'hi @Ann and @bob @role in #channel @​everyone @​here :wave: :party:');
assert.equal(d.inviteUrl('123456789012345678').includes('client_id=123456789012345678'),true);assert.equal(d.inviteUrl('nope'),null);
// Codes: organizers only.
await fail(d.createLinkCode(env,'mem','c1'),403);await fail(d.createLinkCode(env,'other','c1'),403);await fail(d.createLinkCode({...env,DISCORD_BOT_TOKEN:''},'lead','c1'),409);
assert.equal((await d.discordStatus(env,'lead','c1')).link,null);await fail(d.discordStatus(env,'mem','c1'),403);
const now=new Date('2026-10-14T12:00:00.000Z'),{code}=await d.createLinkCode(env,'lead','c1',now);assert.match(code,/^[A-Z2-9]{6}$/);
assert.notEqual((await d.createLinkCode(env,'lead','c1',now)).code,code,'a new code replaces the old one');assert.equal(one('SELECT count(*) n FROM discord_link_codes').n,1);
const live=(await d.createLinkCode(env,'lead','c1',now)).code;
// Slash commands.
const calls=[],http=async(url,init)=>{calls.push([url,init]);if(url.includes('/channels/')&&init?.method==='POST')return new Response(JSON.stringify({id:'wh1',token:'tok1'}),{status:200});return new Response(null,{status:204});};
const cmd=(sub,opts=[],over={})=>({type:2,guild_id:'g1',channel:{id:'ch1',name:'general'},member:{permissions:'32'},data:{name:'rally',options:[{name:sub,type:1,options:opts}]},...over});
const text=async r=>(await r.json()).data?.content;
assert.deepEqual(await (await d.handleInteraction(env,{type:1})).json(),{type:1});
assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:live}],{member:{permissions:'0'}}),http,now)),/Manage Server/);
assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:'ABC'}]),http,now)),/6 character/);
assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:'AAAAAA'}]),http,now)),/wrong or has expired/);
assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:live}]),http,new Date('2026-10-14T13:00:00.000Z'))),/wrong or has expired/,'expired');
assert.match(await text(await d.handleInteraction(env,cmd('status'),http,now)),/not linked/);
assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:live.toLowerCase()}]),http,now)),/Linked to the Rally club Club c1/);
assert.equal(one('SELECT channel_id,webhook_id,channel_name FROM discord_links WHERE club_id=?','c1').channel_id,'ch1');assert.equal(one('SELECT count(*) n FROM discord_link_codes').n,0,'the code is used up');
assert.equal(calls[0][1].headers.Authorization,'Bot test-token');assert.match(await text(await d.handleInteraction(env,cmd('status'),http,now)),/linked to the Rally club Club c1/);
assert.equal((await d.discordStatus(env,'lead','c1')).link.channelName,'general');
// One channel, one club.
const second=(await d.createLinkCode({...env},'other','c2',now)).code;assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:second}]),http,now)),/already linked to another/);
// A failed webhook is explained, not hidden.
const third=(await d.createLinkCode(env,'other','c2',now)).code;assert.match(await text(await d.handleInteraction(env,cmd('link',[{name:'code',value:third}],{channel:{id:'ch2',name:'x'}}),async()=>new Response('no',{status:403}),now)),/Manage Webhooks/);assert.equal(one("SELECT count(*) n FROM discord_links WHERE club_id='c2'").n,0);
// Rally -> Discord.
const sent=[],relay=async(url,init)=>{sent.push([url,JSON.parse(init.body)]);return new Response(null,{status:204});};
const msg=(over={})=>({id:'m1',clubId:'c1',authorId:'mem',authorName:'Discord Fan',body:'hello @everyone',createdAt:'x',media:null,mine:false,canDelete:false,...over});
assert.equal(await d.relayToDiscord(env,msg(),relay),true);assert.equal(sent[0][0],'https://discord.com/api/v10/webhooks/wh1/tok1');assert.equal(sent[0][1].username,'Disc0rd Fan');assert.deepEqual(sent[0][1].allowed_mentions,{parse:[]});assert.equal(sent[0][1].content,'hello @everyone');
await d.relayToDiscord(env,msg({body:'',media:{id:'m',kind:'video',contentType:'video/mp4',bytes:1}}),relay);assert.match(sent[1][1].content,/Shared a video in Rally/);assert.ok(!JSON.stringify(sent[1][1]).includes('/api/chat/media'),'private media links are never sent');
assert.equal(await d.relayToDiscord(env,msg({clubId:'c2'}),relay),false,'unlinked clubs are skipped');assert.equal(await d.relayToDiscord(env,msg({authorId:null}),relay),false,'messages that came from Discord are not echoed back');
assert.equal(await d.relayToDiscord(env,msg({body:'x'.repeat(3000)}),relay),true);assert.equal(sent.at(-1)[1].content.length,2000);
assert.equal(await d.relayToDiscord(env,msg(),async()=>new Response(null,{status:404})),false);assert.equal(one("SELECT count(*) n FROM discord_links WHERE club_id='c1'").n,0,'a deleted webhook ends the link');
// Re-link for the rest.
const again=(await d.createLinkCode(env,'lead','c1',now)).code;await d.handleInteraction(env,cmd('link',[{name:'code',value:again}]),http,now);
// Discord -> Rally.
const incoming=(over={})=>({id:'d1',channel_id:'ch1',content:'Hi from Discord <@7>',type:0,author:{id:'9',username:'zed',global_name:'Zed'},mentions:[{id:'7',username:'amy',global_name:'Amy'}],...over});
const stored=await d.ingestDiscordMessage(env,incoming(),'2026-10-14T12:05:00.000Z');assert.equal(stored.authorName,'Zed (Discord)');assert.equal(stored.body,'Hi from Discord @Amy');assert.equal(stored.authorId,null);
assert.equal(await d.ingestDiscordMessage(env,incoming(),'2026-10-14T12:06:00.000Z'),null,'the same Discord message is stored once');
assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d2',author:{id:'1',username:'bot',bot:true}})),null,'bots are ignored');assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d3',webhook_id:'w'})),null,'webhook posts (including Rally\'s own) are ignored');
assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d4',type:7})),null,'system messages are ignored');assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d5',channel_id:'elsewhere'})),null,'unlinked channels are ignored');assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d6',content:'   '})),null);
const nick=await d.ingestDiscordMessage(env,incoming({id:'d7',content:'files',member:{nick:'Nick  Name'},attachments:[{url:'https://cdn.example/a.png',filename:'a.png'}]}),'2026-10-14T12:07:00.000Z');assert.equal(nick.authorName,'Nick Name (Discord)');assert.match(nick.body,/a\.png: https:\/\/cdn\.example\/a\.png/);
assert.equal((await d.ingestDiscordMessage(env,incoming({id:'d8',content:'y'.repeat(3000)}),'2026-10-14T12:08:00.000Z')).body.length,2000);
// Members see them in club chat, labelled; only organizers can delete them; they never count as a member's own.
const view=await chat.readMessages(db,'mem','c1');const fromDiscord=view.messages.filter(m=>m.authorName.endsWith('(Discord)'));assert.equal(fromDiscord.length,3);assert.ok(fromDiscord.every(m=>m.authorId===null&&!m.canDelete&&!m.mine));
assert.ok((await chat.readMessages(db,'lead','c1')).messages.filter(m=>m.authorName.endsWith('(Discord)')).every(m=>m.canDelete),'organizers can remove them');
assert.equal((await chat.unreadCounts(db,'mem')).c1,3);await chat.deleteMessage(db,'lead',stored.id);assert.equal((await chat.readMessages(db,'mem','c1')).messages.some(m=>m.id===stored.id),false);await fail(chat.deleteMessage(db,'mem',nick.id),403);
// Unlinking from either side.
await d.unlinkClub(env,'lead','c1',http);assert.equal((await d.discordStatus(env,'lead','c1')).link,null);assert.equal(await d.ingestDiscordMessage(env,incoming({id:'d9'})),null,'unlinked means ignored');await fail(d.unlinkClub(env,'mem','c1',http),403);
const last=(await d.createLinkCode(env,'lead','c1',now)).code;await d.handleInteraction(env,cmd('link',[{name:'code',value:last}]),http,now);assert.match(await text(await d.handleInteraction(env,cmd('unlink'),http,now)),/Unlinked/);assert.equal(one('SELECT count(*) n FROM discord_links').n,0);
assert.equal(one('PRAGMA foreign_key_check'),undefined);
// The hidden "Discord" author never shows up as a player.
assert.equal(one("SELECT count(*) n FROM memberships WHERE player_id='discord-bridge'").n,0);assert.ok(one("SELECT deleted_at FROM profiles WHERE id='discord-bridge'").deleted_at);
console.log('Discord bridge checks passed: signatures, link codes, slash commands and permissions, Rally to Discord relay, Discord to Rally messages, loop prevention, moderation and unlinking.');
