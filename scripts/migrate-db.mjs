import {postgresOptions} from '../server/postgres.mjs';
import fs from 'node:fs/promises';
import pg from 'pg';
if (process.loadEnvFile) { try { process.loadEnvFile('.env'); } catch {} }
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your self-hosted PostgreSQL connection string. Disk-only mode needs no migration.');
const pool = new pg.Pool(postgresOptions(process.env.DATABASE_URL));
try { await pool.query(await fs.readFile(new URL('../database/001_rooms.sql',import.meta.url),'utf8')); console.log('PostgreSQL room schema is ready.'); } finally { await pool.end(); }
