import assert from 'node:assert/strict';
import {startActivityRefresh} from '../lib/activity-refresh.ts';
let calls=0,tick,interval;const hostListeners=new Map(),pageListeners=new Map();
const host={setInterval(fn,delay){tick=fn;interval=delay;return 7;},clearInterval(id){assert.equal(id,7);tick=null;},addEventListener(type,fn){hostListeners.set(type,fn);},removeEventListener(type,fn){assert.equal(hostListeners.get(type),fn);hostListeners.delete(type);}};
const page={visibilityState:'visible',addEventListener(type,fn){pageListeners.set(type,fn);},removeEventListener(type,fn){assert.equal(pageListeners.get(type),fn);pageListeners.delete(type);}};
const stop=startActivityRefresh(host,page,()=>calls++);assert.equal(interval,30000);assert.equal(calls,0);tick();assert.equal(calls,1);hostListeners.get('focus')();assert.equal(calls,2);
page.visibilityState='hidden';tick();hostListeners.get('focus')();pageListeners.get('visibilitychange')();assert.equal(calls,2);
page.visibilityState='visible';pageListeners.get('visibilitychange')();assert.equal(calls,3);stop();assert.equal(tick,null);assert.equal(hostListeners.size,0);assert.equal(pageListeners.size,0);
console.log('Passed refresh cadence, focus/resume, hidden-page pause and listener/timer cleanup.');
