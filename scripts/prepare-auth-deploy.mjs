import { authConfiguration, createDeskAuth } from '../server/auth.mjs';

// Vercel provides these values to the build. Never read or copy local account files.
const env = { ...process.env, NODE_ENV: 'production' };
const requested = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].some(key => !!env[key]?.trim());
if (!requested) {
  console.log('Accounts are not configured; skipping account schema setup.');
} else if (!authConfiguration(env).enabled) {
  console.error('Account deployment requires DATABASE_URL, a valid HTTPS BETTER_AUTH_URL, and a 32+ character BETTER_AUTH_SECRET.');
  process.exitCode = 1;
} else {
  let instance;
  try {
    instance = await createDeskAuth(env);
    await instance.migrate();
    console.log('Production account schema is ready.');
  } catch {
    console.error('Account schema setup failed. Check database connectivity, TLS and schema permissions before redeploying.');
    process.exitCode = 1;
  } finally { await instance?.close(); }
}
