import { test, expect } from 'bun:test';
import { isContextPointer } from '../lib/pointerInput.ts';

test('Mac Control-click remains a secondary action; Command-click and ordinary clicks are not rejected', () => {
  expect(isContextPointer({ button: 0, ctrlKey: true }, 'MacIntel')).toBe(true);
  expect(isContextPointer({ button: 0, ctrlKey: false, metaKey: true }, 'MacIntel')).toBe(false);
  expect(isContextPointer({ button: 0, ctrlKey: true }, 'Win32')).toBe(false);
  expect(isContextPointer({ button: 2 }, 'MacIntel')).toBe(true);
});
