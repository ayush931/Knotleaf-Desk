import { spawn } from 'node:child_process';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
class TestSocket extends WebSocket { constructor(url, protocols) { super(url, protocols, { origin: 'http://127.0.0.1:47839' }); } }
const port = 47839;
const directory = path.join(os.tmpdir(), 'whiteboard-smoke-rooms');
let logs = '';
const launch = () => {
  const childProcess = spawn(process.execPath, ['server/web.mjs', '--local', '--data-dir', directory, '--port', String(port), '--hostname', '127.0.0.1'], { cwd: process.env.SMOKE_STAGED ? 'server-dist' : process.cwd(), env: { ...process.env, DATABASE_URL: 'postgres://unused:unused@invalid.invalid/unused', NEXT_PUBLIC_COLLAB_URL: 'wss://hosted.example/collaboration', NEXT_PUBLIC_APP_URL: 'https://hosted.example', ...(process.env.SMOKE_STAGED ? { WHITEBOARD_STANDALONE: '1' } : {}), COLLAB_ORIGINS: 'https://hosted.example' }, stdio: ['ignore', 'pipe', 'pipe'] });
  childProcess.stdout.on('data', data => { logs += data; }); childProcess.stderr.on('data', data => { logs += data; });
  return childProcess;
};
let child = launch();
const until = async predicate => { const deadline = Date.now() + 20000; while (!(await predicate())) { if (child.exitCode !== null || Date.now() > deadline) throw new Error(logs || 'Server smoke test timed out'); await new Promise(resolve => setTimeout(resolve, 100)); } };
let a, b, call, restored;
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/api/collaboration-health`)).ok; } catch { return false; } });
  const config = await (await fetch(`http://127.0.0.1:${port}/api/collaboration-health`)).json();
  if (!config.features?.includes('paint-images') || !config.features?.includes('background-fills')) throw new Error('Paint image and background support missing from room server');
  if (config.websocketUrl !== '/collaboration' || config.storage !== 'local') throw new Error('Local room configuration points at the hosted service');
  const home = await fetch(`http://127.0.0.1:${port}/`); if (!home.ok) throw new Error('Home page did not load');
  const manifestResponse=await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
  if(!manifestResponse.ok)throw new Error('Web app manifest did not load');
  const manifest=await manifestResponse.json();
  if(manifest.display!=='standalone'||manifest.scope!=='/'||manifest.icons.length<2)throw new Error('Invalid installable web app manifest');
  for(const icon of manifest.icons){const response=await fetch(`http://127.0.0.1:${port}${icon.src}`);if(!response.ok||!response.headers.get('content-type')?.includes('image/png'))throw new Error('Web app install icon did not load');}
  const created = await fetch(`http://127.0.0.1:${port}/api/rooms`, {method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json'},body:JSON.stringify({title:'Smoke class',elements:[{id:'smoke-image',type:'image',source:'data:image/png;base64,cGFpbnQ=',imageName:'Paint',x:0,y:0,width:20,height:20,stroke:'transparent',strokeWidth:0,strokeStyle:'solid',fill:'transparent',fillStyle:'none',roundness:'sharp',opacity:1,zIndex:0}],markdownNotes:'',background:{fill:'#ec4899',fillStyle:'crosshatch',fillOpacity:0.4}})});
  if(created.status!==201) throw new Error('Room creation did not save on the hub: '+await created.text());
  const {id:room}=await created.json();
  const saved = JSON.parse(await readFile(path.join(directory, `${room}.json`), 'utf8'));
  if (saved.snapshot.background?.fillOpacity !== 0.4 || saved.snapshot.elements[0]?.type !== 'image') throw new Error('Paint image/background did not persist at creation');
  if (saved.shareUrl !== `http://127.0.0.1:${port}/canvas/${room}`) throw new Error('Local room invite points at production');
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
  a.destroy(); b.destroy(); first.destroy(); second.destroy();
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
  child = launch();
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/api/collaboration-health`)).ok; } catch { return false; } });
  restored = new Y.Doc();
  a = new WebsocketProvider(`ws://127.0.0.1:${port}/collaboration`, room, restored, { WebSocketPolyfill: TestSocket, disableBc: true });
  await until(() => a.synced);
  if (JSON.parse(restored.getMap('meta').get('background')).fillStyle !== 'crosshatch' || restored.getMap('elements').get('smoke-image')?.type !== 'image') throw new Error('Paint image/background lost after restart');
  if (restored.getText('notes').toString() !== 'Same-origin sharing works') throw new Error('Local room content was lost after restarting');
  console.log('PASS: local mode overrides hosted settings, home, manifest/icons, durable room creation, two-client sync, classroom signaling and room persistence across server restart');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { a?.destroy(); b?.destroy(); restored?.destroy(); call?.close(); child.kill('SIGTERM'); }
