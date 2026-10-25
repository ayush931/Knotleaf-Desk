import { test, expect } from 'bun:test';
import { textSizeShortcut, stepCanvasFontSize, stepNoteFontSize } from '../lib/textShortcuts.ts';

test('Mac text-size shortcut recognizes physical and shifted punctuation keys', () => {
  for (const [code, key, expected] of [['Period', '>', 2], ['Period', '.', 2], ['Period', 'Unidentified', 2], ['Comma', '<', -2], ['Comma', ',', -2]]) {
    expect(textSizeShortcut({ code, key, metaKey: true, shiftKey: true })).toBe(expected);
  }
  expect(textSizeShortcut({ key: '>', ctrlKey: true, shiftKey: true })).toBe(2);
});

test('text-size shortcut preserves ordinary punctuation, composition and unmodified browser commands', () => {
  const key = { code: 'Period', key: '.', metaKey: true, shiftKey: true };
  expect(textSizeShortcut({ ...key, shiftKey: false })).toBe(0);
  expect(textSizeShortcut({ ...key, isComposing: true })).toBe(0);
  expect(textSizeShortcut({ ...key, altKey: true })).toBe(0);
  expect(textSizeShortcut({ ...key, metaKey: false })).toBe(0);
  expect(stepCanvasFontSize(120, 2)).toBe(122);
  expect(stepCanvasFontSize(512, 2)).toBe(512);
});

test('Mac Command Shift Period delivered as Escape still increases text size', () => {
  expect(textSizeShortcut({ key: 'Escape', metaKey: true, shiftKey: true })).toBe(2);
  expect(textSizeShortcut({ key: 'Escape', code: 'Escape' })).toBe(0);
  expect(textSizeShortcut({ key: 'Escape', shiftKey: true })).toBe(0);
  expect(stepNoteFontSize(127, 2)).toBe(128);
  expect(stepNoteFontSize(9, -2)).toBe(8);
});
