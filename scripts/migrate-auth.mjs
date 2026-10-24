import { createDeskAuth } from '../server/auth.mjs';
if (process.loadEnvFile) { try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const instance = process.env.DATABASE_URL ? await createDeskAuth() : await (await import('../server/auth-local.mjs')).createLocalDeskAuth();
try { await instance.migrate(); console.log('Authentication schema is ready.'); } finally { await instance.close(); }
