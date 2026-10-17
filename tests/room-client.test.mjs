import { beforeEach, afterEach, test, expect } from 'bun:test';
import { getRoomServerUrl, roomInviteUrl, checkRoomAvailable, RoomExpiredError } from '../lib/roomConnection.ts';
import { createRoomFromBoard } from '../lib/roomCreation.ts';
import { createBoard, getBoard, getOrCreateDefaultBoard } from '../lib/storage.ts';
const originals = new Map();
let records;
beforeEach(() => {
  records = new Map();
  for (const [key, value] of Object.entries({ window: { location: { origin: 'http://localhost:3000' } }, localStorage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) } })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  originals.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
});
afterEach(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } originals.clear(); });
test('runtime configuration selects the local hub rather than a baked hosted endpoint', async () => {
  globalThis.fetch = async () => Response.json({ collaboration: true, websocketUrl: '/collaboration' });
  expect(await getRoomServerUrl()).toBe('ws://localhost:3000/collaboration');
  expect(roomInviteUrl('room')).toBe('http://localhost:3000/canvas/room');
  expect(roomInviteUrl('room', true)).toBe('http://localhost:3000/canvas/room?classroom=1');
});
test('the production frontend connects to its runtime configured external hub over WSS', async () => {
  window.location.origin = 'https://desk.example';
  globalThis.fetch = async () => Response.json({ collaboration: true, websocketUrl: 'wss://rooms.example/collaboration' });
  expect(await getRoomServerUrl()).toBe('wss://rooms.example/collaboration');
  expect(roomInviteUrl('room')).toBe('https://desk.example/canvas/room');
});
test('unavailable or invalid room configuration reports an error', async () => {
  globalThis.fetch = async () => Response.json({ collaboration: false, message: 'Configure your room host.' });
  await expect(getRoomServerUrl()).rejects.toThrow('Configure your room host.');
  globalThis.fetch = async () => Response.json({ collaboration: true, websocketUrl: 'file:///tmp/room' });
  await expect(getRoomServerUrl()).rejects.toThrow('invalid');
});
test('expired invite links report a terminal expiry rather than reconnecting forever', async () => {
  globalThis.fetch = async url => { expect(url.toString()).toContain('https://rooms.example/api/rooms/'); return Response.json({ error: 'Expired' }, { status: 410 }); };
  await expect(checkRoomAvailable('wss://rooms.example/collaboration', crypto.randomUUID())).rejects.toBeInstanceOf(RoomExpiredError);
});
test('creating a shared copy preserves the personal board and normalizes legacy notes', async () => {
  const board = createBoard('Personal'), id = crypto.randomUUID();
  delete board.markdownNotes;
  globalThis.fetch = async (_url, options) => {
    expect(JSON.parse(options.body).markdownNotes).toBe('');
    return Response.json({ id, title: 'Personal · shared' }, { status: 201 });
  };
  expect(await createRoomFromBoard(board)).toEqual({ id, savedLocally: true });
  expect(getBoard(board.id).title).toBe('Personal'); expect(getBoard(id).title).toBe('Personal · shared');
  expect(getOrCreateDefaultBoard().id).toBe(board.id);
});
test('creation errors and malformed successful responses never create bogus local rooms', async () => {
  const board = createBoard('Personal'), before = new Map(records);
  globalThis.fetch = async () => new Response('<html>Host waking up</html>', { status: 503 });
  await expect(createRoomFromBoard(board)).rejects.toThrow('unavailable');
  globalThis.fetch = async () => Response.json({ title: 'Missing invite' }, { status: 201 });
  await expect(createRoomFromBoard(board)).rejects.toThrow('invalid invite');
  expect(records).toEqual(before);
});
test('a browser storage quota failure does not invalidate a room saved on the server', async () => {
  const board = createBoard('Personal'), id = crypto.randomUUID();
  globalThis.fetch = async () => Response.json({ id, title: 'Shared' }, { status: 201 });
  localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  expect(await createRoomFromBoard(board)).toEqual({ id, savedLocally: false });
  expect(getBoard(board.id).title).toBe('Personal');
});
