import { beforeAll, afterAll, describe, test, expect } from 'bun:test';
import { CanvasEngine } from '../draw/CanvasEngine.ts';
const savedGlobals = new Map();
beforeAll(() => {
  for (const [key, value] of Object.entries({
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: { documentElement: {}, querySelector: () => null },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  })) { savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
});
afterAll(() => { for (const [key, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
const source = { ...base, id: 'source', type: 'rectangle', x: 100, y: 100, width: 120, height: 80 };
const target = { ...base, id: 'target', type: 'rectangle', x: 500, y: 300, width: 120, height: 80 };
const arrow = { ...base, id: 'arrow', type: 'arrow', x: 220, y: 140, width: 280, height: 200, startX: 220, startY: 140, endX: 500, endY: 340, routing: 'elbow', startBinding: { elementId: 'source', anchor: 'right' }, endBinding: { elementId: 'target', anchor: 'left' } };
function setup(elements = [source, target, arrow]) {
  const listeners = {};
  const ctx = new Proxy({ measureText: text => ({ width: text.length * 7 }) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  const canvas = { clientWidth: 1000, clientHeight: 700, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {}, setPointerCapture() {} };
  const engine = new CanvasEngine(canvas, elements);
  const point = (x, y, shiftKey = false) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, shiftKey });
  const drag = (x, y, nx, ny) => { listeners.pointerdown(point(x, y)); listeners.pointermove(point(nx, ny)); listeners.pointerup(point(nx, ny)); };
  return { engine, listeners, point, drag };
}
describe('attachment lifecycle', () => {
  test('moving a shape keeps its connector endpoint on the exact port, including undo/redo', () => {
    const { engine, drag } = setup();
    drag(150, 130, 200, 170);
    let end = engine.getElements().find(e => e.id === 'arrow');
    expect([end.startX, end.startY]).toEqual([270, 180]);
    expect(end.startBinding).toEqual(arrow.startBinding);
    engine.undo(); end = engine.getElements().find(e => e.id === 'arrow'); expect([end.startX, end.startY]).toEqual([220, 140]);
    engine.redo(); end = engine.getElements().find(e => e.id === 'arrow'); expect([end.startX, end.startY]).toEqual([270, 180]);
    engine.destroy();
  });
  test('dragging a connector body preserves both attachments', () => {
    const { engine, drag } = setup();
    drag(310, 140, 340, 170);
    const end = engine.getElements().find(e => e.id === 'arrow');
    expect(end.startBinding).toEqual(arrow.startBinding); expect(end.endBinding).toEqual(arrow.endBinding);
    expect([end.startX, end.startY, end.endX, end.endY]).toEqual([220, 140, 500, 340]);
    engine.destroy();
  });
  test('property resizing repositions bound endpoints', () => {
    const { engine, drag } = setup(); drag(150, 130, 150, 130);
    engine.updateSelectedElement({ width: 200, height: 100 });
    const end = engine.getElements().find(e => e.id === 'arrow'); expect([end.startX, end.startY]).toEqual([300, 150]); engine.destroy();
  });
  test('connecting a selection creates bound arrows in one undo step', () => {
    const { engine } = setup([source, target]); engine.selectAll(); engine.connectSelected();
    const created = engine.getElements().find(e => e.type === 'arrow'); expect(created.startBinding.elementId).toBe('source'); expect(created.endBinding.elementId).toBe('target');
    engine.undo(); expect(engine.getElements()).toHaveLength(2); engine.destroy();
  });
  test('drawing backwards retains the original pointer-down position', () => {
    const { engine, listeners, point } = setup([]); engine.setTool('rectangle');
    listeners.pointerdown(point(400, 300)); listeners.pointermove(point(350, 250)); listeners.pointermove(point(300, 200)); listeners.pointerup(point(300, 200));
    expect(engine.getElements()[0]).toMatchObject({ x: 300, y: 200, width: 100, height: 100 }); engine.destroy();
  });
  test('duplicating connected shapes rebinds to the copies', () => {
    const { engine } = setup(); engine.selectAll(); engine.duplicateSelected();
    const copies = engine.getSelectedElements(), copiedArrow = copies.find(e => e.type === 'arrow');
    expect(copies.some(e => e.id === copiedArrow.startBinding.elementId)).toBe(true); expect(copies.some(e => e.id === copiedArrow.endBinding.elementId)).toBe(true);
    expect(copiedArrow.startBinding.elementId).not.toBe('source'); engine.destroy();
  });
});

describe('sticky notes', () => {
  const sticky = { ...base, id: 'note', type: 'sticky', x: 100, y: 100, width: 180, height: 140, text: '', color: '#FEF08A', stroke: '#1E293B', fontSize: 15 };
  const edit = text => ({ kind: 'sticky', elementId: 'note', text, fontSize: 18, fontFamily: 'mono', color: '#1E293B', align: 'center' });
  test('empty notes remain on the board when editing finishes', () => {
    const { engine } = setup([sticky]); engine.commitInlineText(edit('')); expect(engine.getElements()).toHaveLength(1); engine.destroy();
  });
  test('long notes grow instead of silently clipping text and retain formatting', () => {
    const { engine } = setup([sticky]); engine.commitInlineText(edit('A long sticky note with many words that should remain visible. '.repeat(15)));
    const note = engine.getElements()[0]; expect(note.height).toBeGreaterThan(140); expect(note.fontSize).toBe(18); expect(note.fontFamily).toBe('mono'); expect(note.textAlign).toBe('center');
    engine.undo(); expect(engine.getElements()[0].text).toBe(''); engine.destroy();
  });
});

test('growing a sticky updates attached bottom port', () => {
  const note = { ...base, id: 'note', type: 'sticky', x: 100, y: 100, width: 180, height: 140, text: '', color: '#FEF08A', fontSize: 15 };
  const linked = { ...arrow, startX: 190, startY: 240, startBinding: { elementId: 'note', anchor: 'bottom' } };
  const { engine } = setup([note, target, linked]);
  engine.commitInlineText({ kind: 'sticky', elementId: 'note', text: 'Many words '.repeat(100), fontSize: 18, fontFamily: 'sans', color: '#1E293B', align: 'left' });
  const grown = engine.getElements().find(e => e.id === 'note'); const connector = engine.getElements().find(e => e.id === 'arrow');
  expect(connector.startY).toBe(grown.y + grown.height); expect(connector.startX).toBe(grown.x + grown.width / 2); engine.destroy();
});

test('reverse arrow direction moves the end arrowhead to the opposite attached shape', () => {
  const { engine } = setup([{ ...arrow, arrowHeadStart: 'none', arrowHeadEnd: 'arrow' }]);
  engine.selectAll(); engine.swapSelectedArrows(); const reversed = engine.getElements()[0];
  expect(reversed.startBinding).toEqual(arrow.endBinding); expect(reversed.endBinding).toEqual(arrow.startBinding);
  expect(reversed.arrowHeadStart).toBe('none'); expect(reversed.arrowHeadEnd).toBe('arrow'); expect(reversed.endX).toBe(arrow.startX); engine.destroy();
});
