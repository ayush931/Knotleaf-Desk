import { test, expect } from 'bun:test';
import { encodeRaster } from '../draw/rasterEncoder.ts';

test('encoding uses one worker, bounds queued jobs, and falls back after worker failure',async()=>{
 const saved=new Map(),workers=[],jobs=[];let nativeCalls=0,bitmaps=0;
 class WorkerMock {
  constructor(){workers.push(this);}
  postMessage(message){jobs.push({worker:this,...message});}
  terminate(){this.terminated=true;}
 }
 for(const[key,value]of Object.entries({Worker:WorkerMock,OffscreenCanvas:class{},createImageBitmap:async()=>({id:++bitmaps,close(){}})})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 const canvas={toBlob(callback,mime){nativeCalls++;callback(new Blob(['fallback'],{type:mime}));}};
 const tick=()=>new Promise(r=>setTimeout(r,0));
 try{
  const first=encodeRaster(canvas),second=encodeRaster(canvas);await expect(encodeRaster(canvas)).rejects.toThrow('Another export');await tick();
  expect(workers).toHaveLength(1);expect(jobs).toHaveLength(1);expect(bitmaps).toBe(1);
  jobs[0].worker.onmessage({data:{id:jobs[0].id,blob:new Blob(['first'],{type:'image/png'})}});expect(await(await first).text()).toBe('first');await tick();
  expect(workers).toHaveLength(1);expect(jobs).toHaveLength(2);
  jobs[1].worker.onmessage({data:{id:jobs[1].id,blob:new Blob(['second'],{type:'image/png'})}});await second;await tick();
  const failed=encodeRaster(canvas);await tick();workers[0].onerror({preventDefault(){}});expect(await(await failed).text()).toBe('fallback');expect(workers[0].terminated).toBe(true);expect(nativeCalls).toBe(1);
  await encodeRaster(canvas);expect(workers).toHaveLength(1);expect(nativeCalls).toBe(2);
 }finally{for(const[key,old]of saved)if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];}
});
