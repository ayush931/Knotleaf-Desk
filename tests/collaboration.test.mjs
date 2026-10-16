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

test('application room sessions seed once, preserve attachments, reconnect edits and undo locally', async () => {
  const { RoomSession } = await import('../lib/collaboration.ts');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'whiteboard-session-'));
  const service = createCollaborationServer({ port: 0, directory }); const address = await service.listen();
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
  const service = createCollaborationServer({ port: 0, directory }); const address = await service.listen();
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
