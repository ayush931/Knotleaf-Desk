import { createDeskAuth } from '../server/auth.mjs';
if (process.loadEnvFile) { try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const instance = await createDeskAuth();
try { await instance.migrate(); console.log('Authentication schema is ready.'); } finally { await instance.close(); }
