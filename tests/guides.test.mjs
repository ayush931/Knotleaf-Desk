import { test, expect } from 'bun:test';
import { smartGuides } from '../draw/smartGuides.ts';
const box = (x, y, width = 100, height = 100) => ({ minX: x, minY: y, maxX: x + width, maxY: y + height });
test('edge and center alignment snap within a screen-constant tolerance', () => {
  expect(smartGuides(box(204, 100), [box(200, 400)], 1).dx).toBe(-4);
  expect(smartGuides(box(204, 100), [box(200, 400)], 2).dx).toBe(0);
  expect(smartGuides(box(204, 100), [box(200, 400)], 1, false).dx).toBe(0);
});
test('gap rulers report nearest objects and highlight equal spacing', () => {
  const result = smartGuides(box(140, 100), [box(0, 100), box(280, 100)], 1);
  expect(result.guides.filter(guide => guide.label).map(guide => guide.label)).toEqual(['= 40 px', '= 40 px']);
});
test('distant and empty targets do not create noisy alignment guides', () => {
  expect(smartGuides(box(100, 100), [], 1)).toEqual({ dx: 0, dy: 0, guides: [] });
  expect(smartGuides(box(100, 100), [box(100, 5000)], 1).guides).toEqual([]);
});
