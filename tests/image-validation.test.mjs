import { test, expect } from 'bun:test';
import { isValidElement } from '../lib/elementValidation.mjs';
const source = 'data:image/png;base64,iVBORw0KGgo=';
test('embedded board images validate for portable backups without allowing remote images', () => {
  const image = { id: 'image', type: 'image', source, imageName: 'Imported', x: 0, y: 0, width: 20, height: 10, strokeWidth: 0, stroke: 'transparent', fill: 'transparent', opacity: 1, strokeStyle: 'solid', fillStyle: 'none', roundness: 'sharp' };
  expect(isValidElement(image)).toBe(true); expect(isValidElement({ ...image, source: 'https://example.com/a.png' })).toBe(false);
});
