import { test, expect } from 'bun:test';
import { formatBugReport, bugReportUrl } from '../lib/bugReport.ts';
const draft = { summary: 'Shapes & arrows? #1', steps: 'Draw → move\nDouble-click', expected: 'Editable text', actual: 'No cursor' };
test('bug report URLs preserve text and include only explicit environment fields', () => {
  const env = { browser: 'Browser test', viewport: '1280 × 800', mode: 'Local website', boardId: 'private-id', roomUrl: 'https://private.example/room', notes: 'private notes' };
  const url = new URL(bugReportUrl(draft, env));
  expect(url.searchParams.get('title')).toBe(draft.summary);
  expect(url.searchParams.get('body')).toBe(formatBugReport(draft, env));
  expect(url.searchParams.get('body')).not.toContain('private');
  expect(formatBugReport(draft)).not.toContain('## Environment');
});
test('long Unicode reports use a bounded review URL and keep the full copyable report', () => {
  const long = { ...draft, steps: '重'.repeat(2000) };
  const url = new URL(bugReportUrl(long));
  expect(url.toString().length).toBeLessThan(7500); expect(url.searchParams.has('body')).toBe(false);
  expect(formatBugReport(long)).toContain(long.steps);
});
