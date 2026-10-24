import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';

export function authConfiguration(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const baseURL = env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || (!production ? 'http://localhost:3000' : '');
  let validURL = false;
  try { const url = new URL(baseURL); validURL = url.origin === baseURL && (url.protocol === 'https:' || (!production && url.protocol === 'http:')); } catch {}
  const enabled = validURL && (!production || (!!env.DATABASE_URL && (env.BETTER_AUTH_SECRET?.length || 0) >= 32));
  return { enabled, baseURL, google: enabled && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET };
}

export function createConfiguredDeskAuth(env, database, secret, close) {
  const config = authConfiguration(env);
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
  const auth = betterAuth(options);
  return { auth, migrate, close };
}