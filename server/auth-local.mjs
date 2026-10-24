// Loaded only by the integrated development server and local migration/test scripts.
// Keep this module out of the Next.js route import graph.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authConfiguration, createConfiguredDeskAuth } from './auth-options.mjs';

export async function createLocalDeskAuth(env = process.env) {
  if (env.NODE_ENV === 'production' || !authConfiguration(env).enabled) throw new Error('Local account storage is available only in development.');
  const directory = path.resolve(env.AUTH_DATA_DIR || '.auth-data');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  let secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    const filename = path.join(directory, 'secret');
    try { secret = readFileSync(filename, 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { writeFileSync(filename, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' }); } catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
      secret = readFileSync(filename, 'utf8');
    }
  }
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(path.join(directory, 'accounts.sqlite'));
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const instance = createConfiguredDeskAuth(env, database, secret, async () => database.close());
  try { await instance.migrate(); } catch (error) { await instance.close(); throw error; }
  return instance;
}
