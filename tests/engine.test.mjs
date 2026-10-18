import { beforeAll, afterAll, describe, test, expect } from 'bun:test';
import { CanvasEngine } from '../draw/CanvasEngine.ts';
import { FONT_OPTIONS, fontCssStack } from '../draw/fonts.ts';
import { setFont } from '../draw/renderer.ts';
import { computeArrowPath, drawElement, layoutDocument, drawSelection, drawElementAnchors, getElementAnchors, getElementBounds } from '../draw/renderer.ts';
const savedGlobals = new Map();
beforeAll(() => {
  for (const [key, value] of Object.entries({
    window: { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: { documentElement: {}, querySelector: () => null },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    HTMLElement: class HTMLElement {},
  })) { savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
});
afterAll(() => { for (const [key, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
const source = { ...base, id: 'source', type: 'rectangle', x: 100, y: 100, width: 120, height: 80 };
const target = { ...base, id: 'target', type: 'rectangle', x: 500, y: 300, width: 120, height: 80 };
const arrow = { ...base, id: 'arrow', type: 'arrow', x: 220, y: 140, width: 280, height: 200, startX: 220, startY: 140, endX: 500, endY: 340, routing: 'elbow', startBinding: { elementId: 'source', anchor: 'right' }, endBinding: { elementId: 'target', anchor: 'left' } };
function setup(elements = [source, target, arrow]) {
  const listeners = {};
  const captures = [];
  const ctx = new Proxy({ measureText: text => ({ width: text.length * 7 }) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  const canvas = { clientWidth: 1000, clientHeight: 700, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {}, setPointerCapture(id) { captures.push(id); } };
  const engine = new CanvasEngine(canvas, elements);
  const point = (x, y, shiftKey = false) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, shiftKey, preventDefault() {} });
  const drag = (x, y, nx, ny) => { listeners.pointerdown(point(x, y)); listeners.pointermove(point(nx, ny)); listeners.pointerup(point(nx, ny)); };
  return { engine, listeners, point, drag, captures };
}
test('all font families render, remain editable, and survive undo/redo', () => {
  for (const font of FONT_OPTIONS) {
    const { engine, listeners, point } = setup([]); let editor;
    engine.currentStyle.fontFamily = font.id; engine.onStartInlineText = state => { editor = state; };
    engine.setTool('text'); listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
    expect(editor.fontFamily).toBe(font.id); engine.commitInlineText({ ...editor, text: 'Font sample' });
    expect(engine.getElements()[0].fontFamily).toBe(font.id);
    engine.undo(); expect(engine.getElements()).toHaveLength(0); engine.redo();
    engine.setTool('select'); listeners.dblclick(point(105, 105)); expect(editor.fontFamily).toBe(font.id);
    const ctx = {}; setFont(ctx, 24, font.id, 700, true);
    expect(ctx.font).toContain(font.fallback); expect(ctx.font).toStartWith('italic 700 24px');
    expect(fontCssStack(font.id)).toContain(font.variable);
    engine.destroy();
  }
});
test('document and sticky creation use the chosen font', () => {
  for (const tool of ['doc', 'sticky']) {
    const { engine, listeners, point } = setup([]); engine.currentStyle.fontFamily = 'rounded'; engine.setTool(tool);
    listeners.pointerdown(point(100, 100)); expect(engine.getElements()[0].fontFamily).toBe('rounded'); engine.destroy();
  }
});
test('straight arrows draw directly and preserve properties through routing changes', () => {
  const { engine, drag } = setup([source, target]);
  engine.currentStyle = { ...engine.currentStyle, arrowRouting: 'straight', arrowHeadStart: 'dot', arrowHeadEnd: 'diamond', arrowAnimated: true };
  engine.setTool('arrow');
  drag(220, 140, 500, 340);
  let created = engine.getElements().find(el => el.type === 'arrow');
  expect(created).toMatchObject({ routing: 'straight', startBinding: arrow.startBinding, endBinding: arrow.endBinding, arrowHeadStart: 'dot', arrowHeadEnd: 'diamond', animated: true });
  expect(computeArrowPath(created, engine.getElements()).points).toEqual([{ x: 220, y: 140 }, { x: 500, y: 340 }]);
  engine.selectAll();
  for (const routing of ['curved', 'elbow', 'straight']) {
    engine.updateSelectedElement({ routing, elbow: routing, label: 'Request' });
    created = engine.getElements().find(el => el.type === 'arrow');
    expect(computeArrowPath(created, engine.getElements()).routing).toBe(routing);
    expect(created).toMatchObject({ label: 'Request', startBinding: arrow.startBinding, endBinding: arrow.endBinding, arrowHeadStart: 'dot', arrowHeadEnd: 'diamond', animated: true });
  }
  engine.destroy();
});
test('Pencil stays active between strokes, cancellation and quick repeated clicks', () => {
  const { engine, drag, listeners, point } = setup([]);
  engine.setTool('pencil');
  drag(100, 100, 140, 130);
  expect(engine.getTool()).toBe('pencil'); expect(engine.getSelectedElements()).toEqual([]);
  drag(180, 100, 220, 150);
  expect(engine.getElements().map(el => el.type)).toEqual(['pencil', 'pencil']);
  expect(engine.getTool()).toBe('pencil');
  listeners.dblclick(point(220, 150)); expect(engine.getTool()).toBe('pencil');
  listeners.pointerdown(point(250, 100)); listeners.pointermove(point(280, 130)); listeners.pointercancel(point(280, 130));
  expect(engine.getTool()).toBe('pencil'); expect(engine.getElements()).toHaveLength(2);
  engine.undo(); expect(engine.getElements()).toHaveLength(1);
  engine.redo(); expect(engine.getElements()).toHaveLength(2);
  drag(300, 100, 340, 140); expect(engine.getElements()).toHaveLength(3);
  engine.setTool('select'); expect(engine.getTool()).toBe('select');
  engine.destroy();
});
for (const tool of ['rectangle', 'diamond', 'circle', 'arrow', 'line', 'pencil', 'frame']) {
  test(`${tool} stays active for repeated drawing, double clicks and cancellation`, () => {
    const { engine, drag, listeners, point } = setup([]);
    engine.setTool(tool); drag(100, 100, 180, 160);
    expect(engine.getTool()).toBe(tool); expect(engine.getSelectedElements()).toEqual([]);
    listeners.dblclick(point(180, 160)); expect(engine.getTool()).toBe(tool);
    drag(300, 100, 380, 160);
    expect(engine.getElements().map(el => el.type)).toEqual([tool, tool]);
    listeners.pointerdown(point(500, 100)); listeners.pointermove(point(580, 160)); listeners.pointercancel(point(580, 160));
    expect(engine.getTool()).toBe(tool); expect(engine.getElements()).toHaveLength(2);
    engine.undo(); expect(engine.getElements()).toHaveLength(1);
    engine.redo(); expect(engine.getElements()).toHaveLength(2);
    engine.setTool('select'); expect(engine.getTool()).toBe('select'); engine.destroy();
  });
}
for (const tool of ['text', 'doc', 'sticky']) {
  test(`${tool} stays active while finishing one editor and creating the next`, () => {
    const { engine, listeners, point } = setup([]); let editor;
    engine.onStartInlineText = state => { editor = state; };
    engine.onBeforeCreate = () => { if (editor) { engine.commitInlineText({ ...editor, text: 'First item' }); editor = undefined; } };
    engine.setTool(tool); listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
    expect(engine.getTool()).toBe(tool);
    listeners.pointerdown(point(400, 100)); listeners.pointerup(point(400, 100));
    engine.commitInlineText({ ...editor, text: 'Second item' });
    expect(engine.getTool()).toBe(tool);
    expect(engine.getElements().map(el => el.text)).toEqual(['First item', 'Second item']);
    engine.setTool('select'); expect(engine.getTool()).toBe('select'); engine.destroy();
  });
}
test('Code stays active after editing and creates a second independent card', () => {
  const { engine, listeners, point } = setup([]); let edited;
  engine.onEditCode = id => { edited = id; }; engine.onBeforeCreate = () => engine.finishCode();
  engine.setTool('code'); listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
  engine.updateCode(edited, 'first()', 'javascript'); engine.finishCode(); expect(engine.getTool()).toBe('code');
  listeners.pointerdown(point(400, 100)); listeners.pointerup(point(400, 100));
  engine.updateCode(edited, 'second()', 'javascript'); engine.finishCode();
  expect(engine.getElements().map(el => el.text)).toEqual(['first()', 'second()']); expect(engine.getTool()).toBe('code'); engine.destroy();
});
test('icon insertion and erasing preserve the explicitly chosen tool', () => {
  const { engine, drag, listeners, point } = setup([]); engine.setTool('rectangle');
  engine.addOnlineIcon('Test', 'test', '<path d="M0 0h24v24z"/>', '0 0 24 24'); expect(engine.getTool()).toBe('rectangle');
  drag(100, 100, 180, 160); engine.setTool('eraser');
  listeners.pointerdown(point(140, 130)); listeners.pointerup(point(140, 130)); expect(engine.getTool()).toBe('eraser'); engine.destroy();
});
describe('manual arrow bending', () => {
  const straight = { ...arrow, startX: 100, startY: 200, endX: 500, endY: 200, x: 100, y: 200, width: 400, height: 0, routing: 'straight', startBinding: undefined, endBinding: undefined, label: 'Flow', arrowHeadEnd: 'diamond', animated: true };
  test('dragging the center bends either way, follows the pointer and supports undo/redo', () => {
    const { engine, drag } = setup([straight]);
    engine.selectAll();
    drag(300, 200, 300, 280);
    let bent = engine.getElements()[0];
    expect(bent).toMatchObject({ routing: 'curved', bendOffset: 160, label: 'Flow', arrowHeadEnd: 'diamond', animated: true });
    expect(computeArrowPath(bent).midPt).toEqual({ x: 300, y: 280 });
    engine.undo(); expect(engine.getElements()[0].routing).toBe('straight');
    engine.redo(); expect(computeArrowPath(engine.getElements()[0]).midPt.y).toBe(280);
    drag(300, 280, 300, 140);
    expect(computeArrowPath(engine.getElements()[0]).midPt).toEqual({ x: 300, y: 140 });
    engine.updateSelectedElement({ routing: 'straight', elbow: 'straight', bendOffset: undefined });
    expect(computeArrowPath(engine.getElements()[0]).midPt).toEqual({ x: 300, y: 200 });
    engine.destroy();
  });
  test('cancelling a bend restores the straight arrow', () => {
    const { engine, listeners, point } = setup([straight]);
    engine.selectAll(); listeners.pointerdown(point(300, 200)); listeners.pointermove(point(300, 280));
    listeners.pointercancel(point(300, 280));
    expect(engine.getElements()[0]).toEqual(straight);
    engine.destroy();
  });
  test('a custom bend and bindings survive moving an attached shape', () => {
    const linked = { ...arrow, routing: 'straight' };
    const { engine, drag } = setup([source, target, linked]);
    drag(360, 240, 360, 240); // Select the arrow before dragging its center handle.
    const mid = computeArrowPath(linked).midPt;
    drag(mid.x, mid.y, mid.x - 40, mid.y + 56);
    const bent = engine.getElements().find(el => el.id === 'arrow');
    expect(bent.routing).toBe('curved');
    expect(bent.startBinding).toEqual(arrow.startBinding); expect(bent.endBinding).toEqual(arrow.endBinding);
    drag(150, 130, 180, 160);
    const moved = engine.getElements().find(el => el.id === 'arrow');
    expect(moved.bendOffset).toBe(bent.bendOffset);
    expect([moved.startX, moved.startY]).toEqual([250, 170]);
    expect(computeArrowPath(moved).routing).toBe('curved');
    engine.destroy();
  });
});
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
    const body = computeArrowPath(arrow, [source, target]).midPt;
    drag(body.x, body.y, body.x + 30, body.y + 30);
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

test('a selected bound endpoint can reconnect even when attachment ports are visible', () => {
  const { engine, listeners, point } = setup();
  // Select the connector body, hover its attached end, then drag that endpoint onto the target's top port.
  const body = computeArrowPath(arrow, [source, target]).midPt;
  listeners.pointerdown(point(body.x, body.y)); listeners.pointerup(point(body.x, body.y)); listeners.pointermove(point(500, 340));
  listeners.pointerdown(point(500, 340)); listeners.pointermove(point(560, 300)); listeners.pointerup(point(560, 300));
  const updated = engine.getElements().find(e => e.id === 'arrow'); expect(engine.getElements()).toHaveLength(3);
  expect(updated.endBinding).toEqual({ elementId: 'target', anchor: 'top' }); expect([updated.endX, updated.endY]).toEqual([560, 300]); engine.destroy();
});

test('a remote addition does not cancel an unfinished eraser deletion', () => {
  const { engine, listeners, point } = setup([source, target]);
  const added = { ...source, id: 'peer-added', x: 750 };
  let committed;
  engine.onChange = elements => { committed = elements; };
  engine.setTool('eraser'); listeners.pointerdown(point(150, 130));
  expect(engine.getElements().some(e => e.id === source.id)).toBe(false);
  engine.applyRemoteElements([source, target, added]);
  expect(engine.getElements().map(e => e.id).sort()).toEqual(['peer-added', 'target']);
  listeners.pointerup(point(150, 130));
  expect(committed.map(e => e.id).sort()).toEqual(['peer-added', 'target']); engine.destroy();
});

test('remote deletion wins over an unfinished move while keeping other local work', () => {
  const { engine, listeners, point } = setup([source, target]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(200, 180));
  engine.applyRemoteElements([target]); listeners.pointerup(point(200, 180));
  expect(engine.getElements().map(e => e.id)).toEqual(['target']); engine.destroy();
});

test('Text followed by a canvas click starts an editor at the click and clears the previous shape selection', () => {
  const { engine, listeners, point } = setup([source]);
  engine.selectAll(); engine.setTool('text');
  let editor; engine.onStartInlineText = state => { editor = state; };
  listeners.pointerdown(point(350, 250)); listeners.pointerup(point(350, 250));
  expect(editor).toMatchObject({ kind: 'new-text', text: '', canvasX: 350, canvasY: 250, screenX: 350, screenY: 250 });
  expect(engine.getSelectedElements()).toHaveLength(0);
  engine.commitInlineText({ ...editor, text: 'New canvas text', fontSize: 24, fontFamily: 'mono', color: '#3B82F6', align: 'center' });
  expect(engine.getElements().find(e => e.type === 'text')).toMatchObject({ text: 'New canvas text', x: 350, y: 250, fontSize: 24, fontFamily: 'mono', stroke: '#3B82F6', textAlign: 'center' });
  expect(engine.getElements().find(e => e.id === source.id)).toEqual(source); engine.destroy();
});


test('text clicks suppress canvas mouse focus and do not capture the editor pointer', () => {
  const { engine, listeners, point, captures } = setup([]);
  engine.setTool('text');
  let suppressed = false, editor;
  const click = { ...point(350, 250), preventDefault() { suppressed = true; } };
  engine.onStartInlineText = state => { editor = state; };
  listeners.pointerdown(click);
  expect(suppressed).toBe(true); expect(captures).toHaveLength(0);
  expect(editor?.kind).toBe('new-text');
  listeners.pointerup(click);
  engine.commitInlineText({ ...editor, text: 'Typing stays in the editor' });
  expect(engine.getElements()[0].text).toBe('Typing stays in the editor'); engine.destroy();
});

test('sticky and document editors also suppress the canvas focus event', () => {
  for (const tool of ['sticky', 'doc']) {
    const { engine, listeners, point, captures } = setup([]);
    engine.setTool(tool); let suppressed = false, editor;
    engine.onStartInlineText = state => { editor = state; };
    listeners.pointerdown({ ...point(350, 250), preventDefault() { suppressed = true; } });
    expect(suppressed).toBe(true); expect(captures).toHaveLength(0); expect(editor).toBeDefined(); engine.destroy();
  }
});


test('plain canvas text persists formatting, reopens with it and supports undo/redo toggles', () => {
  const { engine, listeners, point } = setup([]);
  engine.commitInlineText({ kind: 'new-text', canvasX: 100, canvasY: 100, text: 'Hello', fontSize: 24, fontFamily: 'sans', color: '#fff', align: 'left', bold: true, italic: true, underline: true });
  let text = engine.getElements()[0];
  expect(text).toMatchObject({ fill: 'transparent', isDocCard: false, bold: true, italic: true, underline: true, strikethrough: false });
  engine.toggleTextFormatting('bold'); expect(engine.getElements()[0].bold).toBe(false);
  engine.undo(); expect(engine.getElements()[0].bold).toBe(true);
  engine.redo(); expect(engine.getElements()[0].bold).toBe(false);
  engine.selectAll(); engine.toggleTextFormatting('strikethrough');
  let editor; engine.onStartInlineText = state => { editor = state; };
  listeners.dblclick(point(110, 110));
  expect(editor).toMatchObject({ bold: false, italic: true, underline: true, strikethrough: true });
  engine.commitInlineText({ ...editor, text: 'Edited' });
  expect(engine.getElements()[0]).toMatchObject({ text: 'Edited', italic: true, underline: true, strikethrough: true }); engine.destroy();
});

test('plain text renderer paints glyphs and decorations without a card background', () => {
  const painted = [], paths = [], fonts = [];
  const ctx = new Proxy({
    measureText(text) { fonts.push(this.font); return { width: text.length * (this.font.includes('700') ? 10 : 7) }; },
    fillText(text) { painted.push([text, this.font]); },
    fill() { paths.push('fill'); }, stroke() { paths.push('stroke'); },
  }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  const text = { ...base, id: 'formatted', type: 'text', x: 10, y: 20, width: 50, height: 30, text: 'Hello', fontSize: 24, fontFamily: 'sans', textAlign: 'left', bold: true, italic: true, underline: true, strikethrough: true };
  const layout = layoutDocument(ctx, text.text, 24, 'sans', text);
  expect(layout.lines[0]).toMatchObject({ fontWeight: 700, isItalic: true });
  expect(fonts.some(font => font.startsWith('italic 700 24px'))).toBe(true);
  drawElement(ctx, text, { theme: 'dark' });
  expect(painted).toEqual([['Hello', expect.stringContaining('italic 700 24px')]]);
  expect(paths).toEqual(['stroke', 'stroke']);
});


test('selection paints one connector per side and only corner resize squares at every zoom', () => {
  for (const zoom of [0.5, 1, 2]) {
    const squares = [], circles = [];
    const ctx = new Proxy({ rect: (...args) => squares.push(args), arc: (...args) => circles.push(args) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
    drawSelection(ctx, source, zoom);
    drawElementAnchors(ctx, getElementAnchors(source), null, zoom);
    expect(squares).toHaveLength(4); expect(circles).toHaveLength(4);
    expect(circles.map(([x, y]) => [x, y])).toEqual([[160, 100], [220, 140], [160, 180], [100, 140]]);
    const pad = 5 / zoom, half = 4 / zoom;
    expect(squares.map(([x, y]) => [x + half, y + half])).toEqual([[100 - pad, 100 - pad], [220 + pad, 100 - pad], [220 + pad, 180 + pad], [100 - pad, 180 + pad]]);
  }
});

test('dragging each selected side port connects without requiring hover or resizing the shape', () => {
  for (const [anchor, x, y] of [['top', 160, 100], ['right', 220, 140], ['bottom', 160, 180], ['left', 100, 140]]) {
    const { engine, drag } = setup([source, target]);
    drag(150, 130, 150, 130); // Select; pointer-up clears hover state.
    drag(x, y, 500, 340);
    expect(engine.getElements().find(el => el.id === 'source')).toEqual(source);
    const connector = engine.getElements().find(el => el.type === 'arrow');
    expect(connector?.startBinding).toEqual({ elementId: 'source', anchor });
    expect(connector?.endBinding).toEqual({ elementId: 'target', anchor: 'left' });
    engine.undo(); expect(engine.getElements()).toHaveLength(2); engine.destroy();
  }
});

test('corner dragging still resizes and moves attached connectors to the new port', () => {
  const { engine, drag } = setup();
  drag(150, 130, 150, 130);
  drag(225, 185, 265, 215);
  const resized = engine.getElements().find(el => el.id === 'source');
  const connector = engine.getElements().find(el => el.id === 'arrow');
  expect(resized.width).toBeGreaterThan(source.width); expect(resized.height).toBeGreaterThan(source.height);
  expect([connector.startX, connector.startY]).toEqual([resized.x + resized.width, resized.y + resized.height / 2]);
  expect(engine.getElements()).toHaveLength(3); engine.destroy();
});

test('corner resize wins over nearby ports on a small shape', () => {
  const small = { ...source, width: 12, height: 12 };
  const { engine, listeners, point, drag } = setup([small]); engine.selectAll();
  listeners.pointermove(point(95, 95));
  drag(95, 95, 75, 75);
  expect(engine.getElements()).toHaveLength(1);
  expect(engine.getElements()[0].width).toBeGreaterThan(small.width); engine.destroy();
});

test('frames keep side resizing because they have no connector controls', () => {
  const frame = { ...source, type: 'frame', title: 'Group' };
  const squares = [];
  const ctx = new Proxy({ rect: (...args) => squares.push(args) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  drawSelection(ctx, frame, 1); expect(squares).toHaveLength(8);
  const { engine, drag } = setup([frame]); engine.selectAll(); drag(225, 140, 265, 140);
  expect(engine.getElements()[0].width).toBeGreaterThan(frame.width);
  expect(engine.getElements()[0].height).toBe(frame.height); engine.destroy();
});


test('all four selection edges resize on one axis while attachments and undo remain correct', () => {
  for (const [, from, to, expected, cursor] of [
    ['top', [130, 95], [130, 70], { x: 100, y: 75, width: 120, height: 105 }, 'ns-resize'],
    ['bottom', [130, 185], [130, 210], { x: 100, y: 100, width: 120, height: 105 }, 'ns-resize'],
    ['left', [95, 120], [70, 120], { x: 75, y: 100, width: 145, height: 80 }, 'ew-resize'],
    ['right', [225, 120], [250, 120], { x: 100, y: 100, width: 145, height: 80 }, 'ew-resize'],
  ]) {
    const { engine, listeners, point, drag } = setup();
    drag(150, 130, 150, 130);
    listeners.pointermove(point(...from));
    expect(engine.canvas.style.cursor).toBe(cursor);
    drag(...from, ...to);
    const resized = engine.getElements().find(el => el.id === 'source');
    const linked = engine.getElements().find(el => el.id === 'arrow');
    expect(resized).toMatchObject(expected);
    expect([linked.startX, linked.startY]).toEqual([resized.x + resized.width, resized.y + resized.height / 2]);
    expect(engine.getElements()).toHaveLength(3);
    engine.undo(); expect(engine.getElements().find(el => el.id === 'source')).toEqual(source);
    engine.redo(); expect(engine.getElements().find(el => el.id === 'source')).toMatchObject(expected);
    engine.destroy();
  }
});

test('side resizing and connector hit areas keep the same screen reach at different zoom levels', () => {
  for (const zoom of [0.5, 1, 2]) {
    const { engine, drag } = setup([source]); engine.selectAll(); engine.setZoom(zoom, { x: 0, y: 0 });
    const from = engine.canvasToScreen(130, 100 - 5 / zoom);
    const to = engine.canvasToScreen(130, 70);
    drag(from.x, from.y, to.x, to.y);
    expect(engine.getElements()[0]).toMatchObject({ y: 70 + 5 / zoom, width: 120, height: 110 - 5 / zoom });
    engine.undo();
    const port = engine.canvasToScreen(160, 100);
    const destination = engine.canvasToScreen(350, 250);
    drag(port.x, port.y, destination.x, destination.y);
    const connector = engine.getElements().find(el => el.type === 'arrow');
    expect(connector?.startBinding).toEqual({ elementId: 'source', anchor: 'top' });
    expect(engine.getElements().find(el => el.id === 'source')).toEqual(source); engine.destroy();
  }
});


test('resize dragging follows displacement without jumping from the padded handle', () => {
  for (const zoom of [0.5, 1, 2]) {
    const { engine, drag } = setup([source]); engine.selectAll(); engine.setZoom(zoom, { x: 0, y: 0 });
    const from = engine.canvasToScreen(220 + 5 / zoom, 180 + 5 / zoom);
    drag(from.x, from.y, from.x, from.y);
    expect(engine.getElements()[0]).toEqual(source); expect(engine.canUndo()).toBe(false);
    drag(from.x, from.y, from.x + 2 * zoom, from.y + 3 * zoom);
    expect(engine.getElements()[0]).toMatchObject({ x: 100, y: 100, width: 122, height: 83 }); engine.destroy();
  }
});

test('hovering an unselected shape does not hijack a move into a connector', () => {
  const { engine, listeners, point, drag } = setup([source, target]);
  listeners.pointermove(point(220, 140));
  expect(engine.hoveredAnchors).toHaveLength(0);
  drag(220, 140, 260, 180);
  expect(engine.getElements()).toHaveLength(2);
  expect(engine.getElements().find(el => el.id === 'source')).toMatchObject({ x: 140, y: 140 }); engine.destroy();
});

test('selected connector points paint only once and hovering other shapes stays quiet', () => {
  const { engine, listeners, point, drag } = setup([source, target]);
  engine.setGridType('none'); drag(150, 130, 150, 130);
  listeners.pointermove(point(220, 140));
  const circles = []; engine.ctx.arc = (...args) => circles.push(args);
  engine.render(); expect(circles).toHaveLength(4);
  listeners.pointermove(point(500, 340));
  expect(engine.hoveredAnchors).toHaveLength(0); expect(engine.canvas.style.cursor).toBe('move');
  engine.destroy();
});

test('freehand corner resize transforms the drawing points, not just its stored box', () => {
  const pencil = { ...base, id: 'sketch', type: 'pencil', x: 100, y: 100, width: 120, height: 80, points: [{ x: 100, y: 100 }, { x: 160, y: 140 }, { x: 220, y: 180 }] };
  const { engine, drag } = setup([pencil]); engine.selectAll();
  drag(225, 185, 265, 215);
  expect(engine.getElements()[0].points).toEqual([{ x: 100, y: 100 }, { x: 180, y: 155 }, { x: 260, y: 210 }]);
  expect(getElementBounds(engine.getElements()[0])).toEqual({ minX: 100, minY: 100, maxX: 260, maxY: 210 });
  engine.undo(); expect(engine.getElements()[0]).toEqual(pencil); engine.destroy();
});

test('text resizing sizes the glyphs and keeps the opposite side anchored', () => {
  const text = { ...base, id: 'text', type: 'text', x: 100, y: 100, width: 120, height: 27, text: 'Text sample', fontSize: 20, fontFamily: 'sans', textAlign: 'left' };
  const { engine, drag } = setup([text]); engine.selectAll();
  drag(95, 95, 35, 81.5);
  const resized = engine.getElements()[0];
  expect(resized.fontSize).toBe(30);
  expect(resized.x + resized.width).toBe(text.x + text.width);
  expect(resized.y + resized.height).toBe(text.y + text.height);
  expect(resized.height).toBeGreaterThan(text.height);
  engine.undo(); expect(engine.getElements()[0]).toEqual(text); engine.destroy();
});

test('document card ports attach to the visible card boundary', () => {
  const text = { ...base, id: 'doc', type: 'text', isDocCard: true, fill: '#18181B', x: 100, y: 100, width: 120, height: 54, text: 'Document', fontSize: 20, fontFamily: 'sans', textAlign: 'left' };
  expect(getElementAnchors(text)).toEqual([{ anchor: 'top', x: 160, y: 84 }, { anchor: 'right', x: 236, y: 127 }, { anchor: 'bottom', x: 160, y: 170 }, { anchor: 'left', x: 84, y: 127 }]);
  expect(getElementAnchors({ ...source, type: 'frame', title: 'Frame' })).toEqual([]);
});

test('cancelled drags restore local work while retaining peer additions', () => {
  for (const cancellation of ['pointercancel', 'lostpointercapture', 'Escape']) {
    const { engine, listeners, point } = setup([source, target]);
    listeners.pointerdown(point(150, 130)); listeners.pointermove(point(200, 180));
    const added = { ...source, id: 'peer-add', x: 750 };
    engine.applyRemoteElements([source, target, added]);
    if (cancellation === 'Escape') engine.onKeyDown({ key: 'Escape', code: 'Escape', target: null, shiftKey: false });
    else listeners[cancellation](point(200, 180));
    listeners.pointerup(point(200, 180));
    expect(engine.getElements()).toEqual([source, target, added]);
    expect(engine.gesture).toBeNull(); expect(engine.canUndo()).toBe(false); engine.destroy();
  }
});

test('cancelled draft and eraser gestures neither save ghost shapes nor discard deleted work', () => {
  const { engine, listeners, point } = setup([source]);
  engine.setTool('rectangle'); listeners.pointerdown(point(400, 300)); listeners.pointermove(point(500, 400)); listeners.pointercancel(point(500, 400));
  expect(engine.getElements()).toEqual([source]); expect(engine.draft).toBeNull();
  engine.setTool('eraser'); listeners.pointerdown(point(150, 130));
  expect(engine.getElements()).toHaveLength(0); listeners.pointercancel(point(150, 130));
  expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false); engine.destroy();
});

test('a second pointer cannot replace or finish the active drag', () => {
  const { engine, listeners, point } = setup([source]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(160, 140));
  listeners.pointerdown({ ...point(400, 400), pointerId: 2, isPrimary: false });
  listeners.pointermove({ ...point(600, 600), pointerId: 2, isPrimary: false });
  listeners.pointercancel({ ...point(600, 600), pointerId: 2 });
  listeners.lostpointercapture({ ...point(600, 600), pointerId: 2 });
  listeners.pointerup({ ...point(600, 600), pointerId: 2 });
  expect(engine.gesture?.kind).toBe('move');
  listeners.pointermove(point(180, 160)); listeners.pointerup(point(180, 160));
  expect(engine.getElements()[0]).toMatchObject({ x: 130, y: 130 }); engine.destroy();
});


test('changing tools cancels unfinished edits and releases pointer capture once', () => {
  const { engine, listeners, point } = setup([source]);
  let released = 0;
  engine.canvas.hasPointerCapture = () => true;
  engine.canvas.releasePointerCapture = id => { released++; listeners.lostpointercapture({ pointerId: id }); };
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(180, 160));
  engine.setTool('rectangle');
  expect(engine.getElements()).toEqual([source]); expect(engine.gesture).toBeNull();
  expect(released).toBe(1); expect(engine.getTool()).toBe('rectangle'); engine.destroy();
});

test('Space panning has priority over resize and connector hover cursors', () => {
  const { engine, listeners, point } = setup([source]); engine.selectAll();
  engine.spaceDown = true; listeners.pointermove(point(220, 140));
  expect(engine.canvas.style.cursor).toBe('grab'); expect(engine.hoveredAnchors).toHaveLength(0);
  listeners.pointerdown(point(220, 140)); listeners.pointermove(point(250, 170)); listeners.pointerup(point(250, 170));
  expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false); engine.destroy();
});


test('inserted icons have compact transparent bounds and no caption editor', () => {
  const { engine, listeners, point } = setup([]);
  engine.addOnlineIcon('cloud', 'lucide:cloud', '<path d="M0 0h24v24z"/>', '0 0 24 24');
  expect(engine.getElements()[0]).toMatchObject({ type: 'icon', width: 48, height: 48, fill: 'transparent', svgMarkup: '<path d="M0 0h24v24z"/>' });
  expect(engine.getElements()[0].label).toBeUndefined();
  let editor; engine.onStartInlineText = state => { editor = state; };
  listeners.dblclick(point(500, 350)); expect(editor).toMatchObject({ kind: 'new-text', canvasX: 500, canvasY: 350 });
  engine.addIconElement('arch-client'); expect(engine.getElements()[1]).toMatchObject({ width: 48, height: 48, fill: 'transparent' });
  engine.destroy();
});


test('double-click opens writing at the exact pointer on empty canvas, including zoom and pan', () => {
  const { engine, listeners, point } = setup([]); engine.setZoom(2, { x: 0, y: 0 });
  let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(450, 350));
  expect(editor).toMatchObject({ kind: 'new-text', canvasX: 225, canvasY: 175, screenX: 450, screenY: 350, align: 'left' });
  engine.commitInlineText({ ...editor, text: 'Write here' });
  expect(engine.getElements()[0]).toMatchObject({ x: 225, y: 175, text: 'Write here' }); engine.destroy();
});

test('double-click writing inside a shape stays attached through moving, resizing, duplicating and undo', () => {
  const { engine, listeners, point, drag } = setup([source]);
  let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(130, 120));
  expect(editor).toMatchObject({ screenX: 130, screenY: 120, canvasX: 130, canvasY: 120, containerId: 'source', containerOffset: { x: 0.25, y: 0.25 } });
  engine.commitInlineText({ ...editor, text: 'Attached' });
  drag(205, 160, 205, 160); drag(205, 160, 255, 200);
  let text = engine.getElements().find(el => el.type === 'text'); expect([text.x, text.y]).toEqual([180, 160]);
  engine.updateSelectedElement({ width: 240, height: 160 });
  text = engine.getElements().find(el => el.type === 'text'); expect([text.x, text.y]).toEqual([210, 180]);
  engine.duplicateSelected();
  const copiedShape = engine.getElements().filter(el => el.type === 'rectangle').find(el => el.id !== 'source');
  const copiedText = engine.getElements().filter(el => el.type === 'text').find(el => el.id !== text.id);
  expect(copiedText.containerId).toBe(copiedShape.id); expect(copiedText.text).toBe('Attached');
  engine.undo(); expect(engine.getElements()).toHaveLength(2); engine.destroy();
});

test('double-clicking existing text sets a caret at the click instead of selecting all content', () => {
  const text = { ...base, id: 'text', type: 'text', x: 100, y: 100, width: 150, height: 50, text: 'Hello world\nSecond line', fontSize: 20, fontFamily: 'sans', textAlign: 'left' };
  const { engine, listeners, point } = setup([text]); let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(121, 102)); expect(editor.caret).toBe(3);
  listeners.dblclick(point(114, 130)); expect(editor.caret).toBe(14); engine.destroy();
});

test('deleting or erasing a shape also removes its attached text in a single undo step', () => {
  const { engine, listeners, point, drag } = setup([source]);
  let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(130, 120)); engine.commitInlineText({ ...editor, text: 'Attached' });
  drag(205, 160, 205, 160); engine.deleteSelected(); expect(engine.getElements()).toHaveLength(0);
  engine.undo(); expect(engine.getElements()).toHaveLength(2);
  engine.setTool('eraser'); listeners.pointerdown(point(205, 160)); listeners.pointerup(point(205, 160));
  expect(engine.getElements()).toHaveLength(0); engine.undo(); expect(engine.getElements()).toHaveLength(2); engine.destroy();
});

test('alignment guides show during a drag, snap edges and disappear without entering saved scene data', () => {
  const alignedTarget = { ...target, x: 400, y: 100 };
  const { engine, listeners, point } = setup([source, alignedTarget]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(205, 133));
  expect(engine.guides.length).toBeGreaterThan(0);
  expect(engine.getElements().find(el => el.id === 'source').y).toBe(100);
  listeners.pointerup(point(205, 133)); expect(engine.guides).toEqual([]);
  expect(JSON.stringify(engine.getElements())).not.toContain('guides'); engine.destroy();
});

test('Alt dragging bypasses magnetic alignment while keeping live gap measurements', () => {
  const { engine, listeners, point } = setup([source, { ...target, x: 350, y: 100 }]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove({ ...point(205, 133), altKey: true });
  expect(engine.getElements().find(el => el.id === 'source').y).toBe(103);
  expect(engine.guides.some(guide => guide.label)).toBe(true);
  listeners.pointercancel(point(205, 133)); expect(engine.guides).toEqual([]); engine.destroy();
});


test('shape selection exports include attached text, and dragging text away detaches it', () => {
  const { engine, listeners, point, drag } = setup([source]); let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(130, 120)); engine.commitInlineText({ ...editor, text: 'Attached' });
  drag(205, 160, 205, 160); expect(engine.getSelectedElements()).toHaveLength(1); expect(engine.getSelectionForExport()).toHaveLength(2);
  engine.copySelection(); expect(engine.clipboard).toHaveLength(2);
  drag(140, 125, 140, 125);
  listeners.pointerdown(point(140, 125)); listeners.pointermove({ ...point(400, 250), altKey: true }); listeners.pointerup(point(400, 250));
  const text = engine.getElements().find(el => el.type === 'text'); expect(text.containerId).toBeUndefined();
  expect(text).toMatchObject({ x: 390, y: 245 }); engine.destroy();
});

test('sticky note caret placement accounts for visual wrapping', () => {
  const sticky = { ...base, id: 'sticky', type: 'sticky', x: 100, y: 100, width: 100, height: 140, text: 'aaaa bbbb cccc dddd', fontSize: 20, fontFamily: 'sans', textAlign: 'left', color: '#FEF08A' };
  const { engine, listeners, point } = setup([sticky]); let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(119, 140)); expect(editor.caret).toBe(11); engine.destroy();
});


test('double-clicking a legacy shape label opens at the pointer and migrates without losing text', () => {
  const labelled = { ...source, label: 'Existing label' };
  const { engine, listeners, point } = setup([labelled]); let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.dblclick(point(140, 130));
  expect(editor).toMatchObject({ kind: 'new-text', text: 'Existing label', canvasX: 140, canvasY: 130, screenX: 140, screenY: 130, replaceLabelId: source.id });
  engine.commitInlineText(editor);
  expect(engine.getElements().find(el => el.id === source.id).label).toBeUndefined();
  expect(engine.getElements().find(el => el.type === 'text')).toMatchObject({ text: 'Existing label', x: 140, y: 130, containerId: source.id });
  engine.undo(); expect(engine.getElements()).toEqual([labelled]); engine.destroy();
});

test('presentation is read-only for drawing, typing and deletion while preserving pan and viewport restoration', () => {
  const { engine, listeners, point } = setup([source]);
  const view = engine.getViewport(); engine.setTool('rectangle'); engine.setReadOnly(true);
  listeners.pointerdown(point(400, 400)); listeners.pointermove(point(450, 450)); listeners.pointerup(point(450, 450));
  expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false);
  let editor; engine.onStartInlineText = state => { editor = state; }; listeners.dblclick(point(500, 500)); expect(editor).toBeUndefined();
  engine.selectAll(); engine.onKeyDown({ key: 'Delete', code: 'Delete', target: null, shiftKey: false, preventDefault() {} }); expect(engine.getElements()).toEqual([source]);
  engine.restoreViewport(view); expect(engine.getViewport()).toEqual(view); engine.setReadOnly(false); engine.destroy();
});
test('search focusing selects the result and changes back to the selection tool', () => {
  const { engine } = setup([source, target]); engine.setTool('eraser'); engine.focusElements(['target']);
  expect(engine.getSelectedElements().map(el => el.id)).toEqual(['target']); expect(engine.getTool()).toBe('select');
  const point = engine.canvasToScreen(target.x + target.width / 2, target.y + target.height / 2);
  expect(point.x).toBeCloseTo(500); expect(point.y).toBeCloseTo(350); engine.destroy();
});
test('code tool creates an inline card at the click, supports live edits, blank code and undo', () => {
  const { engine, listeners, point } = setup([]); let opened;
  engine.onEditCode = id => { opened = id; }; engine.setTool('code');
  listeners.pointerdown(point(120, 180)); listeners.pointerup(point(120, 180));
  let card = engine.getElements()[0]; expect(opened).toBe(card.id); expect(card.isCodeCard).toBe(true); expect(card.text).toBe(""); expect([card.x, card.y]).toEqual([120, 180]);
  engine.updateCode(card.id, 'def hello():\n    print("hello")', 'python'); card = engine.getElements()[0];
  expect(card.codeLanguage).toBe('python'); expect(card.text).toContain('def hello');
  engine.updateCode(card.id, '', 'auto'); engine.finishCode(); expect(engine.getElements()).toHaveLength(1);
  engine.undo(); expect(engine.getElements()[0].text).toContain('def hello');
  engine.destroy();
});
test('document tool creates an empty note at the pointer without demo content',()=>{
 const {engine,listeners,point}=setup([]);
 engine.setTool('doc');listeners.pointerdown(point(350,250));
 const doc=engine.getElements()[0];expect(doc.isDocCard).toBe(true);expect(doc.text).toBe('');expect(doc.x).toBe(350);expect(doc.y).toBe(250);expect(doc.width).toBeGreaterThanOrEqual(240);expect(doc.height).toBeGreaterThanOrEqual(100);
 engine.commitInlineText({kind:'text',elementId:doc.id,text:'',fontSize:15,fontFamily:'sans',color:'#fff',align:'left',canvasX:350,canvasY:250});expect(engine.getElements()).toHaveLength(1);engine.destroy();
});
test('document title cannot overlap the first line and list text resets inherited center alignment',()=>{
 const calls=[];const ctx=new Proxy({textAlign:'center',measureText:t=>({width:t.length*7}),fillText(text,x,y){calls.push({text,x,y,align:this.textAlign});}}, {get:(o,k)=>k in o?o[k]:()=>{}});
 const doc={...base,id:'doc',type:'text',isDocCard:true,title:'Document Note',fill:'#18181B',x:100,y:100,width:240,height:100,fontSize:15,fontFamily:'sans',textAlign:'center',text:'Heading\n- list\n> quote'};
 drawElement(ctx,doc,{theme:'dark'});expect(calls.some(c=>c.text==='DOCUMENT NOTE')).toBe(false);expect(calls.find(c=>c.text==='list').align).toBe('left');expect(calls.find(c=>c.text==='quote').align).toBe('left');
});
