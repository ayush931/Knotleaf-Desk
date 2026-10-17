import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {postgresOptions} from './postgres.mjs';
export const validRoomId = id => typeof id === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id);
export function createRoomStore(url = process.env.DATABASE_URL, directory = process.env.COLLAB_DATA_DIR || path.resolve('.collab-data')) {
  if (!url) {
    fs.mkdirSync(directory, { recursive: true });
    const filename = id => { if (!validRoomId(id)) throw new Error('Invalid room ID'); return path.join(directory, `${id}.json`); };
    const write = (id, record) => { const file = filename(id); fs.writeFileSync(file + '.tmp', JSON.stringify(record), { mode: 0o600 }); fs.renameSync(file + '.tmp', file); };
    return {
      async create(id, title, state, snapshot, shareUrl = null) { if (fs.existsSync(filename(id))) return; write(id, { id, title, sharePath: `/canvas/${id}`, shareUrl, state, snapshot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); },
      async load(id) { try { return JSON.parse(fs.readFileSync(filename(id), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
      async save(id, state, snapshot) { const record = await this.load(id); if (!record) throw new Error('Room does not exist'); write(id, { ...record, state, snapshot, title: snapshot.title, updatedAt: new Date().toISOString() }); },
      async close() {},
    };
  }
  const pool = new pg.Pool(postgresOptions(url));
  // Self-hosted Postgres initializes its idempotent schema without a SaaS migration service.
  let ready;
  const query = async (text, values) => { ready ||= pool.query(fs.readFileSync(new URL('../database/001_rooms.sql', import.meta.url), 'utf8')).catch(error => { ready = undefined; throw error; }); await ready; return pool.query(text, values); };
  return {
    async create(id, title, state, snapshot, shareUrl = null) { if (!validRoomId(id)) throw new Error('Invalid room ID'); await query('INSERT INTO knotleaf_rooms (id,title,share_path,share_url,state_base64,snapshot) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [id, title.slice(0,200), `/canvas/${id}`, shareUrl, state, JSON.stringify(snapshot)]); },
    async load(id) { const { rows } = await query('SELECT state_base64 AS state FROM knotleaf_rooms WHERE id=$1', [id]); return rows[0] || null; },
    async save(id, state, snapshot) { await query('UPDATE knotleaf_rooms SET state_base64=$2,snapshot=$3,title=$4,updated_at=now() WHERE id=$1', [id,state,JSON.stringify(snapshot),String(snapshot.title || 'Shared whiteboard').slice(0,200)]); },
    close: () => pool.end(),
  };
}
