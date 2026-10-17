import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { isValidElement } from '../lib/elementValidation.mjs';
import { ROOM_LIFETIME_MS } from '../lib/roomExpiry.mjs';
import { validRoomId } from './database.mjs';
export async function createStoredRoom(store, board, base) {
  if (!board || typeof board.title !== 'string' || (board.markdownNotes !== undefined && typeof board.markdownNotes !== 'string') || !Array.isArray(board.elements) || !board.elements.every(isValidElement)) throw new Error('Invalid board content');
  board = { ...board, markdownNotes: board.markdownNotes ?? '' };
  const id = randomUUID(), title = `${board.title.slice(0,185)} · shared`, doc = new Y.Doc();
  const createdAt = Date.now(), expiresAt = new Date(createdAt + ROOM_LIFETIME_MS).toISOString();
  try {
    doc.getMap('meta').set('initialized','true'); doc.getMap('meta').set('title',title);
    doc.getMap('meta').set('expiresAt', expiresAt);
    for (const el of board.elements) { if (el.type === 'text' && el.isCodeCard) { doc.getText(`code:${el.id}`).insert(0,el.text); doc.getMap('elements').set(el.id,{...el,text:''}); } else doc.getMap('elements').set(el.id,el); }
    doc.getText('notes').insert(0,board.markdownNotes);
    await store.create(id,title,Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),{title,elements:board.elements,markdownNotes:board.markdownNotes},`${base.replace(/\/$/,'')}/canvas/${id}`,createdAt);
  } finally { doc.destroy(); }
  return { id,title,persistent:true,path:`/canvas/${id}`,expiresAt };
}
export function handleRoomHttp(request, response, { store, origins, appUrl, cleanupExpired }) {
  const pathname = new URL(request.url,'http://localhost').pathname;
  const roomId = pathname.startsWith('/api/rooms/') ? pathname.slice('/api/rooms/'.length) : null;
  const statusRead = request.method === 'GET' && validRoomId(roomId);
  if (!statusRead && !['/api/rooms', '/api/rooms/cleanup'].includes(pathname)) return false;
  const origin = request.headers.origin, host = request.headers.host;
  const allowed = statusRead && !origin || !!origin && (origins.length ? origins.includes(origin) : [ `http://${host}`, `https://${host}` ].includes(origin));
  const reply = (status, data) => { response.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', ...(allowed && origin ? { 'Access-Control-Allow-Origin':origin, Vary:'Origin' } : {}) }); response.end(JSON.stringify(data)); };
  if (!allowed) { reply(403,{error:'Create rooms from an allowed website.'}); return true; }
  if (statusRead) {
    void (async () => { try { const room = await store.load(roomId); reply(room ? 200 : 410, room ? { expiresAt: room.expiresAt } : { error: 'This room expired or no longer exists.' }); } catch { reply(503, { error: 'Could not check the room. Retry shortly.' }); } })();
    return true;
  }
  if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Methods','POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers','Content-Type'); reply(204,{}); return true; }
  if (request.method !== 'POST') { reply(405,{error:'Use POST to create a room.'}); return true; }
  if (pathname === '/api/rooms/cleanup') {
    void (async () => { try { const deleted = cleanupExpired ? await cleanupExpired() : (await store.purgeExpired()).length; reply(200, { deleted, lifetimeHours: 24 }); } catch { reply(503, { error: 'Room expiry cleanup failed; retry shortly.' }); } })();
    return true;
  }
  void (async () => {
    try {
      let size=0; const chunks=[];
      for await (const chunk of request) { size+=chunk.length; if (size>6_000_000) { reply(413,{error:'Board is too large to share.'}); return; } chunks.push(chunk); }
      let board; try { board=JSON.parse(Buffer.concat(chunks).toString()); } catch { reply(400,{error:'Invalid board content.'}); return; }
      if (!board || typeof board.title!=='string' || (board.markdownNotes!==undefined && typeof board.markdownNotes!=='string') || !Array.isArray(board.elements) || !board.elements.every(isValidElement)) { reply(400,{error:'Invalid board content.'}); return; }
      reply(201,await createStoredRoom(store,board,appUrl || origin));
    } catch { reply(503,{error:'Room could not be saved. Check the room server storage and retry.'}); }
  })();
  return true;
}
