import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDeskAuth } from '../server/auth.mjs';
import { authFailureCode } from '../server/auth-errors.mjs';

test('production auth fails closed without a database and never creates local storage', async () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'knotleaf-hosted-auth-'));
  const directory = path.join(parent, 'must-not-exist');
  try {
    await expect(createDeskAuth({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://desk.example', BETTER_AUTH_SECRET: 'test-secret-'.repeat(5), AUTH_DATA_DIR: directory })).rejects.toThrow('not configured');
    expect(existsSync(directory)).toBe(false);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test('auth failure diagnostics distinguish database/schema problems without exposing error text', () => {
  expect(authFailureCode({ cause: { code: '42P01', message: 'sensitive database detail' } })).toBe('AUTH_SCHEMA_NOT_READY');
  expect(authFailureCode({ code: '28P01', message: 'password for user secret-user' })).toBe('AUTH_DATABASE_UNAVAILABLE');
  expect(authFailureCode({ cause: { code: 'ENOTFOUND' } })).toBe('AUTH_DATABASE_UNAVAILABLE');
  expect(authFailureCode({ code: 'ERR_INVALID_URL', input: 'postgres://secret' })).toBe('AUTH_CONFIGURATION_INVALID');
  expect(authFailureCode(new Error('unknown sensitive details'))).toBe('AUTH_SERVICE_UNAVAILABLE');
});
