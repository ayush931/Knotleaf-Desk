import { test,expect } from 'bun:test';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import { NextRequest } from 'next/server';
import * as Y from 'yjs';
import { POST } from '../app/api/rooms/route.ts';
import { createRoomStore } from '../server/database.mjs';
import { createStoredRoom } from '../server/room-http.mjs';
test('self-hosted disk room store saves links, code, notes and survives reopening',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'knotleaf-store-'));
 try{const store=createRoomStore('',directory);const room=await createStoredRoom(store,{title:'Class',elements:[],markdownNotes:'# Lesson'},'https://desk.example');
 const record=await createRoomStore('',directory).load(room.id);expect(record.shareUrl).toBe(`https://desk.example/canvas/${room.id}`);expect(record.snapshot.markdownNotes).toBe('# Lesson');
 const doc=new Y.Doc();Y.applyUpdate(doc,new Uint8Array(Buffer.from(record.state,'base64')));expect(doc.getText('notes').toString()).toBe('# Lesson');expect(doc.getMap('meta').get('initialized')).toBe('true');doc.destroy();
 await expect(createStoredRoom(store,{title:'Bad'},'https://desk.example')).rejects.toThrow('Invalid board');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('serverless frontend rejects cross-origin creation and explains a missing hub',async()=>{
 const before=process.env.NEXT_PUBLIC_COLLAB_URL;process.env.NEXT_PUBLIC_COLLAB_URL='';
 const request=origin=>new NextRequest('https://desk.example/api/rooms',{method:'POST',headers:{origin},body:'{}'});
 try{expect((await POST(request('https://other.example'))).status).toBe(403);expect((await POST(request('https://desk.example'))).status).toBe(503);}
 finally{if(before===undefined)delete process.env.NEXT_PUBLIC_COLLAB_URL;else process.env.NEXT_PUBLIC_COLLAB_URL=before;}
});
