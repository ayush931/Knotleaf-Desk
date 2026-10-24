import pg from 'pg';
import { postgresOptions } from './postgres.mjs';
import { authConfiguration, createConfiguredDeskAuth } from './auth-options.mjs';
export { authConfiguration } from './auth-options.mjs';

// Hosted routes depend only on PostgreSQL. Never import the local filesystem backend here.
export async function createDeskAuth(env = process.env) {
  if (!authConfiguration(env).enabled || !env.DATABASE_URL) throw new Error('Authentication is not configured.');
  const database = new pg.Pool(postgresOptions(env.DATABASE_URL));
  return createConfiguredDeskAuth(env, database, env.BETTER_AUTH_SECRET, () => database.end());
}
let instance;
export function getDeskAuth() {
  instance ||= Promise.resolve().then(() => {
    if (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL) {
      const localFactory = globalThis[Symbol.for('knotleaf.localAuthFactory')];
      if (localFactory) return localFactory();
      throw new Error('Local account authentication requires the integrated development server.');
    }
    return createDeskAuth();
  }).catch(error => { instance = undefined; throw error; });
  return instance;
}
