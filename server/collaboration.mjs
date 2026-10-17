import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection, setPersistence, docs } from '@y/websocket-server/utils';

import { attachClassroomServer } from './classroom.mjs';
import { handleRoomHttp } from './room-http.mjs';
import { createRoomStore } from './database.mjs';
import { ROOM_LIFETIME_MS } from '../lib/roomExpiry.mjs';

/** Invite IDs are bearer capabilities: anyone with a room link can edit that room. */
export function createCollaborationServer({ host = '127.0.0.1', port = 3002, directory = path.resolve('.collab-data'), origins = [], httpServer, pathPrefix = "/", roomStore } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  if (roomStore === undefined) roomStore = createRoomStore(process.env.DATABASE_URL, directory);
  const loaded = new Map();
  const loading = new Map();
  const writes = new Map();
  const ownedRooms = new Set();
  let closed = false;
  const expired = new Set(), expiryTimers = new Map(), deadlines = new Map();
  const snapshotOf = doc => ({ title: doc.getMap("meta").get("title") || "Shared whiteboard", elements: [...doc.getMap("elements").values()].map(el => el.type === "text" && el.isCodeCard ? { ...el, text: doc.getText(`code:${el.id}`).toString() } : el), markdownNotes: doc.getText("notes").toString() });
  const persist = async (name, doc) => {
    if (closed || !ownedRooms.has(name) || expired.has(name)) return;
    const state = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    const snapshot = snapshotOf(doc);
    // Serialize writes so a slower old snapshot cannot overwrite a newer one.
    const pending = (writes.get(name) || Promise.resolve()).catch(() => {}).then(async () => {
      if (closed || expired.has(name)) return;
      if (roomStore) {
        if (!await roomStore.load(name)) { expireRoom(name); return; }
        await roomStore.save(name, state, snapshot);
      }
      if (expired.has(name)) return;
      const destination = path.join(directory, `${name}.bin`);
      fs.writeFileSync(destination + '.tmp', Buffer.from(state, 'base64'));
      fs.renameSync(destination + '.tmp', destination);
    });
    writes.set(name, pending);
    pending.finally(() => { if (writes.get(name) === pending) writes.delete(name); }).catch(() => {});
    return pending;
  };
  const timers = new Map();
  setPersistence({
    provider: null,
    bindState(name, doc) {
      const filename = path.join(directory, `${name}.bin`);
      if (loaded.has(name)) {
        const state = loaded.get(name); loaded.delete(name);
        if (state) Y.applyUpdate(doc, new Uint8Array(Buffer.from(state, 'base64')));
      }
      // Merge a local recovery copy too; CRDT tombstones prevent stale files from resurrecting deleted work.
      if (fs.existsSync(filename)) Y.applyUpdate(doc, new Uint8Array(fs.readFileSync(filename)));
      if (deadlines.has(name)) doc.getMap('meta').set('expiresAt', new Date(deadlines.get(name)).toISOString());
      doc.on('update', () => {
        if (closed || expired.has(name)) return;
        clearTimeout(timers.get(name));
        timers.set(name, setTimeout(() => { persist(name, doc).catch(error => console.error('Room persistence failed:', error.message)); }, 150));
      });
    },
    async writeState(name, doc) { clearTimeout(timers.get(name)); timers.delete(name); try { await persist(name, doc); } catch (error) { console.error('Room persistence failed:', error.message); } },
  });
  const server = httpServer || http.createServer((request, response) => {
    if (handleRoomHttp(request,response,{store:roomStore,origins,appUrl:process.env.NEXT_PUBLIC_APP_URL,cleanupExpired})) return; response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ service: 'Whiteboard collaboration', status: 'ok' })); });
  const classroom = attachClassroomServer(server,{store:roomStore,origins,maxParticipants:process.env.CLASSROOM_MAX_PARTICIPANTS});
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  const expireRoom = name => {
    expired.add(name); clearTimeout(expiryTimers.get(name)); expiryTimers.delete(name);
    clearTimeout(timers.get(name)); timers.delete(name); loaded.delete(name);
    for (const socket of sockets.clients) if (socket.roomId === name) { socket.removeAllListeners('message'); socket.close(4001, 'Room expired after 24 hours'); }
    classroom.expireRoom(name);
    const doc = docs.get(name); if (doc) { docs.delete(name); doc.destroy(); }
    for (const suffix of ['.json', '.json.tmp', '.bin', '.bin.tmp']) fs.rmSync(path.join(directory, name + suffix), { force: true });
  };
  let sweeping;
  const cleanupExpired = () => {
    if (!sweeping) sweeping = (async () => {
      const ids = await roomStore?.purgeExpired?.() || [];
      for (const id of ids) expireRoom(id);
      // Recovery files must not resurrect rooms removed by a previous process.
      if (roomStore) for (const file of fs.readdirSync(directory)) {
        const id = file.replace(/\.(?:bin|json)(?:\.tmp)?$/, '');
        if (id === file || !/^[a-f\d-]{36}$/i.test(id)) continue;
        if (!await roomStore.load(id)) expireRoom(id);
      }
      return ids.length;
    })().finally(() => { sweeping = undefined; });
    return sweeping;
  };
  const sweepTimer = setInterval(() => { cleanupExpired().catch(error => console.error('Room expiry cleanup failed:', error.message)); }, 60000);
  sweepTimer.unref();
  void cleanupExpired().catch(error => console.error('Room expiry cleanup failed:', error.message));
  server.on('upgrade', async (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/classroom/') || !pathname.startsWith(pathPrefix)) return;
    const room = pathname.slice(pathPrefix.length);
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(room) || (origins.length && !origins.includes(request.headers.origin))) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (expired.has(room)) { socket.end('HTTP/1.1 410 Gone\r\n\r\n'); return; }
    if (roomStore) {
      // Load BEFORE exchanging Yjs sync messages: never seed an empty room over saved data.
      try {
        if (!loading.has(room)) loading.set(room, (writes.get(room) || Promise.resolve()).then(() => roomStore.load(room)));
        let stored = await loading.get(room);
        if (!stored) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
        const deadline = stored.expiresAt ? new Date(stored.expiresAt).getTime() : undefined;
        if (deadline !== undefined && Number.isFinite(deadline)) {
          if (deadline <= Date.now()) { expireRoom(room); socket.end('HTTP/1.1 410 Gone\r\n\r\n'); return; }
          deadlines.set(room, deadline);
          if (!expiryTimers.has(room)) expiryTimers.set(room, setTimeout(() => { expireRoom(room); void cleanupExpired().catch(error => console.error('Room expiry cleanup failed:', error.message)); }, Math.min(ROOM_LIFETIME_MS, deadline - Date.now())));
        }
        if (!docs.has(room)) loaded.set(room, stored.state);
      } catch { socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; }
      finally { loading.delete(room); }
    }
    if (socket.destroyed) return;
    sockets.handleUpgrade(request, socket, head, connection => { ownedRooms.add(room); connection.roomId = room; setupWSConnection(connection, request, { docName: room }); });
  });
  return {
    server,
    cleanupExpired,
    handleHttp: (request,response) => handleRoomHttp(request,response,{store:roomStore,origins,appUrl:process.env.NEXT_PUBLIC_APP_URL,cleanupExpired}),
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }),
    close: async () => {
      clearInterval(sweepTimer); for (const timer of expiryTimers.values()) clearTimeout(timer);
      await sweeping;
      for (const timer of timers.values()) clearTimeout(timer);
      await Promise.allSettled([...writes.values()]);
      await Promise.all([...ownedRooms].map(async name => { const doc = docs.get(name); if (doc) await persist(name, doc); }));
      closed = true;
      classroom.close();
      for (const client of sockets.clients) client.close();
      await new Promise(resolve => server.close(resolve));
      await roomStore?.close?.();
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');
  const service = createCollaborationServer({ host: process.env.COLLAB_HOST || '127.0.0.1', port: Number(process.env.COLLAB_PORT || 3002), directory: process.env.COLLAB_DATA_DIR || path.resolve('.collab-data'), origins: (process.env.COLLAB_ORIGINS || '').split(',').filter(Boolean) });
  const address = await service.listen(); console.log(`Collaboration listening on ${address.address}:${address.port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await service.close(); process.exit(0); });
}
