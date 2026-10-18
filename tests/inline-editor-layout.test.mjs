import { test, expect } from 'bun:test';
import { inlineEditorLayout } from '../draw/inlineEditorLayout.ts';

const base = { text: '', placeholder: 'Type here…', measure: text => text.length * 12, zoom: 1, fontSize: 24, screenX: 100, screenY: 100, viewportWidth: 900, viewportHeight: 600 };
test('empty text editors fit the complete placeholder instead of measuring an empty string', () => {
  const layout = inlineEditorLayout(base);
  expect(layout.width).toBeGreaterThanOrEqual(base.measure(base.placeholder));
  expect(layout.left).toBe(100); expect(layout.top).toBe(100);
});
test('placeholder layout stays inside narrow viewports at every edge and large font sizes', () => {
  for (const viewportWidth of [240, 320, 768, 1440]) for (const zoom of [0.5, 1, 3]) for (const fontSize of [15, 24, 96]) {
    const input = { ...base, viewportWidth, viewportHeight: 240, screenX: viewportWidth - 2, screenY: 238, zoom, fontSize, measure: text => text.length * fontSize };
    const layout = inlineEditorLayout(input);
    expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.left + layout.width).toBeLessThanOrEqual(viewportWidth);
    expect(layout.top + layout.minHeight).toBeLessThanOrEqual(240);
    expect(layout.maxHeight).toBeGreaterThanOrEqual(layout.minHeight);
  }
});
test('document and sticky editors retain card width and wrap long hints within the viewport', () => {
  expect(inlineEditorLayout({ ...base, preferredWidth: 156 }).width).toBe(156);
  expect(inlineEditorLayout({ ...base, preferredWidth: 240, viewportWidth: 220 }).width).toBe(204);
});
test('typed text determines editor width after the placeholder disappears', () => {
  const layout = inlineEditorLayout({ ...base, text: 'Hi' });
  expect(layout.width).toBe(40);
});
