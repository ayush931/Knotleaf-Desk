import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection, setPersistence, docs } from '@y/websocket-server/utils';

/** Invite IDs are bearer capabilities: anyone with a room link can edit that room. */
export function createCollaborationServer({ host = '127.0.0.1', port = 3002, directory = path.resolve('.collab-data'), origins = [], httpServer, pathPrefix = "/" } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const persist = (name, doc) => {
    const destination = path.join(directory, `${name}.bin`);
    fs.writeFileSync(destination + '.tmp', Y.encodeStateAsUpdate(doc));
    fs.renameSync(destination + '.tmp', destination);
  };
  const timers = new Map();
  setPersistence({
    provider: null,
    bindState(name, doc) {
      const filename = path.join(directory, `${name}.bin`);
      if (fs.existsSync(filename)) Y.applyUpdate(doc, new Uint8Array(fs.readFileSync(filename)));
      doc.on('update', () => {
        clearTimeout(timers.get(name));
        timers.set(name, setTimeout(() => { try { persist(name, doc); } catch (error) { console.error('Room persistence failed:', error.message); } }, 150));
      });
    },
    async writeState(name, doc) { clearTimeout(timers.get(name)); timers.delete(name); persist(name, doc); },
  });
  const server = httpServer || http.createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ service: 'Whiteboard collaboration', status: 'ok' })); });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(pathPrefix)) return;
    const room = pathname.slice(pathPrefix.length);
    if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(room) || (origins.length && !origins.includes(request.headers.origin))) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    sockets.handleUpgrade(request, socket, head, connection => setupWSConnection(connection, request, { docName: room }));
  });
  return {
    server,
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server.address())); }),
    close: async () => {
      for (const [name, doc] of docs) { clearTimeout(timers.get(name)); persist(name, doc); }
      for (const client of sockets.clients) client.close();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');
  const service = createCollaborationServer({ host: process.env.COLLAB_HOST || '127.0.0.1', port: Number(process.env.COLLAB_PORT || 3002), directory: process.env.COLLAB_DATA_DIR || path.resolve('.collab-data'), origins: (process.env.COLLAB_ORIGINS || '').split(',').filter(Boolean) });
  const address = await service.listen(); console.log(`Collaboration listening on ${address.address}:${address.port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await service.close(); process.exit(0); });
}
