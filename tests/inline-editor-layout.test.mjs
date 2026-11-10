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

test('typed free text uses the canvas alignment width without adding editor-only space', () => {
 for (const zoom of [0.5, 1, 2]) {
  const layout = inlineEditorLayout({ ...base, text: 'Hi', zoom, contentWidth: 14 * zoom });
  expect(layout.width).toBe(14 * zoom); expect(layout.left).toBe(base.screenX);
  expect(inlineEditorLayout({ ...base, text: 'Hi', contentWidth: 420 * zoom }).width).toBe(420 * zoom);
 }
});

test('focusing existing text never moves its anchor or changes its alignment width near viewport edges',()=>{
 for(const zoom of [.5,1,2])for(const [x,y]of [[850,580],[-30,-10],[100,100]]){
  const input={...base,text:'Existing aligned text',zoom,screenX:x,screenY:y,contentWidth:420*zoom,preservePosition:true};
  const first=inlineEditorLayout(input);expect(first.left).toBe(x);expect(first.top).toBe(y);expect(first.width).toBe(420*zoom);
  expect(inlineEditorLayout(input)).toEqual(first);expect(first.maxHeight).toBeGreaterThanOrEqual(first.minHeight);
 }
});


test('anchored creation keeps exact fractional dimensions and never introduces viewport scrolling',()=>{
 for(const text of ['', 'First text', 'Line\n'.repeat(100)])for(const zoom of [.33,.75,1,1.25,3])for(const [x,y] of [[895,595],[-25,-10],[100,100]]){
  const layout=inlineEditorLayout({...base,text,zoom,screenX:x,screenY:y,contentWidth:137*zoom,preservePosition:true});
  expect([layout.left,layout.top]).toEqual([x,y]);if(text)expect(layout.width).toBe(137*zoom);
  expect(layout.maxHeight).toBe(Infinity);
 }
});
