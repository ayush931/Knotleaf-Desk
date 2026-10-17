import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {postgresOptions} from './postgres.mjs';
import { roomExpiresAt } from '../lib/roomExpiry.mjs';
export const validRoomId = id => typeof id === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id);
export function createRoomStore(url = process.env.DATABASE_URL, directory = process.env.COLLAB_DATA_DIR || path.resolve('.collab-data')) {
  const removeFiles = id => {
    if (!validRoomId(id)) throw new Error('Invalid room ID');
    for (const suffix of ['.json', '.json.tmp', '.bin', '.bin.tmp']) fs.rmSync(path.join(directory, id + suffix), { force: true });
  };
  if (!url) {
    fs.mkdirSync(directory, { recursive: true });
    const filename = id => { if (!validRoomId(id)) throw new Error('Invalid room ID'); return path.join(directory, `${id}.json`); };
    const write = (id, record) => { const file = filename(id); fs.writeFileSync(file + '.tmp', JSON.stringify(record), { mode: 0o600 }); fs.renameSync(file + '.tmp', file); };
    return {
      async create(id, title, state, snapshot, shareUrl = null, createdAt = Date.now()) { if (fs.existsSync(filename(id))) return; write(id, { id, title, sharePath: `/canvas/${id}`, shareUrl, state, snapshot, createdAt: new Date(createdAt).toISOString(), updatedAt: new Date().toISOString() }); },
      async load(id) {
        let record;
        try { record = JSON.parse(fs.readFileSync(filename(id), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        const expiresAt = roomExpiresAt(record.createdAt);
        if (expiresAt <= Date.now()) { removeFiles(id); return null; }
        return { ...record, expiresAt: new Date(expiresAt).toISOString() };
      },
      async save(id, state, snapshot) { const record = await this.load(id); if (!record) throw new Error('Room does not exist'); write(id, { ...record, state, snapshot, title: snapshot.title, updatedAt: new Date().toISOString() }); },
      async purgeExpired() {
        const deleted = [];
        for (const file of fs.readdirSync(directory)) {
          const id = file.replace(/\.json$/, '');
          if (!file.endsWith('.json') || !validRoomId(id)) continue;
          if (!await this.load(id)) deleted.push(id);
        }
        return deleted;
      },
      async close() {},
    };
  }
  const pool = new pg.Pool(postgresOptions(url));
  // Self-hosted Postgres initializes its idempotent schema without a SaaS migration service.
  let ready;
  const query = async (text, values) => { ready ||= pool.query(fs.readFileSync(new URL('../database/001_rooms.sql', import.meta.url), 'utf8')).catch(error => { ready = undefined; throw error; }); await ready; return pool.query(text, values); };
  return {
    async create(id, title, state, snapshot, shareUrl = null, createdAt = Date.now()) { if (!validRoomId(id)) throw new Error('Invalid room ID'); await query('INSERT INTO knotleaf_rooms (id,title,share_path,share_url,state_base64,snapshot,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING', [id, title.slice(0,200), `/canvas/${id}`, shareUrl, state, JSON.stringify(snapshot),new Date(createdAt)]); },
    async load(id) {
      const { rows: expired } = await query("DELETE FROM knotleaf_rooms WHERE id=$1 AND created_at <= now() - interval '24 hours' RETURNING id", [id]);
      for (const row of expired) removeFiles(row.id);
      const { rows } = await query("SELECT state_base64 AS state, created_at + interval '24 hours' AS \"expiresAt\" FROM knotleaf_rooms WHERE id=$1 AND created_at > now() - interval '24 hours'", [id]);
      return rows[0] || null;
    },
    async save(id, state, snapshot) { const result = await query("UPDATE knotleaf_rooms SET state_base64=$2,snapshot=$3,title=$4,updated_at=now() WHERE id=$1 AND created_at > now() - interval '24 hours'", [id,state,JSON.stringify(snapshot),String(snapshot.title || 'Shared whiteboard').slice(0,200)]); if (!result.rowCount) throw new Error('Room does not exist or has expired'); },
    async purgeExpired() {
      const { rows } = await query("DELETE FROM knotleaf_rooms WHERE created_at <= now() - interval '24 hours' RETURNING id");
      for (const row of rows) removeFiles(row.id);
      return rows.map(row => row.id);
    },
    close: () => pool.end(),
  };
}
