import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import ts from 'typescript';
mkdirSync('.test-runtime',{recursive:true});
writeFileSync('.test-runtime/cf-stub.mjs','export class DurableObject{}\n');
for(const name of readdirSync('lib').filter(f=>f.endsWith('.ts')).map(f=>f.slice(0,-3))){writeFileSync(`.test-runtime/${name}.mjs`,ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './$1.mjs'").replace(/from ['"]cloudflare:workers['"]/g,"from './cf-stub.mjs'"));}
const x=await import('../.test-runtime/discord-club.mjs'),d=await import('../.test-runtime/discord.mjs');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
const run=(q,...a)=>sql.prepare(q).run(...a),one=(q,...a)=>sql.prepare(q).get(...a);
function stmt(q,args=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {success:true,meta:sql.prepare(q).run(...args)}},execute(){return {success:true,meta:sql.prepare(q).run(...args)}}}}
const db={prepare:stmt,async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>s.execute());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e}}};
for(const p of ['lead','mem','other'])run('INSERT INTO profiles(id,auth_id,name,created_at) VALUES(?,?,?,?)',p,p+'-auth',p==='lead'?'Lena Lead':p+' Person','2026-10-01');
for(const [c,o] of [['c1','lead'],['c2','other']])run("INSERT INTO clubs(id,name,location,owner_id,created_at,approval_status) VALUES(?,?,?,?,'2026-10-01','approved')",c,'Club '+c,'City',o);
for(const [p,c,role] of [['lead','c1','owner'],['mem','c1','member'],['other','c2','owner']])run("INSERT INTO memberships(id,club_id,player_id,role,status,created_at) VALUES(?,?,?,?,'active','2026-10-01')",'m'+p,c,p,role);
const env={DB:db,DISCORD_BOT_TOKEN:'t',DISCORD_PUBLIC_KEY:'k'},calls=[],ok=async(url,init)=>{calls.push([url,JSON.parse(init.body)]);return new Response('{}',{status:200});};
const now='2026-10-14T12:00:00.000Z',nowD=new Date(now);
const link=()=>run("INSERT INTO discord_links(club_id,guild_id,channel_id,channel_name,webhook_id,webhook_token,created_at) VALUES('c1','g1','ch1','general','wh','tok','2026-10-10T00:00:00.000Z')");
// Nothing is posted without a link, and nothing is remembered either.
assert.equal(await x.announceClubAnnouncement(env,{id:'a1',clubId:'c1',title:'Hi',body:'Body'},ok,now),false);assert.equal(one('SELECT count(*) n FROM discord_posted').n,0);
link();
assert.equal(await x.announceClubAnnouncement(env,{id:'a1',clubId:'c1',title:'Hi',body:'Body'},ok,now),true);assert.equal(calls.length,1);
assert.deepEqual(calls[0][1].allowed_mentions,{parse:[]});assert.match(calls[0][1].embeds[0].title,/Hi/);
assert.equal(await x.announceClubAnnouncement(env,{id:'a1',clubId:'c1',title:'Hi',body:'Body'},ok,now),false,'never posted twice');assert.equal(calls.length,1);
// The organizer switch turns automatic posts off.
await assert.rejects(x.setAnnounce(env,'mem','c1',false),e=>e.status===403);await x.setAnnounce(env,'lead','c1',false);
assert.equal(await x.announceClubAnnouncement(env,{id:'a2',clubId:'c1',title:'Off',body:'B'},ok,now),false);assert.equal(calls.length,1);await x.setAnnounce(env,'lead','c1',true);
// A deleted webhook unlinks the club and is not remembered as posted.
assert.equal(await x.announceClubAnnouncement(env,{id:'a3',clubId:'c1',title:'T',body:'B'},async()=>new Response('',{status:404}),now),false);assert.equal(one('SELECT count(*) n FROM discord_links').n,0);assert.equal(one("SELECT count(*) n FROM discord_posted WHERE ref_id='a3'").n,0);
link();
// Sessions and tournaments.
run("INSERT INTO club_sessions(id,club_id,title,location,notes,starts_at,ends_at,created_by,created_at,updated_at,operation_id,operation_payload) VALUES('s1','c1','Friday play','Gym','','2026-10-16T22:00:00.000Z','2026-10-17T00:00:00.000Z','lead','2026-10-14','2026-10-14','op','{}')");
assert.equal(await x.announceSession(env,'s1',ok,now),true);assert.match(calls.at(-1)[1].embeds[0].description,/<t:\d+:F>/);assert.equal(await x.announceSession(env,'s1',ok,now),false);
run("INSERT INTO tournaments(id,name,club_id,date,format,capacity,created_at,status) VALUES('t_old','Old','c1','2026-09-01','Swiss',8,'2026-09-01','completed'),('t_new','Fall Open','c1','2026-10-12','Swiss',8,'2026-10-12','completed'),('t_live','Live','c1','2026-10-13','Swiss',8,'2026-10-13','active')");
assert.equal(await x.announceFinishedTournaments(env,ok,now),1,'only tournaments finished since linking');assert.match(calls.at(-1)[1].embeds[0].title,/Fall Open/);assert.equal(await x.announceFinishedTournaments(env,ok,now),0);
// Connecting a Discord account.
const {code}=await x.createConnectCode(env,'mem',nowD);assert.match(code,/^[A-Z2-9]{6}$/);
const cmd=(sub,opts=[],o={})=>({guild_id:'g1',channel:{id:'ch1'},member:{user:{id:'u1'}},data:{name:'club',options:[{name:sub,type:1,options:opts}]},...o}),txt=async r=>(await r.json()).data.content;
assert.match(await txt(await x.handleClubCommand(env,cmd('connect',[{name:'code',value:'WRONG1'}]),nowD)),/wrong or has expired/);
assert.match(await txt(await x.handleClubCommand(env,cmd('connect',[{name:'code',value:code.toLowerCase()}]),nowD)),/mem Person/);assert.equal(await x.connectedDiscord(env,'mem'),true);
assert.match(await txt(await x.handleClubCommand(env,cmd('connect',[{name:'code',value:code}]),nowD)),/wrong or has expired/,'a code works once');
const other=(await x.createConnectCode(env,'other',nowD)).code;assert.match(await txt(await x.handleClubCommand(env,cmd('connect',[{name:'code',value:other}]),nowD)),/already connected/);
assert.equal(await x.rallyNameFor(env,'u1','c1'),'mem Person');assert.equal(await x.rallyNameFor(env,'u1','c2'),null,'only inside clubs they belong to');
await x.disconnectDiscord(env,'mem');assert.equal(await x.rallyNameFor(env,'u1','c1'),null);
// Bridged messages use the Rally name once connected.
run('INSERT INTO discord_accounts(profile_id,discord_user_id,created_at) VALUES(?,?,?)','mem','u1',now);
const msg=await d.ingestDiscordMessage(env,{id:'m1',channel_id:'ch1',content:'hello',type:0,author:{id:'u1',username:'memdisc'}},now);assert.match(msg.authorName,/^mem Person/);
const anon=await d.ingestDiscordMessage(env,{id:'m2',channel_id:'ch1',content:'hi',type:0,author:{id:'u9',username:'stranger'}},now);assert.match(anon.authorName,/^stranger/);
// Read commands only work in a linked channel; the player lookup works anywhere.
assert.match(await txt(await x.handleClubCommand(env,cmd('next',[],{channel:{id:'zzz'}}),nowD)),/not linked/);
assert.match(await txt(await x.handleClubCommand(env,cmd('next'),nowD)),/Friday play/);
assert.match(await txt(await x.handleClubCommand(env,cmd('leaderboard'),nowD)),/no rated players|leaderboard/);
assert.match(await txt(await x.handleClubCommand(env,cmd('player',[{name:'name',value:'Nobody Here'}]),nowD)),/No Rally player/);
assert.match(await txt(await x.handleClubCommand(env,cmd('player',[{name:'name',value:'Lena'}]),nowD)),/Lena Lead/);
// /club arrives through the same interaction handler as /rally.
const res=await d.handleInteraction(env,{type:2,...cmd('next')},ok,nowD);assert.match(await txt(res),/Friday play/);

// Opt-in avatars: only for people who chose it, only when they have a photo, and the version is in the URL.
run("INSERT INTO profile_photos(player_id,image_data,updated_at) VALUES('lead','data:image/jpeg;base64,AAAA','v1')");
assert.equal(await x.avatarUrlFor(env,'lead'),null,'off by default');
await x.setAvatarOptIn(env,'lead',true,now);assert.equal(await x.avatarOptedIn(env,'lead'),true);assert.match(await x.avatarUrlFor(env,'lead'),/^https:\/\/rallytt\.net\/api\/players\/lead\/photo\?v=v1$/);
assert.equal(await x.avatarUrlFor(env,'mem'),null,'opted in nobody else');
await x.setAvatarOptIn(env,'mem',true,now);assert.equal(await x.avatarUrlFor(env,'mem'),null,'no photo, no avatar');
const sent=[];const cap=async(u,i)=>{sent.push(JSON.parse(i.body));return new Response('{}',{status:200});};
await d.relayToDiscord(env,{id:'r1',clubId:'c1',authorId:'lead',authorName:'Lena Lead',body:'hi',createdAt:now,media:null,mine:false,canDelete:false},cap);assert.match(sent.at(-1).avatar_url,/photo\?v=v1/);
await d.relayToDiscord(env,{id:'r2',clubId:'c1',authorId:'other',authorName:'other Person',body:'hi',createdAt:now,media:null,mine:false,canDelete:false},cap);assert.equal(sent.at(-1).avatar_url,undefined);
await x.setAvatarOptIn(env,'lead',false);assert.equal(await x.avatarUrlFor(env,'lead'),null);
// Match results are opt-in: off by default, and turning them on starts from now.
const mrow0=(id,status,played,tid=null,a='lead',b='mem',games='[[11,8],[6,11],[11,9]]')=>run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at,tournament_id) VALUES(?,'c1',?,?,?,3,?,?,'lead','lead','2026-10-13',?)",id,a,b,games,played,status,tid);
mrow0('mx_default_off','confirmed','2026-10-13');
assert.equal(one('SELECT announce_matches n FROM discord_links WHERE club_id=?','c1').n,0,'off by default');
assert.equal(await x.announceConfirmedMatches(env,ok,now),0,'nothing is posted while it is off');
await assert.rejects(x.setAnnounceMatches(env,'mem','c1',true,now),e=>e.status===403);
await x.setAnnounceMatches(env,'lead','c1',true,now);
assert.equal(await x.announceConfirmedMatches(env,ok,now),0,'results from before it was switched on are not sent');
// Confirmed club results are posted once; pending, tournament, old and pre-link results are not.
const mrow=(id,status,played,tid=null,a='lead',b='mem',games='[[11,8],[6,11],[11,9]]')=>run("INSERT INTO matches(id,club_id,a,b,games,best_of,played_on,status,submitted_by,confirmed_by,created_at,tournament_id) VALUES(?,'c1',?,?,?,3,?,?,'lead','lead','2026-10-13',?)",id,a,b,games,played,status,tid);
mrow('mx_ok','confirmed','2026-10-13');mrow('mx_pending','pending','2026-10-13');mrow('mx_tourn','confirmed','2026-10-13','t_live');mrow('mx_old','confirmed','2026-10-08');mrow('mx_prelink','confirmed','2026-10-09');
const before=calls.length;assert.equal(await x.announceConfirmedMatches(env,ok,now),1);const post=calls[before][1].embeds[0];assert.match(post.title,/Lena Lead beat mem Person 2.1/);assert.match(post.description,/11.8, 6.11, 11.9/);assert.match(post.url,/\/matches\/mx_ok$/);
assert.equal(await x.announceConfirmedMatches(env,ok,now),0,'never twice');
mrow('mx_loss','confirmed','2026-10-14',null,'lead','mem','[[5,11],[8,11]]');
assert.equal(await x.announceConfirmedMatches(env,ok,now),1);assert.match(calls.at(-1)[1].embeds[0].title,/mem Person beat Lena Lead 2.0/,'the winner is named first');
run("UPDATE profiles SET deleted_at='2026-10-14',auth_id=NULL,name='Deleted player' WHERE id='mem'");mrow('mx_del','confirmed','2026-10-14',null,'mem','lead','[[11,1],[11,2]]');
assert.equal(await x.announceConfirmedMatches(env,ok,now),1);assert.match(calls.at(-1)[1].embeds[0].title,/Deleted player beat Lena Lead/);
await x.setAnnounce(env,'lead','c1',false);mrow('mx_off','confirmed','2026-10-14');assert.equal(await x.announceConfirmedMatches(env,ok,now),0,'the switch turns it off');await x.setAnnounce(env,'lead','c1',true);
// Announcement channel: owners pick one; Rally makes its own webhook there.
const guildChannels=[{id:'111111111111111111',name:'announcements',type:0,position:2},{id:'222222222222222222',name:'voice',type:2,position:1},{id:'333333333333333333',name:'general',type:0,position:0}];
const hookCalls=[],hookHttp=async(url,init)=>{hookCalls.push([url,init?.method??'GET']);
 if(url.endsWith('/guilds/g1/channels'))return new Response(JSON.stringify(guildChannels),{status:200});
 if(url.endsWith('/channels/111111111111111111/webhooks'))return new Response(JSON.stringify({id:'wh_ann',token:'tok_ann'}),{status:200});
 if(url.includes('/webhooks/')&&init?.method==='DELETE')return new Response('',{status:200});
 return new Response('{}',{status:200});};
await assert.rejects(x.listAnnounceChannels(env,'mem','c1',hookHttp),e=>e.status===403);
assert.deepEqual((await x.listAnnounceChannels(env,'lead','c1',hookHttp)).channels.map(c=>c.name),['general','announcements'],'text channels only, in server order');
await assert.rejects(x.setAnnounceChannel(env,'mem','c1','111111111111111111',hookHttp),e=>e.status===403);
await assert.rejects(x.setAnnounceChannel(env,'lead','c1','222222222222222222',hookHttp),e=>e.status===400,'a voice channel is refused');
await assert.rejects(x.setAnnounceChannel(env,'lead','c1','999999999999999999',hookHttp),e=>e.status===400,'a channel outside the server is refused');
await assert.rejects(x.setAnnounceChannel(env,'lead','c1','111111111111111111',async(u,i)=>u.endsWith('/guilds/g1/channels')?new Response(JSON.stringify(guildChannels),{status:200}):new Response('no',{status:403})),e=>e.status===409&&/Manage Webhooks/.test(e.message),'missing permission gives a clear message');
assert.equal(one('SELECT announce_webhook_id w FROM discord_links WHERE club_id=?','c1').w,null,'a failed attempt changes nothing');
await x.setAnnounceChannel(env,'lead','c1','111111111111111111',hookHttp);
assert.equal(one('SELECT announce_channel_name n,announce_webhook_id w FROM discord_links WHERE club_id=?','c1').n,'announcements');
assert.equal((await d.discordStatus(env,'lead','c1')).link.announceChannel.name,'announcements');
const urls=[];const spy=async(u,i)=>{urls.push(u);return new Response('{}',{status:200});};
await x.announceClubAnnouncement(env,{id:'a_ch',clubId:'c1',title:'Hello',body:'B'},spy,now);assert.match(urls.at(-1),/webhooks\/wh_ann\/tok_ann$/,'announcements use the chosen channel');
mrow0('mx_chan','confirmed','2026-10-14');assert.equal(await x.announceConfirmedMatches(env,spy,now),2);assert.match(urls.at(-1),/wh_ann/,'match results use it too (the earlier switched-off one is sent now)');
// Chat messages still use the bridge webhook, not the announcement one.
await d.relayToDiscord(env,{id:'r_ch',clubId:'c1',authorId:'lead',authorName:'Lena Lead',body:'hi',createdAt:now,media:null,mine:false,canDelete:false},spy);assert.match(urls.at(-1),/webhooks\/wh\/tok$/,'chat stays in the chat channel');
// If the announcement webhook is deleted in Discord, announcements fall back to the chat channel and the link stays.
const gone=async(u)=>new Response('',{status:u.includes('wh_ann')?404:200});
assert.equal(await x.announceClubAnnouncement(env,{id:'a_gone',clubId:'c1',title:'T',body:'B'},gone,now),false);
assert.equal(one('SELECT announce_webhook_id w FROM discord_links WHERE club_id=?','c1').w,null);assert.equal(one('SELECT count(*) n FROM discord_links').n,1,'the chat link survives');
assert.equal(await x.announceClubAnnouncement(env,{id:'a_back',clubId:'c1',title:'T',body:'B'},spy,now),true);assert.match(urls.at(-1),/webhooks\/wh\/tok$/,'back in the chat channel');
// Choosing the chat channel again removes the announcement webhook.
await x.setAnnounceChannel(env,'lead','c1','111111111111111111',hookHttp);hookCalls.length=0;
await x.setAnnounceChannel(env,'lead','c1',null,hookHttp);assert.ok(hookCalls.some(([u,m])=>m==='DELETE'&&u.includes('wh_ann')),'the old webhook is deleted in Discord');assert.equal(one('SELECT announce_channel_id c FROM discord_links WHERE club_id=?','c1').c,null);
// Unlinking removes both webhooks.
await x.setAnnounceChannel(env,'lead','c1','111111111111111111',hookHttp);hookCalls.length=0;await d.unlinkClub(env,'lead','c1',hookHttp);
assert.ok(hookCalls.filter(([,m])=>m==='DELETE').length>=2,'both webhooks are removed on unlink');
console.log('discord club tests passed');
