import { test, expect } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import { connect } from 'node:net';
import path from 'node:path';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import { createCollaborationServer } from '../server/collaboration.mjs';
import { updateSharedText } from '../lib/collaboration.ts';
const until = async predicate => { const deadline = Date.now() + 5000; while (!predicate()) { if (Date.now() > deadline) throw new Error('Collaboration did not converge'); await new Promise(resolve => setTimeout(resolve, 20)); } };
test('concurrent note edits merge rather than replace the entire document', () => {
  const first = new Y.Doc(), second = new Y.Doc(); first.getText('notes').insert(0, 'Hello'); Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  updateSharedText(first.getText('notes'), 'Hello world'); updateSharedText(second.getText('notes'), 'Say Hello');
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second)); Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  expect(first.getText('notes').toString()).toBe('Say Hello world'); expect(second.getText('notes').toString()).toBe('Say Hello world'); first.destroy(); second.destroy();
});
test('two real WebSocket clients sync shapes, notes, presence and persisted rooms', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'whiteboard-rooms-'));
  const service = createCollaborationServer({ port: 0, directory, roomStore: null });
  const address = await service.listen();
  const room = crypto.randomUUID(), url = `ws://127.0.0.1:${address.port}`;
  const first = new Y.Doc(), second = new Y.Doc();
  const a = new WebsocketProvider(url, room, first, { WebSocketPolyfill: WebSocket, disableBc: true });
  const b = new WebsocketProvider(url, room, second, { WebSocketPolyfill: WebSocket, disableBc: true });
  try {
    await until(() => a.synced && b.synced);
    first.getMap('elements').set('shape-a', { id: 'shape-a', x: 100 });
    second.getMap('elements').set('shape-b', { id: 'shape-b', x: 200 });
    first.getText('notes').insert(0, 'Room notes');
    a.awareness.setLocalStateField('user', { name: 'Alice' }); b.awareness.setLocalStateField('user', { name: 'Bob' });
    await until(() => first.getMap('elements').size === 2 && second.getMap('elements').size === 2 && second.getText('notes').toString() === 'Room notes');
    await until(() => [...b.awareness.getStates().values()].some(s => s.user?.name === 'Alice'));
    first.getMap('elements').delete('shape-a'); await until(() => !second.getMap('elements').has('shape-a'));
    await new Promise(resolve => setTimeout(resolve, 250));
    const restored = new Y.Doc(); Y.applyUpdate(restored, new Uint8Array(await readFile(path.join(directory, `${room}.bin`))));
    expect(restored.getMap('elements').has('shape-b')).toBe(true); expect(restored.getMap('elements').has('shape-a')).toBe(false); expect(restored.getText('notes').toString()).toBe('Room notes'); restored.destroy();
  } finally { a.destroy(); b.destroy(); first.destroy(); second.destroy(); await service.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);

test('application room sessions seed once, preserve attachments, reconnect edits and undo locally', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'whiteboard-session-'));
  const service = createCollaborationServer({ port: 0, directory, roomStore: null }); const address = await service.listen();
  const room = crypto.randomUUID(), url = `ws://127.0.0.1:${address.port}`;
  const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
  const shape = { ...base, id: 'shape', type: 'rectangle', x: 10, y: 20, width: 120, height: 80 };
  const board = { id: room, title: 'Team board', elements: [shape], markdownNotes: 'Hello' };
  const a = new RoomSession(url, room, board); let first, second;
  a.onRemote = (elements, markdownNotes, title) => { first = { ...board, elements, markdownNotes, title }; };
  const b = new RoomSession(url, room, { ...board, title: 'Stale local board', elements: [], markdownNotes: 'Do not overwrite shared notes' });
  b.onRemote = (elements, markdownNotes, title) => { second = { ...board, elements, markdownNotes, title }; };
  try {
    a.connect(); await until(() => a.synced && first);
    b.connect(); await until(() => b.synced && second);
    expect(second.title).toBe('Team board'); expect(second.markdownNotes).toBe('Hello'); expect(second.elements).toHaveLength(1);
    a.update({ ...first, elements: [{ ...shape, x: 150 }], markdownNotes: 'Hello everyone' });
    await until(() => second.elements[0].x === 150 && second.markdownNotes === 'Hello everyone');
    a.provider.disconnect(); a.update({ ...first, elements: [{ ...shape, x: 150 }], markdownNotes: 'Hello everyone offline' });
    expect(a.notes.toString()).toBe('Hello everyone offline'); a.provider.connect();
    await until(() => second.markdownNotes === 'Hello everyone offline');
    a.undo.undo(); await until(() => second.markdownNotes !== 'Hello everyone offline');
    expect(second.markdownNotes).toBe('Hello');
    await until(() => b.provider.awareness.getStates().has(a.doc.clientID));
    const leavingId = a.doc.clientID; a.destroy(); a.destroy();
    await until(() => !b.provider.awareness.getStates().has(leavingId));
    expect(b.elements.has(shape.id)).toBe(true); expect(b.notes.toString()).toBe('Hello');
  } finally { a.destroy(); b.destroy(); await service.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);

test('adding from a stale scene cannot resurrect a shape deleted by a collaborator', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'whiteboard-delete-'));
  const service = createCollaborationServer({ port: 0, directory, roomStore: null }); const address = await service.listen();
  const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
  const original = { ...base, id: 'original', type: 'rectangle', x: 10, y: 20, width: 120, height: 80 };
  const added = { ...original, id: 'added', x: 300 };
  const board = { id: crypto.randomUUID(), title: 'Team board', elements: [original], markdownNotes: '' };
  const url = `ws://127.0.0.1:${address.port}`;
  const a = new RoomSession(url, board.id, board), b = new RoomSession(url, board.id);
  try {
    a.connect(); await until(() => a.synced); b.connect(); await until(() => b.synced && b.elements.has(original.id));
    b.update({ ...board, elements: [] }); await until(() => !a.elements.has(original.id));
    a.update({ ...board, elements: [original, added] });
    await until(() => b.elements.has(added.id));
    expect([...a.elements.keys()]).toEqual(['added']); expect([...b.elements.keys()]).toEqual(['added']);
    // Metadata/note changes must not bring the stale shape back either.
    a.update({ ...board, elements: [original, added], markdownNotes: 'Keep this deletion' });
    await until(() => b.notes.toString() === 'Keep this deletion'); expect(b.elements.has(original.id)).toBe(false);
  } finally { a.destroy(); b.destroy(); await service.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);
test('database rooms load before sync, persist edits and survive a fresh server', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-db-'));
  const room = crypto.randomUUID(), seed = new Y.Doc(); seed.getMap('meta').set('initialized', 'true'); seed.getMap('meta').set('title', 'Saved class'); seed.getText('notes').insert(0, 'Existing lesson');
  let saved = Buffer.from(Y.encodeStateAsUpdate(seed)).toString('base64'); seed.destroy(); let snapshot;
  const store = { async load() { await new Promise(r => setTimeout(r, 50)); return { state: saved }; }, async save(_id, state, next) { saved = state; snapshot = next; } };
  let service = createCollaborationServer({ port: 0, directory, roomStore: store }), provider, doc;
  try {
    let address = await service.listen(); doc = new Y.Doc(); provider = new WebsocketProvider(`ws://127.0.0.1:${address.port}`, room, doc, { WebSocketPolyfill: WebSocket, disableBc: true });
    await until(() => provider.synced); expect(doc.getText('notes').toString()).toBe('Existing lesson'); expect(doc.getMap('meta').get('title')).toBe('Saved class');
    doc.getText('notes').insert(doc.getText('notes').length, ' updated'); await until(() => snapshot?.markdownNotes === 'Existing lesson updated');
    provider.destroy(); doc.destroy(); await service.close();
    service = createCollaborationServer({ port: 0, directory, roomStore: store }); address = await service.listen(); doc = new Y.Doc(); provider = new WebsocketProvider(`ws://127.0.0.1:${address.port}`, room, doc, { WebSocketPolyfill: WebSocket, disableBc: true });
    await until(() => provider.synced); expect(doc.getText('notes').toString()).toBe('Existing lesson updated');
  } finally { provider?.destroy(); doc?.destroy(); await service.close(); await rm(directory, { recursive: true, force: true }); }
});
test('database outage rejects a room before any empty synchronization can happen', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-db-outage-'));
  const service = createCollaborationServer({ port: 0, directory, roomStore: { load: async () => { throw new Error('offline'); } } });
  const address = await service.listen();
  try { const response = await new Promise((resolve, reject) => { const socket = connect(address.port, '127.0.0.1', () => socket.write(`GET /${crypto.randomUUID()} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: SGVsbG9Xb3JsZDEyMzQ1Ng==\r\n\r\n`)); socket.on('data', data => { resolve(data.toString()); socket.destroy(); }); socket.on('error', reject); }); expect(response).toContain('503 Service Unavailable'); }
  finally { await service.close(); await rm(directory, { recursive: true, force: true }); }
});

test('canvas backgrounds, patterned shape fills and embedded images sync and background edits undo', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'paint-background-room-'));
  const service = createCollaborationServer({ port: 0, directory, roomStore: null }); const address = await service.listen();
  const room = crypto.randomUUID(), url = `ws://127.0.0.1:${address.port}`;
  const background = { fill: '#3b82f6', fillStyle: 'crosshatch', fillOpacity: 0.4 };
  const board = { id: room, title: 'Paint room', elements: [], markdownNotes: '', background };
  const a = new RoomSession(url, room, board), b = new RoomSession(url, room, board); let first, second;
  a.onRemote = (elements, markdownNotes, title, background) => { first = { ...board, elements, markdownNotes, title, background }; };
  b.onRemote = (elements, markdownNotes, title, background) => { second = { ...board, elements, markdownNotes, title, background }; };
  try {
    a.connect(); await until(() => first && a.synced); b.connect(); await until(() => second && b.synced);
    expect(second.background).toEqual(background);
    a.update({ ...first, background: { ...background, fillOpacity: 0 } }); await until(() => second.background.fillOpacity === 0);
    a.undo.undo(); await until(() => second.background.fillOpacity === 0.4);
    const base = { id: 'shape', type: 'rectangle', x: 0, y: 0, width: 100, height: 80, stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: '#ec4899', fillStyle: 'dots', fillOpacity: 0.6, opacity: 1, roundness: 'sharp', zIndex: 0 };
    const image = { ...base, id: 'image', type: 'image', source: 'data:image/png;base64,cGFpbnQ=', imageName: 'Paint image', zIndex: 1 };
    a.update({ ...first, elements: [base, image] }); await until(() => second.elements.length === 2);
    expect(second.elements[0]).toMatchObject({ fillStyle: 'dots', fillOpacity: 0.6 }); expect(second.elements[1].source).toBe(image.source);
    await new Promise(resolve => setTimeout(resolve, 250));
    const restored = new Y.Doc(); Y.applyUpdate(restored, new Uint8Array(await readFile(path.join(directory, `${room}.bin`)))); expect(JSON.parse(restored.getMap('meta').get('background'))).toEqual(background); restored.destroy();
  } finally { a.destroy(); b.destroy(); await service.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);

test('room chat syncs across clients and reconnects, preserves room isolation, and stays outside board undo', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-chat-'));
  const server = createCollaborationServer({ port: 0, directory, roomStore: null });
  const address = await server.listen(), url = `ws://127.0.0.1:${address.port}`;
  const room = crypto.randomUUID(), a = new RoomSession(url, room), b = new RoomSession(url, room), c = new RoomSession(url, crypto.randomUUID());
  let first = [], second = [], separate = [], boardEvents = 0;
  a.onChat = messages => { first = messages; }; b.onChat = messages => { second = messages; }; c.onChat = messages => { separate = messages; };
  try {
    expect(() => a.sendChat('Not connected')).toThrow('disconnected');
    a.connect(); b.connect(); c.connect(); await until(() => a.synced && b.synced && c.synced);
    await new Promise(resolve => setTimeout(resolve, 100)); b.onRemote = () => boardEvents++;
    a.setName('Alice'); b.setName('Bob'); a.sendChat('Hello from collaboration');
    await until(() => second.length === 1); expect(second[0]).toMatchObject({ name: 'Alice', text: 'Hello from collaboration' });
    expect(boardEvents).toBe(0); expect(a.undo.undoStack).toHaveLength(0);
    b.sendChat('Reply from the call'); await until(() => first.length === 2);
    expect(first).toEqual(second); expect(separate).toEqual([]);
    a.undo.undo(); expect(a.chat.length).toBe(2);
    b.provider.disconnect(); a.sendChat('While you reconnect'); b.provider.connect();
    await until(() => second.length === 3);
    expect(second[2].text).toBe('While you reconnect');
    await new Promise(resolve => setTimeout(resolve, 250));
    const restored = new Y.Doc(); Y.applyUpdate(restored, new Uint8Array(await readFile(path.join(directory, `${room}.bin`))));
    expect(restored.getArray('chat').toArray()).toEqual(second); restored.destroy();
    expect(() => a.sendChat('x'.repeat(2001))).toThrow('2000');
    b.provider.disconnect(); expect(() => b.sendChat('Keep this draft')).toThrow('disconnected');
    expect(first).toHaveLength(3);
  } finally { a.destroy(); b.destroy(); c.destroy(); await server.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);
test('room chat bounds history, rejects malformed entries, and prevents rapid accidental sending', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const { isRoomMessage } = await import('../lib/roomChat.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-chat-limit-'));
  const server = createCollaborationServer({ port: 0, directory, roomStore: null }); const address=await server.listen();
  const session = new RoomSession(`ws://127.0.0.1:${address.port}`, crypto.randomUUID()); let messages=[];
  session.onChat = next => { messages=next; };
  try {
    session.connect(); await until(() => session.synced);
    session.chat.push(Array.from({length:105},(_,i)=>({id:`seed-${i}`,author:1,name:'Alice',text:`Message ${i}`,at:Date.now()})));
    session.sendChat('Latest'); expect(session.chat.length).toBe(100); expect(messages.at(-1).text).toBe('Latest');
    for(let i=0;i<9;i++)session.sendChat(`Quick message ${i}`);
    expect(() => session.sendChat('One too many')).toThrow('quickly');
    const valid=messages.at(-1); for(const extra of [{at:1e100},{text:' '},{name:''},{text:'x'.repeat(2001)},{author:NaN},{id:''}])expect(isRoomMessage({...valid,...extra})).toBe(false);
    session.chat.push([{...valid,id:'malformed',at:1e100}]); expect(messages.some(message=>message.id==='malformed')).toBe(false);
  } finally { session.destroy(); await server.close(); await rm(directory,{recursive:true,force:true}); }
},10000);
