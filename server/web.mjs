import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import next from 'next';
import { createCollaborationServer } from './collaboration.mjs';
import { canonicalAuthPageURL } from '../lib/authOrigin.mjs';

if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');
const dev = process.argv.includes('--dev');
const local = process.argv.includes('--local');
const dataFlag = process.argv.indexOf('--data-dir');
if (local) {
  // Keep hosted credentials intact on disk while making local use independent.
  process.env.DATABASE_URL = '';
  process.env.NEXT_PUBLIC_COLLAB_URL = '';
  process.env.NEXT_PUBLIC_APP_URL = '';
  process.env.COLLAB_ORIGINS = '';
  process.env.COLLAB_DATA_DIR = path.resolve(dataFlag >= 0 ? process.argv[dataFlag + 1] : '.collab-data');
}
if (dev && !process.env.DATABASE_URL) {
  const { createLocalDeskAuth } = await import('./auth-local.mjs');
  globalThis[Symbol.for('knotleaf.localAuthFactory')] = () => createLocalDeskAuth();
}
const portFlag = process.argv.indexOf('--port');
const hostFlag = process.argv.indexOf('--hostname');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 3000);
const hostname = hostFlag >= 0 ? process.argv[hostFlag + 1] : local ? '127.0.0.1' : process.env.WEB_HOST || '0.0.0.0';
if (local) process.env.COLLAB_ORIGINS = [...new Set(['localhost', '127.0.0.1', '[::1]', ...(hostname !== '0.0.0.0' && hostname !== '::' ? [hostname] : [])])].map(host => `http://${host}:${port}`).join(',');
const conf = process.env.WHITEBOARD_STANDALONE === '1' ? JSON.parse(fs.readFileSync(path.resolve('.next/required-server-files.json'), 'utf8')).config : undefined;
const web = next({ dev, hostname, port, ...(conf ? { conf } : {}) });
await web.prepare();
const handler = web.getRequestHandler();
const server = http.createServer((request, response) => {
  if (['GET', 'HEAD'].includes(request.method)) {
    const pathname = (request.url || '/').split('?')[0];
    if (['/', '/signin', '/signup', '/present'].includes(pathname) || pathname.startsWith('/canvas/') || pathname.startsWith('/r/') || pathname.startsWith('/v/')) {
      const target = canonicalAuthPageURL(`http://${request.headers.host}${request.url}`, process.env.BETTER_AUTH_URL);
      if (target) { response.writeHead(307, { Location: target, 'Cache-Control': 'no-store' }); response.end(); return; }
    }
  }
  if (collaboration.handleHttp(request,response)) return;
  if (request.url === '/api/collaboration-health') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ features: ['paint-images', 'background-fills'], collaboration: true, websocketUrl: '/collaboration', storage: process.env.DATABASE_URL ? 'database' : 'local' })); return; }
  handler(request, response).catch(error => { console.error(error); if (!response.headersSent) response.writeHead(500); response.end('Unable to load Whiteboard'); });
});
const collaboration = createCollaborationServer({ httpServer: server, pathPrefix: '/collaboration/', directory: process.env.COLLAB_DATA_DIR || path.resolve('.collab-data'), origins: (process.env.COLLAB_ORIGINS || '').split(',').filter(Boolean) });
server.on('upgrade', (request, socket, head) => {
  if (!(request.url || '').startsWith('/collaboration/') && !(request.url || '').startsWith('/classroom/')) web.getUpgradeHandler()(request, socket, head);
});
server.on('error', error => { console.error(`Unable to start Whiteboard: ${error.message}`); process.exit(1); });
server.listen(port, hostname, () => console.log(`Whiteboard + collaboration ready on http://${hostname}:${port}`));
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (closing) return; closing = true; await collaboration.close(); await web.close(); process.exit(0); });
