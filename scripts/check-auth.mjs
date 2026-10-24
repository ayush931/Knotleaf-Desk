import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDeskAuth, authConfiguration } from '../server/auth.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'knotleaf-auth-'));
const env = { NODE_ENV: 'test', AUTH_DATA_DIR: directory, BETTER_AUTH_URL: 'http://localhost:3000', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' };
let instance;
try {
  assert.equal(authConfiguration({ NODE_ENV: 'production' }).enabled, false);
  assert.equal(authConfiguration({ NODE_ENV: 'production', DATABASE_URL: 'postgres://example', BETTER_AUTH_URL: 'http://example.com', BETTER_AUTH_SECRET: 'x'.repeat(48) }).enabled, false);
  instance = await createDeskAuth(env);
  const request = (endpoint, body, cookie, origin = env.BETTER_AUTH_URL) => instance.auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth/${endpoint}`, {
    method: body ? 'POST' : 'GET', headers: { Origin: origin, 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  const credentials = { name: 'Test Person', email: 'person@example.com', password: 'a long test passphrase' };
  assert.equal((await request('get-session')).status, 200);
  assert.equal(await (await request('get-session')).json(), null);
  assert.equal((await request('sign-up/email', { ...credentials, password: 'short' })).status, 400);
  assert.equal((await request('sign-up/email', credentials, undefined, 'https://evil.example')).status, 403);
  const signup = await request('sign-up/email', credentials);
  assert.equal(signup.status, 200, await signup.clone().text());
  const cookies = signup.headers.getSetCookie();
  assert.ok(cookies.some(cookie => /httponly/i.test(cookie) && /samesite=lax/i.test(cookie)));
  const cookie = cookies.map(value => value.split(';')[0]).join('; ');
  const publicUser = await signup.json();
  assert.equal(publicUser.user.email, credentials.email);
  assert.ok(!JSON.stringify(publicUser).includes('password'));
  const session = await (await request('get-session', undefined, cookie)).json();
  assert.equal(session.user.email, credentials.email);
  const wrong = await request('sign-in/email', { email: credentials.email, password: 'incorrect passphrase' });
  assert.equal(wrong.status, 401);
  const missing = await request('sign-in/email', { email: 'missing@example.com', password: 'incorrect passphrase' });
  assert.equal(missing.status, 401);
  assert.equal((await wrong.json()).message, (await missing.json()).message);
  const signin = await request('sign-in/email', credentials);
  assert.equal(signin.status, 200);
  const persistedCookie = signin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.equal((await request('sign-out', {}, cookie)).status, 200);
  assert.equal(await (await request('get-session', undefined, cookie)).json(), null);
  const social = await request('sign-in/social', { provider: 'google', callbackURL: '/canvas/board?call=1', errorCallbackURL: '/?auth_error=google', disableRedirect: true });
  assert.equal(social.status, 200, await social.clone().text());
  const redirect = new URL((await social.json()).url);
  assert.equal(redirect.origin, 'https://accounts.google.com');
  assert.equal(redirect.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/callback/google');
  assert.ok(redirect.searchParams.get('state'));
  assert.ok(redirect.searchParams.get('code_challenge'));
  assert.equal((await request('sign-in/social', { provider: 'google', callbackURL: 'https://evil.example', disableRedirect: true })).status, 403);
  // Enforced in development as well as production.
  let throttled = false;
  for (let i = 0; i < 6; i++) if ((await request('sign-in/email', { email: credentials.email, password: 'wrong password' })).status === 429) throttled = true;
  assert.ok(throttled);
  await instance.close();
  instance = await createDeskAuth(env);
  const again = await request('sign-in/email', credentials);
  // Rate limits, accounts and secrets persist across restarts.
  assert.equal(again.status, 429);
  assert.equal((await (await request('get-session', undefined, persistedCookie)).json()).user.email, credentials.email);
  const contents = await readFile(path.join(directory, 'accounts.sqlite'));
  assert.ok(!contents.includes(Buffer.from(credentials.password)));
  console.log('Auth checks passed: signup, validation, origin protection, credential errors, session/revocation, Google state/PKCE/return URL, durable rate limits and password hashing.');
} finally {
  await instance?.close();
  await rm(directory, { recursive: true, force: true });
}
