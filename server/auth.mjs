import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { postgresOptions } from './postgres.mjs';

export function authConfiguration(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const baseURL = env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || (!production ? 'http://localhost:3000' : '');
  let validURL = false;
  try { const url = new URL(baseURL); validURL = url.origin === baseURL && (url.protocol === 'https:' || (!production && url.protocol === 'http:')); } catch {}
  const enabled = validURL && (!production || (!!env.DATABASE_URL && (env.BETTER_AUTH_SECRET?.length || 0) >= 32));
  return { enabled, baseURL, google: enabled && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET };
}

// Initialized on the first auth request, never while Next builds static pages.
export async function createDeskAuth(env = process.env) {
  const config = authConfiguration(env);
  if (!config.enabled) throw new Error('Authentication is not configured.');
  let database, close;
  let secret = env.BETTER_AUTH_SECRET;
  if (env.DATABASE_URL) {
    database = new pg.Pool(postgresOptions(env.DATABASE_URL));
    close = () => database.end();
  } else {
    // Local development only. Hosted/serverless auth always requires durable PostgreSQL.
    const directory = path.resolve(env.AUTH_DATA_DIR || '.auth-data');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!secret) {
      const filename = path.join(directory, 'secret');
      try { secret = readFileSync(filename, 'utf8'); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        try { writeFileSync(filename, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' }); } catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
        secret = readFileSync(filename, 'utf8');
      }
    }
    const { DatabaseSync } = await import('node:sqlite');
    database = new DatabaseSync(path.join(directory, 'accounts.sqlite'));
    database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    close = async () => database.close();
  }
  const options = {
    appName: 'Knotleaf Desk',
    baseURL: config.baseURL,
    secret,
    database,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    socialProviders: config.google ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : {},
    // An unverified password account must never silently merge with Google identity.
    account: { modelName: 'knotleaf_auth_account', accountLinking: { enabled: false } },
    user: { modelName: 'knotleaf_auth_user' },
    session: { modelName: 'knotleaf_auth_session', expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    verification: { modelName: 'knotleaf_auth_verification' },
    rateLimit: { enabled: true, storage: 'database', modelName: 'knotleaf_auth_rate_limit', window: 60, max: 60, customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/sign-in/social': { window: 60, max: 5 },
    } },
  };
  const migrate = async () => { const { runMigrations } = await getMigrations(options); await runMigrations(); };
  try { if (!env.DATABASE_URL) await migrate(); } catch (error) { await close(); throw error; }
  const auth = betterAuth(options);
  return { auth, migrate, close };
}
let instance;
export function getDeskAuth() {
  instance ||= createDeskAuth().catch(error => { instance = undefined; throw error; });
  return instance;
}
