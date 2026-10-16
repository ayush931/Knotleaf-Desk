import { test, expect } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
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
  const service = createCollaborationServer({ port: 0, directory });
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
