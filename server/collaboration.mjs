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

/** Invite IDs are bearer capabilities: anyone with a room link can edit that room. */
export function createCollaborationServer({ host = '127.0.0.1', port = 3002, directory = path.resolve('.collab-data'), origins = [], httpServer, pathPrefix = "/", roomStore } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  if (roomStore === undefined) roomStore = createRoomStore(process.env.DATABASE_URL, directory);
  const loaded = new Map();
  const loading = new Map();
  const writes = new Map();
  const snapshotOf = doc => ({ title: doc.getMap("meta").get("title") || "Shared whiteboard", elements: [...doc.getMap("elements").values()].map(el => el.type === "text" && el.isCodeCard ? { ...el, text: doc.getText(`code:${el.id}`).toString() } : el), markdownNotes: doc.getText("notes").toString() });
  const persist = async (name, doc) => {
    const destination = path.join(directory, `${name}.bin`);
    fs.writeFileSync(destination + '.tmp', Y.encodeStateAsUpdate(doc));
    fs.renameSync(destination + '.tmp', destination);
    if (!roomStore) return Promise.resolve();
    const state = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    const snapshot = snapshotOf(doc);
    // Serialize writes so a slower old snapshot cannot overwrite a newer one.
    const pending = (writes.get(name) || Promise.resolve()).catch(() => {}).then(() => roomStore.save(name, state, snapshot));
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
      doc.on('update', () => {
        clearTimeout(timers.get(name));
        timers.set(name, setTimeout(() => { persist(name, doc).catch(error => console.error('Room persistence failed:', error.message)); }, 150));
      });
    },
    async writeState(name, doc) { clearTimeout(timers.get(name)); timers.delete(name); try { await persist(name, doc); } catch (error) { console.error('Room persistence failed:', error.message); } },
  });
  const server = httpServer || http.createServer((request, response) => {
    if (handleRoomHttp(request,response,{store:roomStore,origins,appUrl:process.env.NEXT_PUBLIC_APP_URL})) return; response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ service: 'Whiteboard collaboration', status: 'ok' })); });
  const classroom = attachClassroomServer(server,{store:roomStore,origins,maxParticipants:process.env.CLASSROOM_MAX_PARTICIPANTS});
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  server.on('upgrade', async (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/classroom/') || !pathname.startsWith(pathPrefix)) return;
    const room = pathname.slice(pathPrefix.length);
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(room) || (origins.length && !origins.includes(request.headers.origin))) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (roomStore && !docs.has(room)) {
      // Load BEFORE exchanging Yjs sync messages: never seed an empty room over saved data.
      try {
        if (!loading.has(room)) loading.set(room, (writes.get(room) || Promise.resolve()).then(() => roomStore.load(room)));
        let stored = await loading.get(room);
        const legacy = path.join(directory, `${room}.bin`);
        if (!stored && fs.existsSync(legacy)) {
          const state = fs.readFileSync(legacy).toString('base64'), doc = new Y.Doc();
          try { Y.applyUpdate(doc, new Uint8Array(Buffer.from(state, 'base64'))); const snapshot = snapshotOf(doc); await roomStore.create(room, snapshot.title, state, snapshot); stored = await roomStore.load(room); } finally { doc.destroy(); }
        }
        if (!stored) { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
        if (!docs.has(room)) loaded.set(room, stored.state);
      } catch { socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n'); return; }
      finally { loading.delete(room); }
    }
    if (socket.destroyed) return;
    sockets.handleUpgrade(request, socket, head, connection => setupWSConnection(connection, request, { docName: room }));
  });
  return {
    server,
    handleHttp: (request,response) => handleRoomHttp(request,response,{store:roomStore,origins,appUrl:process.env.NEXT_PUBLIC_APP_URL}),
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }),
    close: async () => {
      await Promise.all([...docs].map(async ([name, doc]) => { clearTimeout(timers.get(name)); await persist(name, doc); }));
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
