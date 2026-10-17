import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import { createRoomStore } from '../server/database.mjs';
import { createCollaborationServer } from '../server/collaboration.mjs';
import { ROOM_LIFETIME_MS } from '../lib/roomExpiry.mjs';
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const until = async predicate => { const end = Date.now() + 5000; while (!predicate()) { if (Date.now() > end) throw new Error('Room expiry did not complete'); await new Promise(resolve => setTimeout(resolve, 20)); } };
test('room lifetime is one day and edits do not renew it; purge removes all expired recovery files', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-expiry-'));
  try {
    const store = createRoomStore('', directory), old = crypto.randomUUID(), current = crypto.randomUUID();
    const snapshot = { title: 'Room', elements: [], markdownNotes: '' }, createdAt = Date.now() - ROOM_LIFETIME_MS + 10000;
    await store.create(current, 'Current', '', snapshot, null, createdAt);
    await store.save(current, '', { ...snapshot, markdownNotes: 'Edited' });
    expect(Date.parse((await store.load(current)).expiresAt)).toBe(createdAt + ROOM_LIFETIME_MS);
    await store.create(old, 'Old', '', snapshot, null, Date.now() - ROOM_LIFETIME_MS);
    for (const suffix of ['.bin', '.bin.tmp', '.json.tmp']) await writeFile(path.join(directory, old + suffix), 'recovery');
    expect(await store.purgeExpired()).toEqual([old]);
    for (const suffix of ['.json', '.bin', '.bin.tmp', '.json.tmp']) expect(await exists(path.join(directory, old + suffix))).toBe(false);
    expect(await store.load(old)).toBeNull(); expect(await store.load(current)).not.toBeNull();
    await expect(store.save(old, '', snapshot)).rejects.toThrow();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('active drawing and classroom connections expire and cannot resurrect their stored room', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-active-expiry-'));
  const store = createRoomStore('', directory), id = crypto.randomUUID(), seed = new Y.Doc();
  seed.getMap('meta').set('initialized', 'true'); seed.getText('notes').insert(0, 'Temporary');
  await store.create(id, 'Temporary', Buffer.from(Y.encodeStateAsUpdate(seed)).toString('base64'), { title: 'Temporary', elements: [], markdownNotes: 'Temporary' }, null, Date.now() - ROOM_LIFETIME_MS + 1500);
  seed.destroy();
  const service = createCollaborationServer({ port: 0, directory, roomStore: store });
  const address = await service.listen(), base = `http://127.0.0.1:${address.port}`;
  const doc = new Y.Doc(), provider = new WebsocketProvider(`ws://127.0.0.1:${address.port}`, id, doc, { WebSocketPolyfill: WebSocket, disableBc: true });
  let drawingClosed, callClosed, welcomed;
  provider.on('connection-close', event => { if (event?.code === 4001) { drawingClosed = true; provider.disconnect(); } });
  const call = new WebSocket(`ws://127.0.0.1:${address.port}/classroom/${id}`);
  call.on('open', () => call.send(JSON.stringify({ type: 'join', name: 'Teacher' })));
  call.on('message', raw => { if (JSON.parse(raw).type === 'welcome') welcomed = true; });
  call.on('close', code => { callClosed = code === 4001; });
  try {
    await until(() => provider.synced && welcomed);
    expect((await fetch(`${base}/api/rooms/cleanup`, { method: 'POST', headers: { Origin: 'https://other.example' } })).status).toBe(403);
    expect((await fetch(`${base}/api/rooms/${id}`)).status).toBe(200);
    await until(() => drawingClosed && callClosed);
    await service.cleanupExpired();
    expect((await fetch(`${base}/api/rooms/${id}`)).status).toBe(410);
    expect(await store.load(id)).toBeNull();
    const cleanup = await fetch(`${base}/api/rooms/cleanup`, { method: 'POST', headers: { Origin: base } });
    expect(cleanup.status).toBe(200); expect((await cleanup.json()).lifetimeHours).toBe(24);
    for (const suffix of ['.json', '.bin']) expect(await exists(path.join(directory, id + suffix))).toBe(false);
  } finally { provider.destroy(); doc.destroy(); call.close(); await service.close(); await rm(directory, { recursive: true, force: true }); }
}, 10000);
