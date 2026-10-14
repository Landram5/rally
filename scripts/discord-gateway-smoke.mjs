// Runs the Discord gateway connection against a fake Discord: handshake, heartbeats, messages arriving in Rally, and resuming after a drop.
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {rmSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{WebSocketServer}=require('../node_modules/.pnpm/ws@8.18.0/node_modules/ws');
const fakePort=8796,devPort=8797,persist='.wrangler-discord-smoke',config='scripts/discord-gateway-smoke/wrangler.jsonc';
rmSync(persist,{recursive:true,force:true});
mkdirSync(persist,{recursive:true});
const d1=(sql)=>{writeFileSync(persist+'/q.sql',sql);const r=spawnSync('pnpm',['exec','wrangler','d1','execute','DB','--config',config,'--local','--persist-to',persist,'--file',persist+'/q.sql','--json'],{shell:true,encoding:'utf8'});const m=r.stdout.match(/\[\s*\{[\s\S]*\]/);if(!m){if(r.status)throw new Error('d1 failed: '+r.stdout+r.stderr);return [];}const all=JSON.parse(m[0]);return all.at(-1).results??[];};
d1("CREATE TABLE discord_links(club_id TEXT PRIMARY KEY,guild_id TEXT,channel_id TEXT UNIQUE,channel_name TEXT,webhook_id TEXT,webhook_token TEXT,linked_by TEXT,created_at TEXT)");
d1("CREATE TABLE chat_messages(id TEXT PRIMARY KEY,club_id TEXT,author_id TEXT,author_name TEXT,body TEXT,media_id TEXT,client_id TEXT,created_at TEXT,deleted_at TEXT,deleted_by TEXT,source TEXT,external_name TEXT,UNIQUE(author_id,client_id))");
d1("INSERT INTO discord_links VALUES('c1','g1','ch1','general','wh','tok',NULL,'2026-10-14')");
const frames=[],sockets=[];
const wss=new WebSocketServer({port:fakePort});
wss.on('connection',ws=>{
 sockets.push(ws);ws.send(JSON.stringify({op:10,d:{heartbeat_interval:300}}));
 ws.on('message',raw=>{const f=JSON.parse(String(raw));frames.push(f);
  if(f.op===1)ws.send(JSON.stringify({op:11}));
  if(f.op===2){ws.send(JSON.stringify({op:0,s:1,t:'READY',d:{session_id:'sess1',resume_gateway_url:`ws://127.0.0.1:${fakePort}`}}));
   ws.send(JSON.stringify({op:0,s:2,t:'MESSAGE_CREATE',d:{id:'m1',channel_id:'ch1',content:'hello <@7>',type:0,author:{id:'9',username:'zed',global_name:'Zed'},mentions:[{id:'7',username:'amy'}]}}));
   ws.send(JSON.stringify({op:0,s:3,t:'MESSAGE_CREATE',d:{id:'m2',channel_id:'ch1',content:'from a bot',type:0,author:{id:'8',username:'bot',bot:true}}}));
   ws.send(JSON.stringify({op:0,s:4,t:'MESSAGE_CREATE',d:{id:'m3',channel_id:'other',content:'elsewhere',type:0,author:{id:'9',username:'zed'}}}));}
  if(f.op===6)ws.send(JSON.stringify({op:0,s:5,t:'MESSAGE_CREATE',d:{id:'m4',channel_id:'ch1',content:'after resume',type:0,author:{id:'9',username:'zed',global_name:'Zed'}}}));
 });
});
const dev=spawn('pnpm',['exec','wrangler','dev','--config',config,'--port',String(devPort),'--local','--persist-to',persist,'--var','DISCORD_BOT_TOKEN:fake-token',`DISCORD_GATEWAY_URL:http://127.0.0.1:${fakePort}`],{shell:true,stdio:['ignore','pipe','pipe']});
const ready=new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('wrangler dev did not start')),90000);dev.stdout.on('data',d=>{if(String(d).includes('Ready on')){clearTimeout(t);res();}});});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){if(fn())return true;await wait(150);}return false;};
try{
 await ready;
 const ensure=await (await fetch(`http://127.0.0.1:${devPort}/ensure`)).json();assert.equal(ensure.connected,true);
 assert.ok(await until(()=>frames.some(f=>f.op===2)),'the bot identifies itself');
 const identify=frames.find(f=>f.op===2);assert.equal(identify.d.token,'fake-token');assert.equal(identify.d.intents,(1<<0)|(1<<9)|(1<<15),'guild messages and message content');
 assert.ok(await until(()=>frames.filter(f=>f.op===1).length>=2),'heartbeats keep going');assert.ok(frames.filter(f=>f.op===1).some(f=>f.d===4),'heartbeats carry the latest sequence number');
 assert.ok(await until(()=>d1("SELECT id FROM chat_messages").length>=1),'a Discord message reaches Rally');
 await wait(600);
 const rows=d1("SELECT author_name,body,source,client_id,club_id FROM chat_messages ORDER BY created_at");
 assert.equal(rows.length,1,'bot messages and other channels are ignored');assert.deepEqual([rows[0].author_name,rows[0].body,rows[0].source,rows[0].client_id,rows[0].club_id],['Zed','hello @amy','discord','discord-m1','c1']);
 // The connection drops; the next check reconnects and resumes the same session.
 sockets[0].terminate();await wait(500);
 const again=await (await fetch(`http://127.0.0.1:${devPort}/ensure`)).json();assert.equal(again.connected,true);
 assert.ok(await until(()=>frames.some(f=>f.op===6)),'the bot resumes instead of starting over');assert.equal(frames.find(f=>f.op===6).d.session_id,'sess1');assert.equal(frames.find(f=>f.op===6).d.seq,4);
 assert.ok(await until(()=>d1("SELECT id FROM chat_messages WHERE client_id='discord-m4'").length===1),'messages keep arriving after resuming');
 // Closing for a permanent reason (bad token) stops retries.
 sockets.at(-1).close(4004,'Authentication failed');await wait(600);
 const status=await (await fetch(`http://127.0.0.1:${devPort}/status`)).json();assert.equal(status.connected,false);
 console.log('Discord gateway checks passed: identify with the right intents, heartbeats, messages into Rally, bot and wrong-channel messages ignored, resume after a drop and no retry on a bad token.');
}finally{
 if(process.platform==='win32')spawn('taskkill',['/pid',String(dev.pid),'/T','/F']);else dev.kill();
 wss.close();
}
process.exit(0);
