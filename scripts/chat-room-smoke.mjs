// Starts the chat room locally and checks live delivery: two sockets in one room receive an event, a socket in another room does not.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=8791,child=spawn('pnpm',['exec','wrangler','dev','--config','scripts/chat-room-smoke/wrangler.jsonc','--port',String(port),'--local'],{shell:true,stdio:['ignore','pipe','pipe']});
const ready=new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('wrangler dev did not start')),90000);child.stdout.on('data',d=>{if(String(d).includes('Ready on')){clearTimeout(t);res();}});});
try{
 await ready;
 const open=(club,player)=>new Promise((res,rej)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/connect?club=${club}&player=${player}`);ws.inbox=[];ws.onmessage=e=>ws.inbox.push(String(e.data));ws.onopen=()=>res(ws);ws.onerror=()=>rej(new Error('socket failed'));});
 const a=await open('club1','p1'),b=await open('club1','p2'),c=await open('club2','p3');
 const publish=async(club,event)=>(await fetch(`http://127.0.0.1:${port}/publish?club=${club}`,{method:'POST',body:JSON.stringify(event)})).json();
 const result=await publish('club1',{type:'message',message:{id:'m1',body:'hi'}});
 await new Promise(r=>setTimeout(r,500));
 assert.deepEqual(a.inbox.map(x=>JSON.parse(x).message.id),['m1']);assert.deepEqual(b.inbox.map(x=>JSON.parse(x).message.id),['m1']);assert.equal(c.inbox.length,0,'another club does not receive it');
 assert.deepEqual(result.online.sort(),['p1','p2'],'the room reports who was connected');
 a.send('ping');await new Promise(r=>setTimeout(r,300));assert.ok(a.inbox.includes('pong'));
 b.close();await new Promise(r=>setTimeout(r,300));assert.deepEqual((await publish('club1',{type:'delete',id:'m1'})).online,['p1'],'closed sockets drop out');
 await assert.rejects(open('club1',''),'a connection without a verified member is refused');

 // Media: sniffing, size limits, streaming into R2 and range requests.
 const base=`http://127.0.0.1:${port}`,jpeg=new Uint8Array(3000).map((_,i)=>i%251);jpeg.set([0xff,0xd8,0xff,0xe0]);
 const up=await fetch(base+'/upload',{method:'POST',body:jpeg});assert.equal(up.status,200,await up.clone().text());const item=await up.json();assert.equal(item.kind,'image');assert.equal(item.contentType,'image/jpeg');
 const full=await fetch(`${base}/media/${item.id}`);assert.equal(full.status,200,await full.clone().text());assert.equal(full.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await full.arrayBuffer()),jpeg,'the file round-trips byte for byte');
 const part=await fetch(`${base}/media/${item.id}`,{headers:{range:'bytes=10-19'}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),'bytes 10-19/3000');assert.deepEqual(new Uint8Array(await part.arrayBuffer()),jpeg.slice(10,20));
 assert.equal((await fetch(`${base}/media/${item.id}`,{headers:{range:'bytes=5000-'}})).status,416);
 const mp4=new Uint8Array(500);mp4.set([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d]);const vid=await (await fetch(base+'/upload',{method:'POST',body:mp4})).json();assert.equal(vid.kind,'video');
 assert.equal((await fetch(base+'/upload',{method:'POST',body:new TextEncoder().encode('<svg onload=alert(1)></svg>')})).status,415,'only photos and videos');
 assert.equal((await fetch(base+'/upload',{method:'POST',body:(()=>{const b=new Uint8Array(9*1024*1024);b.set([0xff,0xd8,0xff]);return b})()})).status,413,'photos over 8 MB are refused');
 assert.equal((await fetch(`${base}/media/nope`)).status,404);
 console.log('Chat room checks passed: live fan-out per club, presence, ping, refusal of unverified connections, media sniffing, size limits, R2 streaming and range requests.');
 a.close();c.close();
}finally{if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/T','/F']);else child.kill();}
process.exit(0);
