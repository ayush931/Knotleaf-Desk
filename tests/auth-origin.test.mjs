import { test, expect } from 'bun:test';
import { canonicalAuthPageURL } from '../lib/authOrigin.mjs';

test('local OAuth page origins stay pinned to the configured hostname and preserve board routes', () => {
  expect(canonicalAuthPageURL('http://127.0.0.1:3000/canvas/abc?call=1', 'http://localhost:3000')).toBe('http://localhost:3000/canvas/abc?call=1');
  expect(canonicalAuthPageURL('http://localhost:3000/', 'http://localhost:3000')).toBe(null);
  expect(canonicalAuthPageURL('http://evil.example:3000/', 'http://localhost:3000')).toBe(null);
  expect(canonicalAuthPageURL('http://127.0.0.1:3001/', 'http://localhost:3000')).toBe(null);
  expect(canonicalAuthPageURL('https://desk.example/', 'https://other.example')).toBe(null);
  expect(canonicalAuthPageURL('http://127.0.0.1:3000/', '')).toBe(null);
});
