import { test, expect } from 'bun:test';
import { isValidElement } from '../lib/elementValidation.mjs';
import { getImageResource } from '../draw/imageResource.ts';
const source = 'data:image/png;base64,iVBORw0KGgo=';
test('embedded board images validate for portable backups without allowing remote images', () => {
  const image = { id: 'image', type: 'image', source, imageName: 'Imported', x: 0, y: 0, width: 20, height: 10, strokeWidth: 0, stroke: 'transparent', fill: 'transparent', opacity: 1, strokeStyle: 'solid', fillStyle: 'none', roundness: 'sharp' };
  expect(isValidElement(image)).toBe(true); expect(isValidElement({ ...image, source: 'https://example.com/a.png' })).toBe(false);
});

test('cached images still respect the size limit of each request', () => {
  const original = globalThis.Image;
  globalThis.Image = class { set src(value) { this.value = value; } };
  try {
    const image = getImageResource(source, undefined, Infinity);
    expect(getImageResource(source, undefined, Infinity)).toBe(image);
    expect(() => getImageResource(source, undefined, source.length - 1)).toThrow('Could not read this embedded image.');
  } finally {
    globalThis.Image = original;
  }
});
