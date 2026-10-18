import { test, expect } from 'bun:test';
import { PaintDocument, floodFill, hexRgba, clampRect, extractPixels, clearPixels, pastePixels, resizePixels, transformPixels, validatePaintSize } from '../lib/paint.ts';
import { parsePaintProject } from '../lib/paintProject.ts';
import { isEmbeddedImage } from '../draw/imageResource.ts';
import { isValidElement } from '../lib/elementValidation.mjs';
const rgba = (values) => new Uint8ClampedArray(values.flatMap(n => [n, 0, 0, n ? 255 : 0]));
const reds = pixels => Array.from(pixels).filter((_, i) => i % 4 === 0);

test('fill stays inside connected pixels and stops at opaque borders', () => {
  const pixels = rgba([1, 1, 9, 1, 1, 1, 9, 1]);
  expect(floodFill(pixels, 4, 2, 0, 0, [5, 0, 0, 255])).toBe(true);
  expect(reds(pixels)).toEqual([5, 5, 9, 1, 5, 5, 9, 1]);
  expect(floodFill(pixels, 4, 2, 0, 0, [5, 0, 0, 255])).toBe(false);
  expect(floodFill(pixels, 4, 2, -1, 0, [5, 0, 0, 255])).toBe(false);
});
test('fill tolerance includes close colors and respects alpha and diagonal separation', () => {
  const pixels = rgba([100, 102, 130, 130, 130, 100]);
  floodFill(pixels, 3, 2, 0, 0, [40, 20, 10, 128], 3);
  expect(reds(pixels)).toEqual([40, 40, 130, 130, 130, 100]);
  expect(pixels[3]).toBe(128);
  const large = new Uint8ClampedArray(512 * 512 * 4);
  floodFill(large, 512, 512, 250, 250, [1, 2, 3, 255]); expect([...large.slice(-4)]).toEqual([1, 2, 3, 255]);
});
test('selection extract, clear and clipped paste preserve surrounding pixels', () => {
  const pixels = rgba([1, 2, 3, 4, 5, 6]);
  const patch = extractPixels(pixels, 3, { x: 1, y: 0, width: 2, height: 2 }); expect(reds(patch)).toEqual([2, 3, 5, 6]);
  clearPixels(pixels, 3, { x: 1, y: 0, width: 2, height: 1 }); expect(reds(pixels)).toEqual([1, 0, 0, 4, 5, 6]);
  pastePixels(pixels, 3, 2, patch, { x: -1, y: 0, width: 2, height: 2 }); expect(reds(pixels)).toEqual([3, 0, 0, 6, 5, 6]);
});
test('rotate in both directions and flips place asymmetric pixels correctly', () => {
  const pixels = rgba([1, 2, 3, 4, 5, 6]);
  const right = transformPixels(pixels, 3, 2, 'right'); expect([right.width, right.height]).toEqual([2, 3]); expect(reds(right.pixels)).toEqual([4, 1, 5, 2, 6, 3]);
  expect(transformPixels(right.pixels, 2, 3, 'left').pixels).toEqual(pixels);
  expect(reds(transformPixels(pixels, 3, 2, 'horizontal').pixels)).toEqual([3, 2, 1, 6, 5, 4]);
  expect(reds(transformPixels(pixels, 3, 2, 'vertical').pixels)).toEqual([4, 5, 6, 1, 2, 3]);
});
test('canvas resizing pads transparently while image resizing resamples', () => {
  const pixels = rgba([1, 2, 3, 4]);
  expect(reds(resizePixels(pixels, 2, 2, 3, 3, false))).toEqual([1, 2, 0, 3, 4, 0, 0, 0, 0]);
  expect(reds(resizePixels(pixels, 2, 2, 4, 2, true))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  expect(reds(resizePixels(pixels, 2, 2, 1, 1, false))).toEqual([1]);
});
test('crop applies to every layer and undo restores dimensions and hidden layer data', () => {
  const doc = new PaintDocument(3, 2); doc.replacePixels(rgba([1, 2, 3, 4, 5, 6]));
  const top = doc.addLayer('Foreground'); doc.replacePixels(rgba([6, 5, 4, 3, 2, 1])); doc.updateLayer(top.id, { visible: false, opacity: 0.4 });
  doc.crop({ x: 1, y: 0, width: 2, height: 2 });
  expect(reds(doc.layers[0].pixels)).toEqual([2, 3, 5, 6]); expect(reds(doc.layers[1].pixels)).toEqual([5, 4, 2, 1]);
  doc.undo(); expect([doc.width, doc.height]).toEqual([3, 2]); expect(doc.active).toMatchObject({ visible: false, opacity: 0.4 });
  doc.redo(); expect([doc.width, doc.height]).toEqual([2, 2]);
});
test('layer ordering, visibility, deletion and undo retain the active layer', () => {
  const doc = new PaintDocument(2, 2), baseId = doc.activeId; const top = doc.addLayer('Top');
  doc.reorderLayer(top.id, -1); expect(doc.layers.map(l => l.id)).toEqual([top.id, baseId]);
  doc.updateLayer(top.id, { name: 'Renamed', visible: false }); doc.undo(); expect(doc.active.name).toBe('Top');
  doc.deleteLayer(top.id); expect(doc.activeId).toBe(baseId); doc.undo(); expect(doc.activeId).toBe(top.id);
  doc.setActive(baseId); doc.transform('right'); doc.undo(); expect(doc.activeId).toBe(baseId);
});
test('undo is bounded, branching edits clear redo, limits reject before mutation', () => {
  const doc = new PaintDocument(2, 2);
  for (let i = 0; i < 25; i++) { doc.checkpoint(); doc.active.pixels[0] = i; }
  let count = 0; while (doc.canUndo) { doc.undo(); count++; } expect(count).toBe(20);
  expect(doc.canRedo).toBe(true); doc.addLayer(); expect(doc.canRedo).toBe(false);
  for (let i = doc.layers.length; i < 8; i++) doc.addLayer(); expect(() => doc.addLayer()).toThrow(); expect(doc.layers).toHaveLength(8);
  expect(() => doc.resize(4096, 4096, true)).toThrow(); expect(doc.width).toBe(2);
  for (const dims of [[0, 1], [10.5, 1], [Infinity, 1], [4097, 1], [4096, 4096]]) expect(() => validatePaintSize(...dims)).toThrow();
  expect(clampRect({ x: -3, y: 9, width: 200, height: 0 }, 10, 10)).toEqual({ x: 0, y: 9, width: 10, height: 1 });
  expect(hexRgba('#3b82f6')).toEqual([59, 130, 246, 255]); expect(() => hexRgba('red')).toThrow();
});
const source = 'data:image/png;base64,iVBORw0KGgo=';
const project = { format: 'knotleaf.paint', version: 1, width: 20, height: 10, layers: [{ name: 'Hidden', source, visible: false, opacity: 0.3 }] };
test('editable projects preserve hidden layers and reject invalid resources and dimensions', () => {
  expect(parsePaintProject(JSON.stringify(project))).toEqual(project);
  for (const bad of [{ ...project, version: 2 }, { ...project, width: 0 }, { ...project, layers: [] }, { ...project, layers: [{ ...project.layers[0], source: 'https://example.com/a.png' }] }, { ...project, layers: [{ ...project.layers[0], opacity: 2 }] }]) expect(() => parsePaintProject(JSON.stringify(bad))).toThrow();
  expect(isEmbeddedImage('data:image/svg+xml;base64,AAAA')).toBe(false); expect(isEmbeddedImage('https://example.com/x.png')).toBe(false);
});
test('embedded board images validate for portable backups without allowing remote images', () => {
  const image = { id: 'image', type: 'image', source, imageName: 'Imported', x: 0, y: 0, width: 20, height: 10, strokeWidth: 0, stroke: 'transparent', fill: 'transparent', opacity: 1, strokeStyle: 'solid', fillStyle: 'none', roundness: 'sharp' };
  expect(isValidElement(image)).toBe(true); expect(isValidElement({ ...image, source: 'https://example.com/a.png' })).toBe(false);
});

test('image import is a single undo step and restores the original blank document', () => {
  const doc = new PaintDocument(3, 2); doc.importPixels(rgba([1, 2, 3, 4]), 2, 2, 'Image', true);
  expect([doc.width, doc.height]).toEqual([2, 2]); expect(reds(doc.active.pixels)).toEqual([1, 2, 3, 4]);
  doc.undo(); expect([doc.width, doc.height]).toEqual([3, 2]); expect(doc.active.pixels.every(n => n === 0)).toBe(true);
  doc.redo(); expect(reds(doc.active.pixels)).toEqual([1, 2, 3, 4]);
  doc.importPixels(rgba([4, 3, 2, 1]), 2, 2, 'Second', false); expect(doc.layers).toHaveLength(2);
  doc.undo(); expect(doc.layers).toHaveLength(1); expect(doc.active.name).toBe('Image');
});
