import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { isValidElement } from '../lib/elementValidation.mjs';
export async function createStoredRoom(store, board, base) {
  if (!board || typeof board.title !== 'string' || typeof board.markdownNotes !== 'string' || !Array.isArray(board.elements) || !board.elements.every(isValidElement)) throw new Error('Invalid board content');
  const id = randomUUID(), title = `${board.title.slice(0,185)} · shared`, doc = new Y.Doc();
  try {
    doc.getMap('meta').set('initialized','true'); doc.getMap('meta').set('title',title);
    for (const el of board.elements) { if (el.type === 'text' && el.isCodeCard) { doc.getText(`code:${el.id}`).insert(0,el.text); doc.getMap('elements').set(el.id,{...el,text:''}); } else doc.getMap('elements').set(el.id,el); }
    doc.getText('notes').insert(0,board.markdownNotes);
    await store.create(id,title,Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),{title,elements:board.elements,markdownNotes:board.markdownNotes},`${base.replace(/\/$/,'')}/canvas/${id}`);
  } finally { doc.destroy(); }
  return { id,title,persistent:true,path:`/canvas/${id}` };
}
export function handleRoomHttp(request, response, { store, origins, appUrl }) {
  if (new URL(request.url,'http://localhost').pathname !== '/api/rooms') return false;
  const origin = request.headers.origin, host = request.headers.host;
  const allowed = !!origin && (origins.length ? origins.includes(origin) : [ `http://${host}`, `https://${host}` ].includes(origin));
  const reply = (status, data) => { response.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', ...(allowed ? { 'Access-Control-Allow-Origin':origin, Vary:'Origin' } : {}) }); response.end(JSON.stringify(data)); };
  if (!allowed) { reply(403,{error:'Create rooms from an allowed website.'}); return true; }
  if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Methods','POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers','Content-Type'); reply(204,{}); return true; }
  if (request.method !== 'POST') { reply(405,{error:'Use POST to create a room.'}); return true; }
  void (async () => {
    try {
      let size=0; const chunks=[];
      for await (const chunk of request) { size+=chunk.length; if (size>6_000_000) { reply(413,{error:'Board is too large to share.'}); return; } chunks.push(chunk); }
      let board; try { board=JSON.parse(Buffer.concat(chunks).toString()); } catch { reply(400,{error:'Invalid board content.'}); return; }
      if (!board || typeof board.title!=='string' || typeof board.markdownNotes!=='string' || !Array.isArray(board.elements) || !board.elements.every(isValidElement)) { reply(400,{error:'Invalid board content.'}); return; }
      reply(201,await createStoredRoom(store,board,appUrl || origin));
    } catch { reply(503,{error:'Room could not be saved. Check the room server storage and retry.'}); }
  })();
  return true;
}
