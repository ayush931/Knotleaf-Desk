import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
test('account authentication lifecycle and security boundaries in the Node runtime', () => {
  const result = spawnSync('node', ['scripts/check-auth.mjs'], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development' } });
  expect(result.stderr + result.stdout).toContain('Auth checks passed');
  expect(result.status).toBe(0);
}, 30000);
