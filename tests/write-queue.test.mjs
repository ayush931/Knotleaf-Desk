import {test,expect} from 'bun:test';
import {enqueueLatest} from '../server/latest-write-queue.mjs';
test('slow room storage coalesces intermediate snapshots without reordering the latest save',async()=>{
 const running=new Map(),waiting=new Map(),saved=[];let release;
 const write=async value=>{saved.push(value);if(value===1)await new Promise(resolve=>release=resolve);};
 const first=enqueueLatest(running,waiting,'room',1,write);await Promise.resolve();
 const second=enqueueLatest(running,waiting,'room',2,write);const latest=enqueueLatest(running,waiting,'room',3,write);
 expect(first).toBe(second);expect(latest).toBe(first);expect(waiting.size).toBe(1);release();await first;
 expect(saved).toEqual([1,3]);await Promise.resolve();expect(running.size).toBe(0);expect(waiting.size).toBe(0);
});
test('failed writes remain retryable and different rooms do not block one another',async()=>{
 const running=new Map(),waiting=new Map();
 await expect(enqueueLatest(running,waiting,'a',1,async()=>{throw new Error('Offline');})).rejects.toThrow('Offline');
 let saved;await enqueueLatest(running,waiting,'a',2,async value=>{saved=value;});expect(saved).toBe(2);
 let release;const slow=enqueueLatest(running,waiting,'a',3,()=>new Promise(resolve=>release=resolve));await Promise.resolve();
 await enqueueLatest(running,waiting,'b',4,async value=>{saved=value;});expect(saved).toBe(4);release();await slow;
});
