import { spawn } from 'node:child_process';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import os from 'node:os';
import path from 'node:path';
class TestSocket extends WebSocket { constructor(url, protocols) { super(url, protocols, { origin: 'http://127.0.0.1:47839' }); } }
const port = 47839;
const child = spawn(process.execPath, ['server/web.mjs', '--port', String(port), '--hostname', '127.0.0.1'], { cwd: process.env.SMOKE_STAGED ? 'server-dist' : process.cwd(), env: { ...process.env, DATABASE_URL: '', ...(process.env.SMOKE_STAGED ? { WHITEBOARD_STANDALONE: '1' } : {}), COLLAB_DATA_DIR: path.join(os.tmpdir(), 'whiteboard-smoke-rooms'), COLLAB_ORIGINS: `http://127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
const until = async predicate => { const deadline = Date.now() + 20000; while (!(await predicate())) { if (child.exitCode !== null || Date.now() > deadline) throw new Error(logs || 'Server smoke test timed out'); await new Promise(resolve => setTimeout(resolve, 100)); } };
let a, b, call;
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/api/collaboration-health`)).ok; } catch { return false; } });
  const home = await fetch(`http://127.0.0.1:${port}/`); if (!home.ok) throw new Error('Home page did not load');
  const manifestResponse=await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
  if(!manifestResponse.ok)throw new Error('Web app manifest did not load');
  const manifest=await manifestResponse.json();
  if(manifest.display!=='standalone'||manifest.scope!=='/'||manifest.icons.length<2)throw new Error('Invalid installable web app manifest');
  for(const icon of manifest.icons){const response=await fetch(`http://127.0.0.1:${port}${icon.src}`);if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('Web app install icon did not load');}
  const created = await fetch(`http://127.0.0.1:${port}/api/rooms`, {method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json'},body:JSON.stringify({title:'Smoke class',elements:[],markdownNotes:''})});
  if(created.status!==201) throw new Error('Room creation did not save on the hub: '+await created.text());
  const {id:room}=await created.json();
  const route = await fetch(`http://127.0.0.1:${port}/canvas/${room}`); if (!route.ok) throw new Error('Shared room route did not load');
  const first = new Y.Doc(), second = new Y.Doc();
  a = new WebsocketProvider(`ws://127.0.0.1:${port}/collaboration`, room, first, { WebSocketPolyfill: TestSocket, disableBc: true });
  b = new WebsocketProvider(`ws://127.0.0.1:${port}/collaboration`, room, second, { WebSocketPolyfill: TestSocket, disableBc: true });
  await until(() => a.synced && b.synced);
  first.getText('notes').insert(0, 'Same-origin sharing works');
  await until(() => second.getText('notes').toString() === 'Same-origin sharing works');
  call=new TestSocket(`ws://127.0.0.1:${port}/classroom/${room}`); let welcome;
  call.on('message',raw=>{const message=JSON.parse(raw);if(message.type==='welcome')welcome=message;});
  await new Promise((resolve,reject)=>{call.on('open',resolve);call.on('error',reject);});call.send(JSON.stringify({type:'join',name:'Teacher'}));await until(()=>welcome);call.close();
  console.log('PASS: home, web app manifest/icons, durable room creation, shared route, two-client sync and native classroom signaling');
  a.destroy(); b.destroy(); first.destroy(); second.destroy();
} catch (error) { console.error(error); process.exitCode = 1; }
finally { a?.destroy(); b?.destroy(); call?.close(); child.kill('SIGTERM'); }
