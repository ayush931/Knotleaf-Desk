import { beforeEach, afterEach, test, expect } from 'bun:test';
import { getRoomServerUrl, roomInviteUrl, checkRoomAvailable, RoomExpiredError, rememberCreatedRoom, resetRoomConnectionCache } from '../lib/roomConnection.ts';
import { createRoomFromBoard } from '../lib/roomCreation.ts';
import { createBoard, getBoard, getOrCreateDefaultBoard } from '../lib/storage.ts';
const originals = new Map();
let records;
beforeEach(() => {
  resetRoomConnectionCache();
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

test('creating a room keeps local assets in this browser and out of the HTTP body',async()=>{
 const board=createBoard('Private assets'),id=crypto.randomUUID();
 const asset={id:'private',type:'image',localOnly:true,source:'SECRET ORIGINAL BYTES'};board.elements=[asset];
 globalThis.fetch=async(_url,options)=>{expect(options.body).not.toContain('SECRET');expect(JSON.parse(options.body).elements).toEqual([]);return Response.json({id,title:'Shared'},{status:201});};
 await createRoomFromBoard(board);expect(getBoard(id).elements).toEqual([asset]);
});

test('concurrent configuration lookups share one request and failures are retryable',async()=>{
 let requests=0,finish;globalThis.fetch=async()=>{requests++;return new Promise(resolve=>finish=resolve);};
 const first=getRoomServerUrl(),second=getRoomServerUrl();expect(requests).toBe(1);finish(Response.json({collaboration:true,websocketUrl:'/collaboration'}));
 expect(await first).toBe(await second);await getRoomServerUrl();expect(requests).toBe(1);
 resetRoomConnectionCache();globalThis.fetch=async()=>{requests++;throw new Error('Offline');};await expect(getRoomServerUrl()).rejects.toThrow('Offline');
 globalThis.fetch=async()=>Response.json({collaboration:true,websocketUrl:'/collaboration'});expect(await getRoomServerUrl()).toContain('/collaboration');
});
test('a durable creation skips immediate redundant room checks but expired confirmations do not',async()=>{
 const id=crypto.randomUUID();let requests=0;globalThis.fetch=async()=>{requests++;return new Response(null,{status:200});};
 rememberCreatedRoom(id,new Date(Date.now()+86400000).toISOString());await checkRoomAvailable('ws://localhost:3000/collaboration',id);expect(requests).toBe(0);
 rememberCreatedRoom(id,new Date(Date.now()-1000).toISOString());await checkRoomAvailable('ws://localhost:3000/collaboration',id);expect(requests).toBe(1);
});
test('creation primes runtime configuration without sending local view settings',async()=>{
 const board=createBoard('Fast room'),id=crypto.randomUUID();let requests=0;
 globalThis.fetch=async(_url,options)=>{requests++;const body=JSON.parse(options.body);expect(body.id).toBeUndefined();expect(body.viewMode).toBeUndefined();return Response.json({id,title:'Fast room',websocketUrl:'/collaboration',expiresAt:new Date(Date.now()+86400000).toISOString()},{status:201});};
 await createRoomFromBoard(board);expect(await getRoomServerUrl()).toBe('ws://localhost:3000/collaboration');await checkRoomAvailable('ws://localhost:3000/collaboration',id);expect(requests).toBe(1);
});

test('opening sharing warms once without creating a room and allows retry after failure',async()=>{
 const {warmRoomServer}=await import('../lib/roomCreation.ts');window.location.origin='https://warm.example';let requests=0,finish;
 globalThis.fetch=async(_url,options)=>{requests++;expect(JSON.parse(options.body)).toEqual({warmup:true});return new Promise(resolve=>finish=resolve);};
 const first=warmRoomServer(),second=warmRoomServer();expect(first).toBe(second);expect(requests).toBe(1);finish(Response.json({ready:true,websocketUrl:'/collaboration'}));await first;await warmRoomServer();expect(requests).toBe(1);expect(await getRoomServerUrl()).toBe('wss://warm.example/collaboration');
 window.location.origin='https://failed-warm.example';globalThis.fetch=async()=>{requests++;throw new Error('Sleeping');};await warmRoomServer();await warmRoomServer();expect(requests).toBe(3);
});

test('cancelling one configuration caller does not cancel another caller sharing its request',async()=>{
 let finish;globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
 const controller=new AbortController(),first=getRoomServerUrl(controller.signal),second=getRoomServerUrl();controller.abort(new Error('Closed panel'));
 await expect(first).rejects.toThrow('Closed panel');finish(Response.json({collaboration:true,websocketUrl:'/collaboration'}));expect(await second).toBe('ws://localhost:3000/collaboration');
});

test('background warmup waits for idle, is cancellable and sends no board data', async () => {
 const { scheduleRoomWarmup } = await import('../lib/roomCreation.ts');
 window.location.origin = 'https://idle-warm.example';
 let idle, cancelled, calls = 0;
 window.requestIdleCallback = (callback, options) => { idle = callback; expect(options.timeout).toBe(1000); return 7; };
 window.cancelIdleCallback = id => { cancelled = id; };
 globalThis.fetch = async (_url, options) => { calls++; expect(JSON.parse(options.body)).toEqual({ warmup: true }); return Response.json({ ready: true }); };
 const cancel = scheduleRoomWarmup(); expect(calls).toBe(0); cancel(); expect(cancelled).toBe(7);
 scheduleRoomWarmup(); idle(); await Promise.resolve(); expect(calls).toBe(1);
});

test('background warmup has a cancellable fallback when idle callbacks are unavailable', async () => {
 const { scheduleRoomWarmup } = await import('../lib/roomCreation.ts');
 let delay, cancelled;
 window.setTimeout = (_callback, milliseconds) => { delay = milliseconds; return 8; };
 window.clearTimeout = id => { cancelled = id; };
 const cancel = scheduleRoomWarmup(); expect(delay).toBe(1000); cancel(); expect(cancelled).toBe(8);
});

test('a slow warmup stays single-flight and never blocks a real creation request', async () => {
 const { warmRoomServer } = await import('../lib/roomCreation.ts');
 window.location.origin = 'https://slow-warm.example';
 const originalNow = Date.now, now = originalNow(), id = crypto.randomUUID();
 let finish, requests = 0;
 globalThis.fetch = async (_url, options) => {
  requests++;
  if (JSON.parse(options.body).warmup) return new Promise(resolve => finish = resolve);
  return Response.json({ id, title: 'Ready', expiresAt: new Date(now + 86400000).toISOString() }, { status: 201 });
 };
 try {
  const pending = warmRoomServer();
  Date.now = () => now + 61000;
  expect(warmRoomServer()).toBe(pending); expect(requests).toBe(1);
  expect((await createRoomFromBoard(createBoard('Fast'))).id).toBe(id); expect(requests).toBe(2);
  finish(Response.json({ ready: true })); await pending;
  await warmRoomServer(); expect(requests).toBe(2);
 } finally { Date.now = originalNow; }
});

test('short invites require no network call or shortening service',async()=>{
 const {shortRoomCode}=await import('../lib/shortRoomCode.ts');const id=crypto.randomUUID();
 globalThis.fetch=async()=>{throw new Error('Shortening must work offline');};
 expect(roomInviteUrl(id)).toBe(`http://localhost:3000/r/${shortRoomCode(id)}`);
 expect(roomInviteUrl(id,true)).toBe(`http://localhost:3000/v/${shortRoomCode(id)}`);
});
test('frontend storage warmup starts the video host independently and never delays creation',async()=>{
 const {warmRoomServer}=await import('../lib/roomCreation.ts');window.location.origin='https://direct-store.example';
 const calls=[];let finishWake;const id=crypto.randomUUID();
 globalThis.fetch=async(url,options)=>{
  calls.push(String(url));const body=JSON.parse(options.body);
  if(String(url).startsWith('https://rooms.example/'))return new Promise(resolve=>{finishWake=resolve;});
  return body.warmup?Response.json({ready:true,websocketUrl:'wss://rooms.example/collaboration',wakeRoomServer:true}):Response.json({id,title:'Fast call',websocketUrl:'wss://rooms.example/collaboration'},{status:201});
 };
 await warmRoomServer();expect(calls).toEqual(['/api/rooms','https://rooms.example/api/rooms']);
 const created=await createRoomFromBoard(createBoard('Fast'));expect(created.id).toBe(id);expect(calls).toHaveLength(3);
 finishWake(new Response(null,{status:200}));
});

test('creation wakes a sleeping host without awaiting it even if background preparation has not run',async()=>{
 window.location.origin='https://creation-wake.example';let wakeRequests=0,finish;const id=crypto.randomUUID();
 globalThis.fetch=async(url)=>{
  if(String(url).startsWith('https://sleeping.example/')){wakeRequests++;return new Promise(resolve=>finish=resolve);}
  return Response.json({id,title:'Ready link',websocketUrl:'wss://sleeping.example/collaboration',wakeRoomServer:true},{status:201});
 };
 const room=await createRoomFromBoard(createBoard('Create immediately'));expect(room.id).toBe(id);expect(wakeRequests).toBe(1);
 await createRoomFromBoard(createBoard('Next call'));expect(wakeRequests).toBe(1);
 finish(new Response(null,{status:200}));
});
