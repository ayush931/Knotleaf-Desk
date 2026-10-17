import { test,expect } from 'bun:test';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import { NextRequest } from 'next/server';
import * as Y from 'yjs';
import { POST } from '../app/api/rooms/route.ts';
import { createRoomStore } from '../server/database.mjs';
import { createStoredRoom } from '../server/room-http.mjs';
import { GET as health } from '../app/api/collaboration-health/route.ts';
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
test('production proxy preserves the public origin behind a reverse proxy and allows cold starts', async () => {
 const previous = { endpoint: process.env.NEXT_PUBLIC_COLLAB_URL, app: process.env.NEXT_PUBLIC_APP_URL, fetch: globalThis.fetch };
 process.env.NEXT_PUBLIC_COLLAB_URL = 'wss://rooms.example/collaboration'; process.env.NEXT_PUBLIC_APP_URL = 'https://desk.example';
 const id = crypto.randomUUID();
 try {
  globalThis.fetch = async (url, options) => {
   expect(url.toString()).toBe('https://rooms.example/api/rooms');
   expect(options.headers.Origin).toBe('https://desk.example');
   expect(options.signal.aborted).toBe(false);
   return Response.json({ id, title: 'Shared' }, { status: 201 });
  };
  const response = await POST(new NextRequest('http://internal:3000/api/rooms', { method: 'POST', headers: { origin: 'https://desk.example' }, body: JSON.stringify({ title: 'Board', elements: [], markdownNotes: '' }) }));
  expect(response.status).toBe(201); expect((await response.json()).id).toBe(id);
  expect((await health().json()).websocketUrl).toBe('wss://rooms.example/collaboration');
 } finally {
  globalThis.fetch = previous.fetch;
  for (const [key, value] of [['NEXT_PUBLIC_COLLAB_URL', previous.endpoint], ['NEXT_PUBLIC_APP_URL', previous.app]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
 }
});
test('legacy boards without notes can create durable local rooms', async () => {
 const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-legacy-room-'));
 try {
  const store = createRoomStore('', directory);
  const room = await createStoredRoom(store, { title: 'Legacy', elements: [] }, 'http://localhost:3000');
  expect((await store.load(room.id)).snapshot.markdownNotes).toBe('');
 } finally { await rm(directory, { recursive: true, force: true }); }
});
