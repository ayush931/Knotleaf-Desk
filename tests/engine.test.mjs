import { beforeAll, afterAll, describe, test, expect } from 'bun:test';
import { CanvasEngine } from '../draw/CanvasEngine.ts';
import { boardToDrawio } from '../draw/drawioExport.ts';
import { FONT_OPTIONS, fontCssStack } from '../draw/fonts.ts';
import { TEMPLATES } from '../draw/templatesData.ts';
import { isValidElement } from '../lib/elementValidation.mjs';
import { unionBounds } from '../draw/renderer.ts';
import { setFont } from '../draw/renderer.ts';
import { computeArrowPath, computeLinePath, drawElement, layoutDocument, drawSelection, drawElementAnchors, getSelectionPadding, getElementAnchors, getElementBounds, textContentBounds, measureTextBlock } from '../draw/renderer.ts';
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
test('new sticky notes use the saved text size', () => {
  const { engine, listeners, point } = setup([]); engine.currentStyle.fontSize = 22; engine.setTool('sticky');
  listeners.pointerdown(point(100, 100)); expect(engine.getElements()[0].fontSize).toBe(22); engine.destroy();
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
for (const tool of ['rectangle', 'diamond', 'circle', 'arrow', 'line', 'frame']) {
  test(`${tool} returns to Select after creation and can be deselected normally`, () => {
    const { engine, drag, listeners, point } = setup([]); const tools = [];
    engine.onToolChange = tool => tools.push(tool);
    engine.setTool(tool); drag(100, 100, 180, 160);
    expect(engine.getTool()).toBe('select'); expect(tools.at(-1)).toBe('select');
    expect(engine.getSelectedElements()).toEqual([engine.getElements()[0]]);
    listeners.pointermove(point(750, 600)); expect(engine.getSelectedElements()).toHaveLength(1);
    // Clicking blank space clears the outline rather than making another shape.
    drag(500, 500, 500, 500); expect(engine.getSelectedElements()).toEqual([]); expect(engine.getElements()).toHaveLength(1);
    engine.setTool(tool); drag(300, 100, 380, 160);
    expect(engine.getTool()).toBe('select'); expect(engine.getSelectedElements()).toEqual([engine.getElements()[1]]);
    engine.undo(); expect(engine.getElements()).toHaveLength(1);
    engine.redo(); expect(engine.getElements()).toHaveLength(2); engine.destroy();
  });
  test(`cancelling ${tool} leaves the tool available to retry`, () => {
    const { engine, listeners, point } = setup([]); engine.setTool(tool);
    listeners.pointerdown(point(100, 100)); listeners.pointermove(point(180, 160)); listeners.pointercancel(point(180, 160));
    expect(engine.getTool()).toBe(tool); expect(engine.getElements()).toEqual([]); engine.destroy();
  });
}
for (const tool of ['text', 'doc', 'sticky']) {
  test(`${tool} returns to Select and keeps the finished element selected`, () => {
    const { engine, listeners, point } = setup([]); let editor;
    engine.onStartInlineText = state => { editor = state; };
    engine.setTool(tool); listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
    expect(engine.getTool()).toBe('select');
    engine.commitInlineText({ ...editor, text: 'First item' });
    expect(engine.getSelectedElements()).toEqual([engine.getElements()[0]]);
    engine.setTool(tool); listeners.pointerdown(point(500, 100)); listeners.pointerup(point(500, 100));
    engine.commitInlineText({ ...editor, text: 'Second item' });
    expect(engine.getTool()).toBe('select'); expect(engine.getElements().map(el => el.text)).toEqual(['First item', 'Second item']);
    engine.destroy();
  });
}
test('code and inserted icons return to Select while the eraser remains available', () => {
  const { engine, drag, listeners, point } = setup([]); let edited;
  engine.onEditCode = id => { edited = id; };
  engine.setTool('code'); listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
  engine.updateCode(edited, 'first()', 'javascript'); engine.finishCode(); expect(engine.getTool()).toBe('select');
  engine.setTool('rectangle'); engine.addOnlineIcon('Test', 'test', '<path d="M0 0h24v24z"/>', '0 0 24 24');
  expect(engine.getTool()).toBe('select'); expect(engine.getSelectedElements()[0].type).toBe('icon');
  engine.setTool('rectangle'); drag(700, 100, 780, 160); engine.setTool('eraser');
  listeners.pointerdown(point(740, 130)); listeners.pointermove(point(745, 130)); listeners.pointerup(point(745, 130));
  expect(engine.getTool()).toBe('eraser'); engine.destroy();
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
  engine.setTool('eraser'); listeners.pointerdown(point(150, 130)); listeners.pointermove(point(155, 130));
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


test('text clicks capture the sizing gesture and focus the editor on release', () => {
  const { engine, listeners, point, captures } = setup([]);
  engine.setTool('text');
  let suppressed = false, editor;
  const click = { ...point(350, 250), preventDefault() { suppressed = true; } };
  engine.onStartInlineText = state => { editor = state; };
  listeners.pointerdown(click);
  expect(suppressed).toBe(true); expect(captures).toHaveLength(1);
  expect(editor).toBeUndefined();
  listeners.pointerup(click); expect(editor?.kind).toBe('new-text');
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
    const pad = getSelectionPadding(source, zoom), half = 4 / zoom;
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
    drag(from.x, from.y, from.x + 4, from.y + 5);
    expect(engine.getElements()[0]).toMatchObject({ x: 100, y: 100, width: 120 + 4 / zoom, height: 80 + 5 / zoom }); engine.destroy();
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

test('document card ports sit at the outer selection boundary', () => {
  const text = { ...base, id: 'doc', type: 'text', isDocCard: true, fill: '#18181B', x: 100, y: 100, width: 120, height: 54, text: 'Document', fontSize: 20, fontFamily: 'sans', textAlign: 'left' };
  expect(getElementAnchors(text)).toEqual([{ anchor: 'top', x: 160, y: 76 }, { anchor: 'right', x: 244, y: 127 }, { anchor: 'bottom', x: 160, y: 178 }, { anchor: 'left', x: 76, y: 127 }]);
  expect(getElementAnchors({ ...source, type: 'frame', title: 'Frame' })).toEqual([]);
});

test('cancelled drags restore local work while retaining peer additions', () => {
  for (const cancellation of ['pointercancel', 'Escape']) {
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
  engine.setTool('eraser'); listeners.pointerdown(point(150, 130)); listeners.pointermove(point(155, 130));
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
  listeners.dblclick(point(500, 350)); expect(editor).toBeUndefined(); expect(engine.getSelectedElements()[0].type).toBe('icon');
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
  listeners.dblclick({ ...point(130, 120), altKey: true });
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
  listeners.dblclick({ ...point(130, 120), altKey: true }); engine.commitInlineText({ ...editor, text: 'Attached' });
  drag(205, 160, 205, 160); engine.deleteSelected(); expect(engine.getElements()).toHaveLength(0);
  engine.undo(); expect(engine.getElements()).toHaveLength(2);
  engine.setTool('eraser'); listeners.pointerdown(point(205, 160)); listeners.pointermove(point(210, 160)); listeners.pointerup(point(210, 160));
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
  listeners.dblclick({ ...point(130, 120), altKey: true }); engine.commitInlineText({ ...editor, text: 'Attached' });
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
  listeners.dblclick({ ...point(140, 130), altKey: true });
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


for (const tool of ['select', 'hand', 'rectangle', 'diamond', 'circle', 'arrow', 'line', 'pencil', 'frame']) {
  test(`double-click on a border selects existing content with ${tool} active`, () => {
    const { engine, listeners, point } = setup([source]);
    let editor; engine.onStartInlineText = state => { editor = state; };
    engine.setTool(tool);
    for (let i = 0; i < 2; i++) { listeners.pointerdown(point(130, 100)); listeners.pointerup(point(130, 100)); }
    listeners.dblclick(point(130, 100));
    expect(engine.getTool()).toBe('select');
    expect(engine.getSelectedElements().map(el => el.id)).toEqual(['source']);
    expect(engine.getElements()).toEqual([source]); expect(editor).toBeUndefined(); engine.destroy();
  });
}

test('line midpoint bending follows the pointer, hits the curve, and supports undo and reset', () => {
  const line = { ...base, id: 'line', type: 'line', x: 100, y: 100, width: 200, height: 0, startX: 100, startY: 100, endX: 300, endY: 100 };
  const { engine, listeners, point, drag } = setup([line]);
  listeners.dblclick(point(150, 100));
  drag(200, 100, 200, 160);
  let bent = engine.getElements()[0]; expect(bent.bendOffset).toBe(120);
  expect(computeLinePath(bent).midPt).toEqual({ x: 200, y: 160 });
  expect(getElementBounds(bent).maxY).toBeGreaterThanOrEqual(160);
  engine.setTool('pencil'); listeners.dblclick(point(200, 160));
  expect(engine.getSelectedElements()[0].id).toBe('line');
  drag(200, 160, 200, 60); expect(engine.getElements()[0].bendOffset).toBe(-80);
  engine.undo(); expect(engine.getElements()[0].bendOffset).toBe(120);
  engine.redo(); expect(engine.getElements()[0].bendOffset).toBe(-80);
  engine.updateSelectedElement({ bendOffset: 0 });
  expect(computeLinePath(engine.getElements()[0]).routing).toBe('straight');
  engine.destroy();
});

test('line bend survives moving endpoints and cancellation restores it', () => {
  const line = { ...base, id: 'line', type: 'line', x: 100, y: 100, width: 200, height: 0, startX: 100, startY: 100, endX: 300, endY: 100, bendOffset: 100 };
  const { engine, listeners, point, drag } = setup([line]); listeners.dblclick(point(200, 150));
  drag(300, 100, 350, 200); expect(engine.getElements()[0]).toMatchObject({ endX: 350, endY: 200, bendOffset: 100 });
  const mid = computeLinePath(engine.getElements()[0]).midPt;
  listeners.pointerdown(point(mid.x, mid.y)); listeners.pointermove(point(mid.x, mid.y + 70)); listeners.pointercancel(point(mid.x, mid.y + 70));
  expect(engine.getElements()[0].bendOffset).toBe(100); engine.destroy();
});


test('creation and erase tools respond synchronously over existing content without a double-click wait', () => {
  for (const tool of ['doc', 'sticky', 'code', 'text', 'eraser']) {
    const { engine, listeners, point } = setup([source]); let editor;
    engine.onStartInlineText = state => { editor = state; };
    engine.setTool(tool); listeners.pointerdown(point(130, 120));
    if (tool === 'eraser') expect(engine.getElements()).toEqual([]);
    else if (tool === 'text') expect(engine.gesture.kind).toBe('text-box');
    else expect(engine.getElements()).toHaveLength(2);
    listeners.pointerup(point(130, 120));
    if (tool === 'text') expect(editor.kind).toBe('new-text');
    expect(engine.getTool()).toBe(tool === 'eraser' ? 'eraser' : 'select'); engine.destroy();
  }
});

test('cancelling an immediate eraser gesture restores the original content without an undo entry', () => {
  const { engine, listeners, point } = setup([source]);
  engine.setTool('eraser'); listeners.pointerdown(point(130, 120));
  expect(engine.getElements()).toEqual([]);
  listeners.pointercancel(point(130, 120));
  expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false); engine.destroy();
});


test('bent lines paint and export their curve without arrowheads', () => {
  const line = { ...base, id: 'line', type: 'line', x: 100, y: 100, width: 200, height: 0, startX: 100, startY: 100, endX: 300, endY: 100, bendOffset: -80 };
  const curves = [];
  const ctx = new Proxy({ quadraticCurveTo: (...args) => curves.push(args) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  drawElement(ctx, line, { theme: 'dark' }); expect(curves).toContainEqual([200, 20, 300, 100]);
  const xml = boardToDrawio({ title: 'Curves', elements: [line] });
  expect(xml).toContain('curved=1;'); expect(xml).toContain('endArrow=none;'); expect(xml).toContain('<mxPoint x="200" y="20"/>');
});

for (const [type, extra, x, y] of [
  ['rectangle', {}, 130, 120], ['diamond', {}, 160, 140], ['circle', {}, 160, 140],
  ['frame', { title: 'Frame' }, 100, 150], ['sticky', { text: '', color: '#fff', fontSize: 20, fontFamily: 'sans' }, 130, 120],
  ['text', { text: 'Hello', fontSize: 20, fontFamily: 'sans', textAlign: 'left' }, 130, 120],
  ['pencil', { points: [{ x: 100, y: 100 }, { x: 200, y: 180 }] }, 150, 140],
  ['line', { startX: 100, startY: 100, endX: 220, endY: 180 }, 160, 140],
  ['arrow', { startX: 100, startY: 100, endX: 220, endY: 180, routing: 'straight' }, 160, 140],
  ['icon', { iconName: 'cloud' }, 130, 120],
]) {
  test(`double-click selects ${type} elements from Pencil`, () => {
    const el = { ...source, ...extra, type };
    const { engine, listeners, point } = setup([el]); engine.setTool('pencil'); listeners.dblclick(point(x, y));
    expect(engine.getSelectedElements().map(el => el.id)).toEqual([source.id]); expect(engine.getTool()).toBe('select'); engine.destroy();
  });
}


test('a completed shape still paints its blue outline after the pointer moves away', () => {
  const { engine, drag, listeners, point } = setup([]);
  const outlines = [];
  engine.ctx.strokeRect = (...rect) => outlines.push({ rect, color: engine.ctx.strokeStyle });
  engine.setTool('rectangle'); drag(100, 100, 180, 160);
  listeners.pointermove(point(900, 650)); engine.draw();
  expect(outlines).toContainEqual({ rect: [97, 97, 86, 66], color: '#3B82F6' });
  expect(engine.getTool()).toBe('select');
  drag(500, 500, 500, 500); expect(engine.getSelectedElements()).toEqual([]);
  outlines.length = 0; engine.draw();
  expect(outlines).not.toContainEqual({ rect: [97, 97, 86, 66], color: '#3B82F6' });
  engine.destroy();
});


test('a newly drawn shape immediately exposes its normal connector ports', () => {
  const { engine, drag } = setup([target]);
  engine.setTool('rectangle'); drag(100, 100, 220, 180);
  const created = engine.getSelectedElements()[0];
  expect(engine.getTool()).toBe('select');
  const ports = []; engine.ctx.arc = (x, y, r) => ports.push([x, y, r]); engine.draw();
  for (const port of getElementAnchors(created)) expect(ports.some(([x, y]) => x === port.x && y === port.y)).toBe(true);
  drag(220, 140, 500, 340);
  const connector = engine.getElements().find(el => el.type === 'arrow');
  expect(connector.startBinding).toEqual({ elementId: created.id, anchor: 'right' });
  expect(connector.endBinding).toEqual({ elementId: target.id, anchor: 'left' });
  expect(engine.getSelectedElements()[0].id).toBe(connector.id);
  engine.destroy();
});

test('Fill tool colors shapes, freehand interiors, text and connectors with undo', () => {
  const pencil = { ...source, type: 'pencil', id: 'pencil', points: [{ x: 300, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 100 }], x: 300, width: 100, height: 100 };
  const line = { ...source, id: 'line', type: 'line', startX: 500, startY: 100, endX: 600, endY: 100, x: 500, width: 100, height: 0 };
  const { engine, listeners, point } = setup([source, pencil, line]); engine.currentStyle.fill = '#ec4899';
  for (const [x, y, id, field] of [[150, 130, 'source', 'fill'], [350, 150, 'pencil', 'fill'], [550, 100, 'line', 'stroke']]) {
    engine.setTool('fill'); listeners.pointerdown(point(x, y)); listeners.pointerup(point(x, y));
    expect(engine.getElements().find(el => el.id === id)[field]).toBe('#ec4899'); expect(engine.getTool()).toBe('select'); expect(engine.getSelectedElements()[0].id).toBe(id);
  }
  engine.undo(); expect(engine.getElements().find(el => el.id === 'line').stroke).toBe('#fff'); engine.destroy();
});
test('color picking updates drawing color without introducing a fill without changing the board', () => {
  const colored = { ...source, fill: '#10b981', fillStyle: 'solid' };
  const { engine, listeners, point } = setup([colored]); let picked; engine.onPickColor = c => { picked = c; };
  engine.setTool('eyedropper'); listeners.pointerdown(point(150, 130)); listeners.pointerup(point(150, 130));
  expect(picked).toBe('#10b981'); expect(engine.currentStyle).toMatchObject({ fill: 'transparent', stroke: picked, fillStyle: 'none' }); expect(engine.canUndo()).toBe(false); engine.destroy();
});
test('image insertion uses normal selection, movement, resize, undo and portable source data', () => {
  const { engine, drag } = setup([]); const source = 'data:image/png;base64,iVBORw0KGgo=';
  engine.addImage(source, 100, 80); expect(engine.getTool()).toBe('select');
  const image = engine.getSelectedElements()[0]; expect(image).toMatchObject({ type: 'image', source, width: 100, height: 80 });
  drag(500, 350, 550, 400); expect(engine.getElements()[0]).toMatchObject({ x: image.x + 50, y: image.y + 50 });
  engine.updateSelectedElement({ width: 200, height: 160 }); expect(engine.getElements()[0].source).toBe(source);
  engine.undo(); expect(engine.getElements()[0].width).toBe(100);
  expect(() => engine.addImage('https://example.com/x.png', 100, 80)).toThrow(); engine.destroy();
});


test('new shapes inherit patterned fill opacity while stroke opacity remains independent', () => {
  const { engine, drag } = setup([]); engine.currentStyle = { ...engine.currentStyle, fill: '#3b82f6', fillStyle: 'dots', fillOpacity: 0.2, opacity: 0.9 };
  engine.setTool('rectangle'); drag(100, 100, 220, 180);
  expect(engine.getSelectedElements()[0]).toMatchObject({ fill: '#3b82f6', fillStyle: 'dots', fillOpacity: 0.2, opacity: 0.9 });
  engine.updateSelectedElement({ fillOpacity: 0 }); expect(engine.getElements()[0].opacity).toBe(0.9);
  engine.undo(); expect(engine.getElements()[0].fillOpacity).toBe(0.2); engine.destroy();
});


test('Pencil stays active between strokes, pointer departure, cancellation and undo without selection outlines', () => {
  const { engine, drag, listeners, point } = setup([]); const outlines = [];
  engine.ctx.strokeRect = (...rect) => outlines.push({ rect, color: engine.ctx.strokeStyle });
  engine.setTool('pencil'); drag(100, 100, 180, 160); listeners.pointermove(point(900, 650)); engine.draw();
  expect(engine.getTool()).toBe('pencil'); expect(engine.getSelectedElements()).toEqual([]);
  expect(outlines.some(outline => outline.color === '#3B82F6')).toBe(false);
  drag(300, 100, 380, 160); expect(engine.getElements()).toHaveLength(2); expect(engine.getTool()).toBe('pencil');
  listeners.pointerdown(point(500, 100)); listeners.pointermove(point(580, 160)); listeners.pointercancel(point(580, 160));
  expect(engine.getElements()).toHaveLength(2); expect(engine.getTool()).toBe('pencil');
  engine.undo(); expect(engine.getElements()).toHaveLength(1); engine.redo(); expect(engine.getElements()).toHaveLength(2);
  expect(engine.getSelectedElements()).toEqual([]); expect(engine.getTool()).toBe('pencil');
  listeners.dblclick(point(140, 130)); expect(engine.getTool()).toBe('select'); expect(engine.getSelectedElements()[0].type).toBe('pencil');
  engine.destroy();
});

for (const type of ['rectangle', 'diamond', 'circle']) {
  test(`double-click inside ${type} opens attached text, while its border only selects`, () => {
    const shape = { ...source, type }; const { engine, listeners, point } = setup([shape]); let editor;
    engine.onStartInlineText = value => { editor = value; }; engine.setTool('pencil');
    listeners.dblclick(point(160, 140)); expect(editor).toMatchObject({ kind: 'new-text', containerId: 'source', canvasX: 160, canvasY: 140 });
    engine.commitInlineText({ ...editor, text: 'Inside shape' });
    const text = engine.getElements().find(el => el.type === 'text'); expect(text.containerId).toBe('source');
    editor = undefined; engine.setTool('select'); listeners.dblclick(point(160, 100));
    expect(editor).toBeUndefined(); expect(engine.getSelectedElements()[0].id).toBe('source');
    engine.setTool('pencil'); listeners.dblclick(point(text.x + 2, text.y + 2)); expect(editor).toMatchObject({ kind: 'text', elementId: text.id, text: 'Inside shape' });
    engine.destroy();
  });
}
test('shape border exclusion scales with zoom and does not mistake diamond corners for interior', () => {
  const { engine, listeners, point } = setup([source]); let editor; engine.onStartInlineText = state => { editor = state; };
  engine.setZoom(2, { x: 0, y: 0 }); listeners.dblclick(point(208, 240)); expect(editor).toBeUndefined();
  listeners.dblclick(point(230, 240)); expect(editor.containerId).toBe('source'); engine.destroy();
});

test('text connectors remain outside the tight selection outline at every zoom', () => {
  const text = { ...base, id: 'plain', type: 'text', x: 100, y: 100, width: 120, height: 32.4, text: 'Text', fontSize: 24, fontFamily: 'sans', textAlign: 'left' };
  for (const zoom of [0.5, 1, 2, 3]) {
    const { engine, drag } = setup([text]); engine.selectAll(); engine.setZoom(zoom, { x: 0, y: 0 });
    const boxes = []; engine.ctx.strokeRect = (...box) => boxes.push(box); engine.draw();
    const pad = getSelectionPadding(text, zoom);
    expect(boxes).toContainEqual([100 - pad, 100 - pad, 120 + pad * 2, 32.400000000000006 + pad * 2]);
    const ports = getElementAnchors(text); expect(ports.find(p => p.anchor === 'right')).toEqual({ anchor: 'right', x: 228, y: 116.2 });
    const from = engine.canvasToScreen(228, 116.2), to = engine.canvasToScreen(400, 200); drag(from.x, from.y, to.x, to.y);
    expect(engine.getElements().find(el => el.type === 'arrow')).toMatchObject({ startX: 228, startY: 116.2, startBinding: { elementId: 'plain', anchor: 'right' } }); engine.destroy();
  }
});
test('older text bindings reconcile to the new outside ports without moving text', () => {
  const text = { ...base, id: 'plain', type: 'text', x: 100, y: 100, width: 120, height: 27, text: 'Text', fontSize: 20, fontFamily: 'sans', textAlign: 'left' };
  const bound = { ...arrow, startX: 220, startY: 113.5, startBinding: { elementId: 'plain', anchor: 'right' }, endBinding: undefined };
  const { engine } = setup([text, bound]); expect(engine.getElements()[0]).toEqual(text); expect(engine.getElements()[1]).toMatchObject({ startX: 228, startY: 113.5 });
  engine.applyRemoteElements([text, bound]); expect(engine.getElements()[1].startX).toBe(228); engine.destroy();
});

test('Alt-drag duplicates a selection with attached text and internally rebound connectors in one undo', () => {
  const text = { ...base, id: 'attached', type: 'text', x: 130, y: 120, width: 80, height: 20, text: 'Label', fontSize: 15, fontFamily: 'sans', textAlign: 'left', containerId: source.id, containerOffset: { x: .25, y: .25 } };
  const original = [source, target, arrow, text], { engine, listeners, point } = setup(original); engine.selectAll();
  listeners.pointerdown({ ...point(150, 150), altKey: true }); listeners.pointermove({ ...point(250, 250), altKey: true }); listeners.pointerup({ ...point(250, 250), altKey: true });
  expect(engine.getElements()).toHaveLength(8); for (const el of original) expect(engine.getElements().find(item => item.id === el.id)).toEqual(el);
  const copies = engine.getSelectedElements(), copiedSource = copies.find(el => el.type === 'rectangle' && el.x === 200), copiedTarget = copies.find(el => el.type === 'rectangle' && el.x === 600);
  expect(copies.find(el => el.type === 'text')).toMatchObject({ containerId: copiedSource.id, x: 230, y: 220 });
  expect(copies.find(el => el.type === 'arrow')).toMatchObject({ startBinding: { elementId: copiedSource.id, anchor: 'right' }, endBinding: { elementId: copiedTarget.id, anchor: 'left' } });
  engine.undo(); expect(engine.getElements()).toEqual(original); engine.redo(); expect(engine.getElements()).toHaveLength(8); engine.destroy();
});
test('Alt-click and tiny pointer jitter do not duplicate, and cancellation restores original selection', () => {
  const { engine, listeners, point } = setup([source]); engine.selectAll();
  const alt = (x,y) => ({ ...point(x,y), altKey: true });
  listeners.pointerdown(alt(150,150)); listeners.pointermove(alt(151,151)); listeners.pointerup(alt(151,151)); expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false);
  listeners.pointerdown(alt(150,150)); listeners.pointermove(alt(210,210)); expect(engine.getElements()).toHaveLength(2);
  listeners.pointercancel(alt(210,210)); expect(engine.getElements()).toEqual([source]); expect(engine.getSelectedElements()).toEqual([source]); expect(engine.canUndo()).toBe(false); engine.destroy();
});

test('physical Shift+1 and Shift+2 keys fit content or selection without altering artwork or tool', () => {
  const { engine, listeners, point } = setup([source, { ...target, x: 2000 }]); engine.resize(1000,700);
  listeners.pointerdown(point(140,150)); listeners.pointerup(point(140,150));
  const selected = engine.getSelectedElements(), elements = engine.getElements();
  let prevented=0;engine.onKeyDown({key:'@',code:'Digit2',shiftKey:true,preventDefault(){prevented++;}});
  const zoom=engine.getZoom();expect(zoom).toBeGreaterThan(1);expect(engine.getSelectedElements()).toEqual(selected);expect(engine.getTool()).toBe('select');
  engine.onKeyDown({key:'!',code:'Digit1',shiftKey:true,preventDefault(){prevented++;}});expect(engine.getZoom()).toBeLessThan(zoom);expect(prevented).toBe(2);expect(engine.getElements()).toEqual(elements);engine.destroy();
});


for (const template of TEMPLATES) {
  test(`template ${template.id} fits centered, with attached labels and valid connections`, () => {
    const original = JSON.stringify(template);
    const { engine } = setup([]);
    engine.restoreViewport({ zoom: 3, pan: { x: -12000, y: 6400 } });
    const ids = engine.insertTemplate(template.elements);
    const elements = engine.getElements();
    expect(ids).toHaveLength(template.elements.length);
    expect(elements.every(isValidElement)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some(id => template.elements.some(el => el.id === id))).toBe(false);
    for (const element of elements) {
      for (const binding of [element.startBinding, element.endBinding]) if (binding) expect(ids).toContain(binding.elementId);
      if (element.type === 'text' && element.containerId) {
        const parent = elements.find(el => el.id === element.containerId);
        expect(parent).toBeTruthy(); expect(element.fill).toBe('transparent');
        expect(element.x + element.width / 2).toBeCloseTo(parent.x + parent.width / 2, 5);
        expect(element.y + element.height / 2).toBeCloseTo(parent.y + parent.height / 2, 5);
        expect(element.width).toBeLessThanOrEqual(parent.width - 16);
        expect(element.height).toBeLessThanOrEqual(parent.height - 16);
      }
    }
    const bounds = unionBounds(elements.map(el => getElementBounds(el, elements)));
    const { zoom, pan } = engine.getViewport();
    expect((bounds.minX + bounds.maxX) / 2 * zoom + pan.x).toBeCloseTo(500, 5);
    expect((bounds.minY + bounds.maxY) / 2 * zoom + pan.y).toBeCloseTo(350, 5);
    expect(bounds.minX * zoom + pan.x).toBeGreaterThanOrEqual(47.99);
    expect(bounds.maxX * zoom + pan.x).toBeLessThanOrEqual(952.01);
    expect(bounds.minY * zoom + pan.y).toBeGreaterThanOrEqual(79.99);
    expect(bounds.maxY * zoom + pan.y).toBeLessThanOrEqual(620.01);
    expect(JSON.stringify(template)).toBe(original);
    engine.undo(); expect(engine.getElements()).toHaveLength(0);
    engine.redo(); expect(engine.getElements()).toEqual(elements); engine.destroy();
  });
}
test('repeated template insertion preserves existing artwork, creates isolated bindings, and replaces in one undo step', () => {
  const { engine } = setup([source]);
  const template = TEMPLATES[0];
  const first = engine.insertTemplate(template.elements);
  const before = structuredClone(engine.getElements());
  const second = engine.insertTemplate(template.elements);
  const all = engine.getElements();
  expect(all.slice(0, before.length)).toEqual(before);
  expect(second.some(id => first.includes(id))).toBe(false);
  const existing = unionBounds(before.map(el => getElementBounds(el, before)));
  const added = all.filter(el => second.includes(el.id));
  const bounds = unionBounds(added.map(el => getElementBounds(el, all)));
  expect(bounds.minX - existing.maxX).toBeCloseTo(96, 5);
  for (const el of added) for (const binding of [el.startBinding, el.endBinding]) if (binding) expect(second).toContain(binding.elementId);
  const replaced = engine.insertTemplate(TEMPLATES[2].elements, true);
  expect(engine.getElements().map(el => el.id)).toEqual(replaced);
  engine.undo(); expect(engine.getElements()).toEqual(all);
  engine.redo(); expect(engine.getElements().map(el => el.id)).toEqual(replaced);
  engine.destroy();
});
test('template fitting honors narrow screens and explicitly opened inspector space', () => {
  const { engine } = setup([]);
  const ids = engine.insertTemplate(TEMPLATES[0].elements);
  for (const [width, height, left] of [[390, 750, 48], [1280, 750, 320]]) {
    engine.resize(width, height); engine.focusElements(ids, false, { left, right: 48, top: 90, bottom: 80 });
    const all = engine.getElements(), bounds = unionBounds(all.map(el => getElementBounds(el, all)));
    const { zoom, pan } = engine.getViewport();
    expect(bounds.minX * zoom + pan.x).toBeGreaterThanOrEqual(left - .01);
    expect(bounds.maxX * zoom + pan.x).toBeLessThanOrEqual(width - 47.99);
    expect((bounds.minX + bounds.maxX) / 2 * zoom + pan.x).toBeCloseTo((width + left - 48) / 2, 5);
  }
  engine.destroy();
});

function recordedShape(element) {
  const paths = [], ctx = new Proxy({ lineWidth: 2, globalAlpha: 1,
    beginPath() { paths.push([]); }, moveTo(...p) { paths.at(-1).push(['M', ...p]); },
    quadraticCurveTo(...p) { paths.at(-1).push(['Q', ...p]); }, closePath() { paths.at(-1).push(['Z']); },
    stroke() {}, measureText: text => ({ width: text.length * 7 }),
  }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  drawElement(ctx, element, { theme: 'dark' }); return paths.filter(path => path.length);
}
for (const type of ['rectangle', 'diamond']) {
  test(`rough ${type} keeps every vertex, closes both passes, and remains stable across redraws`, () => {
    for (const [width, height] of [[240, 120], [-240, -120], [8, 6], [600, 24]]) {
      const element = { ...base, id: 'rough-shape', type, x: 50, y: 60, width, height, strokeStyle: 'rough', roundness: 'sharp' };
      const paths = recordedShape(element); expect(paths).toHaveLength(2);
      const x = Math.min(50, 50 + width), y = Math.min(60, 60 + height), w = Math.abs(width), h = Math.abs(height);
      const vertices = type === 'rectangle' ? [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] : [[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
      for (const path of paths) {
        const endpoints = path.filter(op => op[0] === 'M' || op[0] === 'Q').map(op => op.slice(-2));
        for (const vertex of vertices) expect(endpoints.some(p => Math.hypot(p[0]-vertex[0],p[1]-vertex[1]) < 1e-8)).toBe(true);
        expect(path.at(-1)).toEqual(['Z']); expect(endpoints.at(-1)).toEqual(endpoints[0]);
        expect(path.flat().filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
      }
      expect(recordedShape(element)).toEqual(paths);
    }
  });
}
test('rough rounded rectangles keep equal corner radii including the starting seam', () => {
  for (const size of [8, 24, 120]) {
    const el = { ...base, id: 'rounded', type: 'rectangle', x: 0, y: 0, width: size * 2, height: size, strokeStyle: 'rough' };
    const radius = Math.min(12, el.width/4, el.height/4);
    const paths = recordedShape(el);
    for (const path of paths) {
      const endpoints = path.filter(op => op[0] === 'M' || op[0] === 'Q').map(op => op.slice(-2));
      for (const [x,y] of [[radius,0],[el.width-radius,0],[el.width,radius],[el.width,el.height-radius],[el.width-radius,el.height],[radius,el.height],[0,el.height-radius],[0,radius]]) {
        expect(endpoints.some(p => Math.hypot(p[0]-x,p[1]-y)<1e-8)).toBe(true);
      }
      expect(endpoints.some(p => Math.hypot(...p)<radius*.25)).toBe(false);
      expect(path.at(-1)).toEqual(['Z']);
    }
    expect(paths).not.toEqual(recordedShape({ ...el, roundness: 'sharp' }));
  }
});
test('rough ellipses have two closed seams at every aspect ratio', () => {
  for(const [width,height] of [[200,200],[400,40],[6,8]]) {
    const paths=recordedShape({...base,id:'ellipse',type:'circle',x:0,y:0,width,height,strokeStyle:'rough'});
    expect(paths).toHaveLength(2);
    for(const path of paths){expect(path.at(-1)).toEqual(['Z']);expect(path.filter(op=>op[0]==='Q').at(-1).slice(-2)).toEqual(path[0].slice(-2));}
  }
});


test('free text measurement does not impose a two-character minimum or hidden right margin', () => {
  const ctx = { measureText: text => ({ width: text.length * 5 }) };
  for (const text of ['i', 'Hello', 'a\nlonger']) {
    const size=measureTextBlock(ctx,text,24,'sans'); expect(size.width).toBe(Math.max(...text.split('\n').map(line=>line.length))*5);
  }
});
test('visible text bounds ignore oversized alignment boxes, empty lines and line-height slack, while honoring italic and underline ink', () => {
  const ctx={save(){},restore(){},measureText(text){const w=text.length*10, anchor=this.textAlign==='center'?w/2:this.textAlign==='right'?w:0;return {width:w,actualBoundingBoxLeft:anchor+2,actualBoundingBoxRight:w-anchor+1,actualBoundingBoxAscent:-4,actualBoundingBoxDescent:21};}};
  const el={...base,id:'tight',type:'text',x:100,y:200,width:800,height:500,text:'Hello\nHi\n',fontSize:24,fontFamily:'sans',textAlign:'left'};
  expect(textContentBounds(ctx,el)).toEqual({minX:98,maxX:151,minY:204,maxY:253.4});
  expect(textContentBounds(ctx,{...el,text:'Hi',textAlign:'center'})).toEqual({minX:488,maxX:511,minY:204,maxY:221});
  expect(textContentBounds(ctx,{...el,text:'Hi',textAlign:'right'})).toEqual({minX:878,maxX:901,minY:204,maxY:221});
  expect(textContentBounds(ctx,{...el,text:'Hi',underline:true}).maxY).toBeGreaterThan(225);
});


test('Rounded works for kite/diamond shapes in Clean and Rough styles at every aspect ratio', () => {
  for(const [width,height] of [[200,120],[120,200],[300,24],[24,300],[8,8],[-200,-120]]) {
    const el={...base,id:'kite',type:'diamond',x:300,y:300,width,height,roundness:'rounded'};
    const arcs=[];const ctx=new Proxy({arcTo(...args){arcs.push(args);},measureText:()=>({width:0})},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
    drawElement(ctx,el,{theme:'dark'});expect(arcs).toHaveLength(4);
    expect(arcs.every(arc=>arc.every(Number.isFinite)&&arc[4]>0&&arc[4]<=12)).toBe(true);
    expect(new Set(arcs.map(arc=>arc[4])).size).toBe(1);
    const rough={...el,strokeStyle:'rough'},paths=recordedShape(rough),sharp=recordedShape({...rough,roundness:'sharp'});
    expect(paths).not.toEqual(sharp);expect(paths).toHaveLength(2);
    const x=Math.min(el.x,el.x+width),y=Math.min(el.y,el.y+height),w=Math.abs(width),h=Math.abs(height);
    for(const path of paths){
      const endpoints=path.filter(op=>op[0]==='M'||op[0]==='Q').map(op=>op.slice(-2));
      for(const [vx,vy]of[[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]])expect(endpoints.some(p=>Math.hypot(p[0]-vx,p[1]-vy)<1e-6)).toBe(false);
      const inset=Math.min(12,w/4,h/4);
      expect(Math.max(...endpoints.map(p=>p[0]))).toBeGreaterThanOrEqual(x+w-inset-1e-5);
      expect(Math.min(...endpoints.map(p=>p[0]))).toBeLessThanOrEqual(x+inset+1e-5);
      expect(path.at(-1)).toEqual(['Z']);expect(path.flat().filter(v=>typeof v==='number').every(Number.isFinite)).toBe(true);
    }
  }
});


test('switching the black canvas among Solid, Hatch, Crosshatch and Dots always paints a black base', () => {
 const {engine}=setup([]);engine.setGridType('none');
 for(const fillStyle of ['solid','hachure','crosshatch','dots']) {
  const paints=[];engine.ctx.fill=function(){paints.push({fill:this.fillStyle,alpha:this.globalAlpha});};engine.ctx.globalAlpha=1;
  engine.setBackground({fill:'#121212',fillStyle,fillOpacity:1});engine.draw();
  expect(paints[0]).toEqual({fill:'#121212',alpha:1});
 }
 engine.destroy();
});

test('local uploads preserve original bytes, are centered, and undo as one operation', () => {
  const {engine,drag}=setup([]);
  const image='data:image/png;base64,iVBORw0KGgo=';
  const attachment={name:'notes.txt',mimeType:'text/plain',size:5,source:'data:application/octet-stream;base64,aGVsbG8='};
  const ids=engine.addAssets([{kind:'image',source:image,width:6000,height:3000,name:'original.png'},{kind:'attachment',attachment}]);
  expect(ids).toHaveLength(2);expect(engine.getElements().every(el=>el.localOnly&&isValidElement(el))).toBe(true);
  const uploaded=engine.getElements();expect(uploaded[0].width/uploaded[0].height).toBe(2);
  expect(uploaded[0].x+uploaded[0].width).toBeLessThan(uploaded[1].x);
  engine.undo();expect(engine.getElements()).toHaveLength(0);engine.redo();expect(engine.getElements()).toEqual(uploaded);
  engine.focusElements([ids[0]]);engine.restoreViewport({zoom:1,pan:{x:0,y:0}});const el=engine.getElements()[0];drag(el.x+10,el.y+10,el.x+50,el.y+40);
  expect(engine.getElements()[0].source).toBe(image);expect(engine.getElements()[1].attachment).toEqual(attachment);engine.destroy();
});
test('upload storage failure leaves the existing scene and undo history intact',()=>{
  const{engine}=setup([source]);
  expect(()=>engine.addAssets([{kind:'attachment',attachment:{name:'empty.bin',mimeType:'application/octet-stream',size:0,source:'data:application/octet-stream;base64,'}}],undefined,()=>{throw Error('Quota');})).toThrow('Quota');
  expect(engine.getElements()).toEqual([source]);expect(engine.canUndo()).toBe(false);engine.destroy();
});
test('local images accept original sources above the old upload and dimension caps',()=>{
  const{engine}=setup([]);const image='data:image/png;base64,'+'AAAA'.repeat(1_000_001);
  engine.addAssets([{kind:'image',source:image,width:12000,height:6000,name:'large.png'}]);expect(isValidElement(engine.getElements()[0])).toBe(true);expect(engine.getElements()[0].source).toBe(image);engine.destroy();
});
for(const mode of ['all','drawings','objects'])test(`eraser ${mode} sweeps between pointer events and respects locked elements`,()=>{
 const line={...base,id:'line',type:'line',x:300,y:300,width:100,height:0,startX:300,startY:300,endX:400,endY:300};
 const shape={...source,x:500,y:260},locked={...source,id:'locked',x:700,y:260,isLocked:true};
 const{engine,drag}=setup([line,shape,locked]);engine.setTool('eraser');engine.setEraserOptions(40,mode);drag(200,300,900,300);
 expect(engine.getElements().map(el=>el.id)).toEqual(mode==='all'?['locked']:mode==='drawings'?['source','locked']:['line','locked']);
 engine.undo();expect(engine.getElements()).toEqual([line,shape,locked]);engine.redo();expect(engine.getElements()).toHaveLength(mode==='all'?1:2);engine.destroy();
});
test('eraser supports very large sizes without an application maximum',()=>{
 const{engine,drag}=setup([source]);engine.setTool('eraser');engine.setEraserOptions(1e9,'all');drag(900,600,901,601);expect(engine.getElements()).toHaveLength(0);engine.destroy();
});
test('presentation fits large frames with controls clear of slide content and preserves artwork',()=>{
 const frame={...source,type:'frame',id:'frame',title:'Large slide',x:100,y:100,width:30000,height:20000};
 const{engine}=setup([frame,source]);const before=engine.getViewport();engine.setReadOnly(true);engine.setPresentationFrame(frame.id);
 const view=engine.getViewport();expect(view.zoom).toBeLessThan(.1);
 const bottom=engine.canvasToScreen(frame.x+frame.width,frame.y+frame.height);expect(bottom.x).toBeLessThanOrEqual(976);expect(bottom.y).toBeLessThanOrEqual(612);
 engine.setPresentationFrame(null);engine.setReadOnly(false);engine.restoreViewport(before);expect(engine.getElements()).toEqual([frame,source]);expect(engine.getViewport()).toEqual(before);engine.destroy();
});

test('room undo orders local assets and shared edits without sending image bytes',async()=>{
 const{RoomSession}=await import('../lib/collaboration.ts');const session=new RoomSession('ws://127.0.0.1:1',crypto.randomUUID());session.synced=true;
 const{engine}=setup([]);let current=[];
 engine.collaborativeLocalHistory={state:()=>({undo:session.undo.undoStack.length,redo:session.undo.redoStack.length}),stop:()=>session.undo.stopCapturing(),clearRedo:()=>session.undo.clear(false,true)};
 engine.collaborativeUndo=()=>session.undo.undo();engine.collaborativeRedo=()=>session.undo.redo();
 engine.onChange=elements=>{current=elements;session.update({id:'test',title:'Board',elements,markdownNotes:''});};
 session.onRemote=elements=>engine.applyRemoteElements([...elements,...current.filter(el=>el.localOnly)].sort((a,b)=>a.zIndex-b.zIndex));
 try{
 const source='data:image/png;base64,aGVsbG8=';engine.addAssets([{kind:'image',source,width:200,height:100,name:'private.png'}]);expect(engine.getElements()).toHaveLength(1);expect(session.elements.size).toBe(0);
 engine.setElements([...engine.getElements(),{...base,id:'shape',type:'rectangle',x:600,y:300,width:100,height:100,zIndex:1}],true);expect(session.elements.size).toBe(1);
 engine.undo();expect(engine.getElements().map(el=>el.type)).toEqual(['image']);engine.undo();expect(engine.getElements()).toHaveLength(0);
 engine.redo();expect(engine.getElements().map(el=>el.type)).toEqual(['image']);engine.redo();expect(engine.getElements().map(el=>el.type)).toEqual(['image','rectangle']);
 engine.selectAll();engine.deleteSelected();expect(engine.getElements()).toHaveLength(0);engine.undo();expect(engine.getElements().map(el=>el.type)).toEqual(['image','rectangle']);engine.redo();expect(engine.getElements()).toHaveLength(0);expect(session.elements.size).toBe(0);
 }finally{engine.destroy();session.destroy();}
});


test('selection outlines leave a small gap outside content at all zoom levels',()=>{
 const elements=[source,{...source,type:'diamond'},{...source,type:'circle'},{...source,type:'frame',title:'Frame'},{...source,type:'image',source:'data:image/png;base64,aGVsbG8=',imageName:'Image'},{...source,type:'icon',iconId:'arch-client',width:48,height:48},{...source,type:'text',text:'Text',fontSize:20,fontFamily:'sans',isDocCard:false},{...source,type:'text',text:'Card',fontSize:20,fontFamily:'sans',isDocCard:true},{...source,type:'sticky',text:'Note',fontSize:20,fontFamily:'sans',color:'#fff'}];
 for(const element of elements)for(const zoom of [.25,1,3]){
  const rects=[],ctx=new Proxy({strokeRect:(...rect)=>rects.push(rect)},{get:(o,k)=>k in o?o[k]:()=>{}});const bounds=getElementBounds(element);drawSelection(ctx,element,zoom);
  const pad=getSelectionPadding(element,zoom);
  expect(pad*zoom).toBeGreaterThan(0);expect(pad*zoom).toBeLessThanOrEqual(3);
  expect(rects[0]).toEqual([bounds.minX-pad,bounds.minY-pad,bounds.maxX-bounds.minX+pad*2,bounds.maxY-bounds.minY+pad*2]);
 }
});
test('curved line bounds follow the visible curve rather than its distant control point',()=>{
 const line={...base,id:'curve',type:'line',x:0,y:0,width:100,height:0,startX:0,startY:0,endX:100,endY:0,bendOffset:100};
 expect(getElementBounds(line)).toEqual({minX:0,minY:0,maxX:100,maxY:50});
});


test('teaching highlighter stays transient, separates strokes, and never edits underlying content', () => {
  const { engine, listeners, point, drag } = setup([source]);
  const changes = [], packets = []; let edits = 0;
  engine.onChange = elements => changes.push(elements);
  engine.onHighlightChange = points => packets.push([...points]);
  engine.onStartInlineText = () => { edits++; };
  engine.setTool('highlighter'); drag(120, 120, 200, 150); drag(300, 300, 320, 320);
  listeners.dblclick(point(150, 140));
  expect(packets.flat().some(p => p.x === 120 && p.start)).toBe(true);
  expect(packets.at(-1).filter(p => p.start)).toHaveLength(2);
  expect(engine.getElements()).toEqual([source]); expect(changes).toHaveLength(0); expect(edits).toBe(0);
  expect(engine.tool).toBe('highlighter');
  engine.undo(); expect(engine.getElements()).toEqual([source]);
  listeners.pointerdown(point(400, 400)); listeners.pointercancel(point(400, 400));
  expect(engine.getElements()).toEqual([source]);
  engine.setReadOnly(true); drag(450, 450, 470, 470);
  expect(packets.at(-1).some(p => p.start && p.x === 450)).toBe(true);
  expect(engine.getElements()).toEqual([source]); engine.destroy();
});


test('dragging Text defines a writing area, wraps without modifying content, and resizes without scaling the font', () => {
  const {engine,listeners,point,drag}=setup([]);let editor;
  engine.onStartInlineText=state=>{editor=state;};engine.setTool('text');drag(100,100,240,240);
  expect(editor).toMatchObject({boxWidth:140,boxHeight:140,canvasX:100,canvasY:100});
  const text='This is a longer sentence that should wrap inside the chosen writing area.';
  engine.commitInlineText({...editor,text});let el=engine.getElements()[0];
  expect(el.text).toBe(text);expect(el.textBox).toBe(true);expect(el.width).toBe(140);expect(el.height).toBeGreaterThanOrEqual(140);
  const layout=measureTextBlock({measureText:t=>({width:t.length*7}),save(){},restore(){}},text,el.fontSize,el.fontFamily,el);
  const bounds=getElementBounds(el);expect(bounds.maxX-bounds.minX).toBe(140);expect(layout.height).toBeGreaterThan(el.fontSize*2);
  const size=el.fontSize;engine.setTool('select');drag(240,100,320,100);el=engine.getElements()[0];
  expect(el.width).toBeGreaterThan(140);expect(el.fontSize).toBe(size);expect(el.text).toBe(text);
  engine.undo();expect(engine.getElements()[0].width).toBe(140);engine.redo();
  listeners.dblclick(point(110,110));expect(editor.boxWidth).toBe(engine.getElements()[0].width);engine.destroy();
});
test('Text sizing supports reverse dragging, Shift squares, and cancellation without creating elements',()=>{
 const {engine,listeners,point}=setup([]);let editor;engine.onStartInlineText=state=>{editor=state;};engine.setTool('text');
 listeners.pointerdown(point(300,300));listeners.pointermove(point(100,200,true));listeners.pointerup(point(100,200,true));
 expect(editor).toMatchObject({canvasX:100,canvasY:100,boxWidth:200,boxHeight:200});
 engine.setTool('text');editor=undefined;listeners.pointerdown(point(0,0));listeners.pointermove(point(100,100));listeners.pointercancel(point(100,100));
 expect(editor).toBeUndefined();expect(engine.getElements()).toHaveLength(0);engine.destroy();
});

test('live room text publishes before finishing, retains its editor, and empty edits remain editable until commit',()=>{
 const {engine}=setup([]);let published=[];engine.onChange=elements=>published=elements;
 const first={kind:'new-text',text:'H',fontSize:24,fontFamily:'sans',color:'#fff',align:'left',canvasX:50,canvasY:50,screenX:50,screenY:50,screenWidth:100};
 const editing=engine.previewInlineText(first);expect(editing.kind).toBe('text');expect(editing.elementId).toBe(published[0].id);expect(published[0].text).toBe('H');
 const next=engine.previewInlineText({...editing,text:'Hello'});expect(published).toHaveLength(1);expect(published[0].text).toBe('Hello');expect(next.elementId).toBe(editing.elementId);
 engine.previewInlineText({...next,text:''});expect(engine.getElements()).toHaveLength(1);engine.previewInlineText({...next,text:'Again'});expect(published[0].text).toBe('Again');
 engine.commitInlineText({...next,text:''});expect(engine.getElements()).toHaveLength(0);engine.destroy();
});

test('hidden canvas ignores editing shortcuts and restores them when canvas becomes active',()=>{
  const {engine}=setup([source]);engine.selectAll();engine.setKeyboardEnabled(false);
  engine.onKeyDown({key:'Delete',code:'Delete',target:null,preventDefault(){}});expect(engine.getElements()).toHaveLength(1);
  engine.setKeyboardEnabled(true);engine.onKeyDown({key:'Delete',code:'Delete',target:null,preventDefault(){}});expect(engine.getElements()).toHaveLength(0);engine.destroy();
});

test('trackpad release coordinates complete a drag even without a final pointermove', () => {
  const { engine, listeners, point } = setup([source]);
  listeners.pointerdown(point(150, 130)); listeners.pointerup({ ...point(210, 180), type: 'pointerup', pointerType: 'mouse', buttons: 0 });
  expect(engine.getElements()[0]).toMatchObject({ x: 160, y: 150 });
  expect(engine.canUndo()).toBe(true);
  engine.undo(); expect(engine.getElements()[0]).toEqual(source); engine.destroy();
});

test('failed pointer capture still allows dragging and releasing outside the canvas', () => {
  const { engine, listeners, point } = setup([source]);
  engine.canvas.setPointerCapture = () => { throw new Error('NotFoundError'); };
  expect(() => listeners.pointerdown(point(150, 130))).not.toThrow();
  engine.onWindowPointerMove({ ...point(210, 180), target: {} });
  engine.onWindowPointerUp({ ...point(220, 190), target: {} });
  expect(engine.getElements()[0]).toMatchObject({ x: 170, y: 160 });
  expect(engine.gesture).toBe(null);
  expect(engine.activePointerId).toBe(null); engine.destroy();
});

test('already released browser capture cannot interrupt a committed drag', () => {
  const { engine, listeners, point } = setup([source]);
  engine.canvas.hasPointerCapture = () => true;
  engine.canvas.releasePointerCapture = () => { throw new Error('InvalidStateError'); };
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(210, 180));
  expect(() => listeners.pointerup(point(210, 180))).not.toThrow();
  expect(engine.canUndo()).toBe(true); expect(engine.activePointerId).toBe(null); engine.destroy();
});

test('trackpad scroll momentum does not shift the viewport underneath a shape drag', () => {
  const { engine, listeners, point } = setup([source]);
  listeners.pointerdown(point(150, 130));
  const viewport = engine.getViewport();
  listeners.wheel({ ...point(150, 130), deltaX: 40, deltaY: 60 });
  expect(engine.getViewport()).toEqual(viewport);
  listeners.pointerup(point(210, 180));
  listeners.wheel({ ...point(150, 130), deltaX: 40, deltaY: 60 });
  expect(engine.getViewport().pan).toEqual({ x: -40, y: -60 }); engine.destroy();
});

test('a second trackpad finger during a quick draw or move keeps the shape and does not zoom', () => {
  const gesture = scale => ({ scale, clientX: 200, clientY: 200, preventDefault() {} });
  for (const tool of ['rectangle', 'circle', 'arrow']) {
    const { engine, listeners, point } = setup([]); engine.setTool(tool);
    listeners.pointerdown(point(100, 100)); listeners.pointermove(point(150, 140));
    listeners.gesturestart(gesture(1)); listeners.gesturechange(gesture(1.4));
    listeners.pointermove(point(300, 250)); listeners.gestureend(gesture(1.4)); listeners.pointerup(point(300, 250));
    expect(engine.getElements()).toHaveLength(1); expect(engine.getElements()[0].type).toBe(tool); expect(engine.getZoom()).toBe(1);
    engine.destroy();
  }
  const { engine, listeners, point } = setup([source]);
  listeners.pointerdown(point(150, 130)); listeners.gesturestart(gesture(1)); listeners.pointermove(point(210, 180)); listeners.pointerup(point(210, 180));
  expect(engine.getElements()[0]).toMatchObject({ x: 160, y: 150 }); engine.destroy();
});

test('Safari cumulative pinch scales zoom the canvas and ignore duplicate wheel zoom', () => {
  const { engine, listeners, point } = setup([]);
  const gesture = scale => ({ scale, clientX: 200, clientY: 200, preventDefault() {} });
  listeners.gesturestart(gesture(1)); listeners.gesturechange(gesture(1.5));
  expect(engine.getZoom()).toBeCloseTo(1.5);
  listeners.wheel({ ...point(200, 200), ctrlKey: true, deltaY: -100 });
  expect(engine.getZoom()).toBeCloseTo(1.5);
  listeners.gesturechange(gesture(2)); expect(engine.getZoom()).toBeCloseTo(2);
  listeners.gestureend(gesture(2));
  listeners.wheel({ ...point(200, 200), ctrlKey: true, deltaY: -100 });
  expect(engine.getZoom()).toBeGreaterThan(2); engine.destroy();
});

test('changing selected text size also updates the next-text default and notifies preferences', () => {
  const text = { ...base, id: 'sized', type: 'text', x: 100, y: 100, width: 100, height: 30, text: 'Size', fontSize: 32, fontFamily: 'sans', textAlign: 'left' };
  const { engine, listeners, point } = setup([text]); let style;
  engine.onStyleChange = value => { style = value; };
  listeners.pointerdown(point(120, 115)); listeners.pointerup(point(120, 115));
  engine.changeFontSize(2);
  expect(engine.getElements()[0].fontSize).toBe(34);
  expect(style.fontSize).toBe(34); expect(engine.currentStyle.fontSize).toBe(34);
  engine.setTool('text'); let editor; engine.onStartInlineText = value => { editor = value; };
  listeners.pointerdown(point(400, 400)); listeners.pointerup(point(400, 400));
  expect(editor.fontSize).toBe(34); engine.destroy();
});

test('Space on a focused button is reserved for native activation, not canvas panning', () => {
  const { engine } = setup([]);
  const button = new HTMLElement(); button.closest = () => button;
  let prevented = false;
  engine.onKeyDown({ key: ' ', code: 'Space', target: button, preventDefault() { prevented = true; } });
  expect(prevented).toBe(false); expect(engine.spaceDown).toBe(false); engine.destroy();
});

test('a captured Mac trackpad drag reporting no buttons keeps moving until the real release', () => {
  const { engine, listeners, point } = setup([source]);
  engine.canvas.hasPointerCapture = () => true;
  listeners.pointerdown(point(150, 130));
  listeners.pointermove({ ...point(180, 150), type: 'pointermove', pointerType: 'mouse', buttons: 0 });
  expect(engine.gesture?.kind).toBe('move');
  listeners.pointerup({ ...point(210, 180), type: 'pointerup', pointerType: 'mouse', buttons: 0 });
  expect(engine.gesture).toBe(null); expect(engine.getElements()[0]).toMatchObject({ x: 160, y: 150 }); engine.destroy();
});

test('a marquee dragged inside a frame selects only what it touches', () => {
  const frame = { ...source, id: 'big', type: 'frame', title: 'Area', x: 0, y: 0, width: 900, height: 600 };
  const small = { ...source, id: 'small', x: 300, y: 300, width: 40, height: 40 };
  const { engine, listeners, point } = setup([frame, small]);
  let emits = 0; engine.onSelectionChange = () => { emits++; };
  listeners.pointerdown(point(250, 250));
  for (let x = 360; x <= 380; x += 2) listeners.pointermove(point(x, 360));
  listeners.pointerup(point(380, 360));
  expect([...engine.selectedIds]).toEqual(['small']);
  expect(emits).toBeLessThan(5); engine.destroy();
});

test('click, move, click draws a shape without holding the trackpad button', () => {
  for (const tool of ['rectangle', 'circle', 'diamond', 'frame']) {
    const { engine, listeners, point } = setup([]); engine.setTool(tool);
    listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100));
    expect(engine.getElements()).toHaveLength(0); expect(engine.gesture?.clickMode).toBe(true);
    listeners.pointermove({ ...point(260, 220), type: 'pointermove', pointerType: 'mouse', buttons: 0 });
    expect(engine.draft).toMatchObject({ width: 160, height: 120 });
    listeners.pointerdown(point(260, 220)); listeners.pointerup(point(260, 220));
    expect(engine.getElements()).toHaveLength(1);
    expect(engine.getElements()[0]).toMatchObject({ type: tool, x: 100, y: 100, width: 160, height: 120 });
    expect(engine.gesture).toBe(null); expect(engine.canUndo()).toBe(true); engine.destroy();
  }
});

test('click-to-draw lines and arrows, Escape keeps the drawn arrow, and pencil still needs a drag', () => {
  let { engine, listeners, point } = setup([]); engine.setTool('line');
  listeners.pointerdown(point(50, 50)); listeners.pointerup(point(51, 50));
  listeners.pointermove(point(250, 50)); listeners.pointerdown(point(250, 50)); listeners.pointerup(point(250, 50));
  expect(engine.getElements()[0]).toMatchObject({ type: 'line', startX: 50, startY: 50, endX: 250, endY: 50 }); engine.destroy();
  ({ engine, listeners, point } = setup([])); engine.setTool('arrow');
  listeners.pointerdown(point(50, 400)); listeners.pointerup(point(50, 400)); listeners.pointermove(point(300, 400));
  engine.onKeyDown({ key: 'Escape', code: 'Escape', target: null, preventDefault() {} });
  expect(engine.getElements()).toHaveLength(1); expect(engine.getElements()[0].type).toBe('arrow'); expect(engine.gesture).toBe(null); engine.destroy();
  ({ engine, listeners, point } = setup([])); engine.setTool('pencil');
  listeners.pointerdown(point(50, 50)); listeners.pointerup(point(50, 50));
  expect(engine.gesture).toBe(null); engine.destroy();
});

test('grabbing a selected circle outline beside a connection dot moves it instead of drawing an arrow', () => {
  const ring = { ...base, id: 'ring', type: 'circle', x: 100, y: 100, width: 200, height: 150 };
  const { engine, listeners, point } = setup([ring]); engine.selectAll();
  listeners.pointerdown(point(299, 183)); listeners.pointermove(point(349, 183)); listeners.pointerup(point(349, 183));
  expect(engine.getElements()).toHaveLength(1); expect(engine.getElements()[0]).toMatchObject({ type: 'circle', x: 150 });
  listeners.pointerdown(point(350, 175)); listeners.pointerup(point(350, 175));
  expect(engine.gesture).toBe(null); expect(engine.getElements()).toHaveLength(1); engine.destroy();
});

test('arrows drawn from inside one shape to inside another attach to their facing sides and draw straight', () => {
  const a = { ...base, id: 'a', type: 'circle', x: 100, y: 100, width: 100, height: 100 };
  const b = { ...base, id: 'b', type: 'rectangle', x: 500, y: 300, width: 100, height: 100 };
  for (const clickMode of [false, true]) {
    const { engine, listeners, point } = setup([a, b]); engine.setTool('arrow');
    listeners.pointerdown(point(150, 150));
    if (clickMode) { listeners.pointerup(point(150, 150)); listeners.pointermove(point(550, 350)); listeners.pointerdown(point(550, 350)); }
    else listeners.pointermove(point(550, 350));
    listeners.pointerup(point(550, 350));
    const arrow = engine.getElements().find(el => el.type === 'arrow');
    expect(arrow).toMatchObject({ routing: 'straight', startX: 200, startY: 150, endX: 500, endY: 350, startBinding: { elementId: 'a', anchor: 'right' }, endBinding: { elementId: 'b', anchor: 'left' } });
    engine.destroy();
  }
});

test('switching tools abandons an unfinished click-to-draw shape', () => {
  const { engine, listeners, point } = setup([]); engine.setTool('rectangle');
  listeners.pointerdown(point(100, 100)); listeners.pointerup(point(100, 100)); listeners.pointermove(point(200, 200));
  engine.setTool('select');
  expect(engine.gesture).toBe(null); expect(engine.draft).toBe(null); expect(engine.getElements()).toHaveLength(0); engine.destroy();
});

test('a mouse returning after a missed release cannot leave the canvas stuck dragging', () => {
  const { engine, listeners, point } = setup([source]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(210, 180));
  listeners.pointermove({ ...point(900, 600), type: 'pointermove', pointerType: 'mouse', buttons: 0 });
  expect(engine.gesture).toBe(null); expect(engine.activePointerId).toBe(null);
  expect(engine.getElements()[0]).toMatchObject({ x: 160, y: 150 }); engine.destroy();
});

test('Mac Command Shift Period increases selected text above 96px, remains undoable and notifies preferences', () => {
  const text = { ...base, id: 'large', type: 'text', x: 100, y: 100, width: 500, height: 180, text: 'Large', fontSize: 120, fontFamily: 'sans', textAlign: 'left' };
  const { engine, listeners, point } = setup([text]); let savedSize;
  engine.onStyleChange = style => { savedSize = style.fontSize; };
  listeners.pointerdown(point(150, 160)); listeners.pointerup(point(150, 160));
  let prevented = false;
  engine.onKeyDown({ code: 'Period', key: 'Unidentified', metaKey: true, shiftKey: true, target: null, preventDefault() { prevented = true; } });
  expect(prevented).toBe(true); expect(engine.getElements()[0].fontSize).toBe(122); expect(savedSize).toBe(122);
  engine.undo(); expect(engine.getElements()[0].fontSize).toBe(120); engine.destroy();
});

test('a press-and-hold starts a draft immediately and the first move updates it without a timer', () => {
  for (const tool of ['rectangle', 'circle', 'diamond', 'frame', 'arrow', 'pencil', 'line']) {
    const { engine, listeners, point } = setup([]); engine.setTool(tool);
    listeners.pointerdown(point(100, 100));
    expect(engine.gesture.kind).toBe('draft'); expect(engine.draft.type).toBe(tool);
    listeners.pointermove(point(180, 160));
    if (tool === 'pencil') expect(engine.draft.points.at(-1)).toEqual({ x: 180, y: 160 });
    else if (tool === 'line' || tool === 'arrow') expect(engine.draft).toMatchObject({ endX: 180, endY: 160 });
    else expect(engine.draft).toMatchObject({ width: 80, height: 60 });
    listeners.pointerup(point(180, 160));
    expect(engine.getElements()).toHaveLength(1); engine.destroy();
  }
});

test('fast Pencil strokes preserve coalesced samples and append without copying the draft path', () => {
  const { engine, listeners, point } = setup([]); engine.setTool('pencil');
  listeners.pointerdown(point(100, 100)); const points = engine.draft.points;
  listeners.pointermove({ ...point(160, 140), getCoalescedEvents: () => [point(120, 110), point(140, 150), point(160, 140)] });
  expect(engine.draft.points).toBe(points);
  expect(points).toEqual([{ x: 100, y: 100 }, { x: 120, y: 110 }, { x: 140, y: 150 }, { x: 160, y: 140 }]);
  listeners.pointerup(point(180, 170));
  expect(engine.getElements()[0].points.at(-1)).toEqual({ x: 180, y: 170 });
  engine.undo(); expect(engine.getElements()).toHaveLength(0); engine.redo(); expect(engine.getElements()[0].points).toHaveLength(5); engine.destroy();
});

test('many immediate strokes remain separate and coalesced-event failures do not interrupt drawing', () => {
  const { engine, listeners, point } = setup([]); engine.setTool('pencil');
  for (let index = 0; index < 30; index++) {
    listeners.pointerdown(point(100, index * 10));
    listeners.pointermove({ ...point(150, index * 10 + 5), getCoalescedEvents() { throw new Error('Not supported'); } });
    listeners.pointerup(point(160, index * 10 + 8));
  }
  expect(engine.getElements()).toHaveLength(30);
  expect(engine.getTool()).toBe('pencil');
  expect(engine.getElements().every(el => el.points.length === 3)).toBe(true); engine.destroy();
});


for (const tool of ['circle', 'arrow', 'rectangle', 'diamond', 'frame', 'line']) {
  test(`${tool} keeps its draft through capture loss and commits the window release`, () => {
    const { engine, listeners, point } = setup([]);
    engine.setTool(tool);
    let prevented = false;
    listeners.pointerdown({ ...point(100, 100), preventDefault() { prevented = true; } });
    expect(prevented).toBe(true);
    listeners.pointermove(point(160, 140));
    const draftId = engine.draft.id;
    listeners.lostpointercapture({ ...point(160, 140), buttons: 0 });
    expect(engine.draft.id).toBe(draftId);
    engine.onWindowPointerMove({ ...point(220, 180), target: {}, buttons: 1, type: 'pointermove', pointerType: 'mouse' });
    engine.onWindowPointerUp({ ...point(260, 220), target: {}, buttons: 0, type: 'pointerup', pointerType: 'mouse' });
    expect(engine.getElements()).toHaveLength(1);
    expect(engine.getElements()[0]).toMatchObject({ id: draftId, type: tool, width: 160, height: 120 });
    expect(engine.gesture).toBeNull();
    engine.undo(); expect(engine.getElements()).toHaveLength(0);
    engine.redo(); expect(engine.getElements()).toHaveLength(1);
    engine.destroy();
  });

  test(`${tool} returning near its origin finishes the drag instead of entering click mode`, () => {
    const { engine, listeners, point } = setup([]);
    engine.setTool(tool);
    listeners.pointerdown(point(100, 100));
    listeners.pointermove(point(180, 160));
    listeners.pointerup(point(102, 102));
    expect(engine.gesture).toBeNull(); expect(engine.draft).toBeNull();
    listeners.pointermove(point(400, 400));
    expect(engine.draft).toBeNull();
    engine.destroy();
  });
}

test('capture loss during a move preserves the artwork, while a subsequent cancel restores it', () => {
  const { engine, listeners, point, captures } = setup([source]);
  listeners.pointerdown(point(150, 130)); listeners.pointermove(point(210, 180));
  listeners.lostpointercapture({ ...point(210, 180), buttons: 1 });
  expect(captures).toEqual([1, 1]);
  expect(engine.getElements()[0]).toMatchObject({ x: 160, y: 150 });
  listeners.pointercancel(point(210, 180));
  expect(engine.getElements()).toEqual([source]); expect(engine.canUndo()).toBe(false);
  engine.destroy();
});

for (const tool of ['rectangle', 'circle', 'diamond', 'frame', 'line', 'arrow']) {
  test(`${tool} matches Rectangle for immediate press-drag-release, selection and undo`, () => {
    for (const zoom of [0.5, 1, 2]) {
      const { engine, listeners, point } = setup([]);
      engine.zoom = zoom; engine.setTool(tool);
      listeners.pointerdown(point(300, 300));
      expect(engine.draft.type).toBe(tool);
      listeners.pointermove(point(220, 240));
      const draft = engine.draft;
      if (tool === 'arrow' || tool === 'line') {
        expect(draft.endX).toBe(220 / zoom); expect(draft.endY).toBe(240 / zoom);
      } else {
        expect(draft.width).toBe(80 / zoom); expect(draft.height).toBe(60 / zoom);
      }
      listeners.pointerup({ ...point(200, 200), type: 'pointerup', buttons: 0 });
      expect(engine.getElements()).toHaveLength(1);
      expect(engine.getTool()).toBe('select');
      expect(engine.getSelectedElements()[0].id).toBe(draft.id);
      expect(engine.gesture).toBeNull(); expect(engine.draft).toBeNull();
      engine.undo(); expect(engine.getElements()).toHaveLength(0);
      engine.redo(); expect(engine.getElements()).toHaveLength(1);
      engine.destroy();
    }
  });
}

for (const zoom of [0.5, 1, 2]) {
  test(`click jitter leaves artwork in place at ${zoom}x, including snapping and resize handles`, () => {
    for (const snapToGrid of [false, true]) {
      const nearby = { ...source, id: 'nearby', x: 102, y: 300 };
      const { engine, listeners, point } = setup([source, nearby]);
      engine.zoom = zoom; engine.snapToGrid = snapToGrid;
      const start = engine.canvasToScreen(150, 130);
      listeners.pointerdown(point(start.x, start.y));
      listeners.pointermove(point(start.x + 0.5, start.y + 0.5));
      listeners.pointerup(point(start.x + 1, start.y + 1));
      expect(engine.getElements()).toEqual([source, nearby]); expect(engine.canUndo()).toBe(false);
      const pad = getSelectionPadding(source, zoom);
      const corner = engine.canvasToScreen(source.x - pad, source.y - pad);
      listeners.pointerdown(point(corner.x, corner.y));
      listeners.pointermove(point(corner.x + 1, corner.y + 1));
      listeners.pointerup(point(corner.x + 1, corner.y + 1));
      expect(engine.getElements()).toEqual([source, nearby]); expect(engine.canUndo()).toBe(false);
      // A deliberate move still follows the original press without losing its initial displacement.
      engine.snapToGrid = false;
      listeners.pointerdown(point(start.x, start.y));
      listeners.pointermove({ ...point(start.x + 20, start.y + 20), altKey: true });
      listeners.pointerup({ ...point(start.x + 20, start.y + 20), altKey: true });
      expect(engine.getElements()[0]).toMatchObject({ x: source.x + 20 / zoom, y: source.y + 20 / zoom });
      engine.undo(); expect(engine.getElements()).toEqual([source, nearby]); engine.destroy();
    }
  });
}

test('click jitter on line endpoints and bend handles does not move or bend the line', () => {
  const line = { ...base, id: 'line', type: 'line', startX: 100, startY: 100, endX: 300, endY: 200, x: 100, y: 100, width: 200, height: 100 };
  for (const [x, y] of [[100, 100], [200, 150], [300, 200]]) {
    const { engine, listeners, point } = setup([line]); engine.selectAll();
    listeners.pointerdown(point(x, y)); listeners.pointermove(point(x + 1, y + 1)); listeners.pointerup(point(x + 1, y + 1));
    expect(engine.getElements()).toEqual([line]); expect(engine.canUndo()).toBe(false); engine.destroy();
  }
});

test('reopening unchanged aligned text and changing its color preserve its alignment box and position', () => {
  for (const align of ['left', 'center', 'right']) {
    const text = { ...base, id: 'text', type: 'text', x: 100, y: 100, width: 420, height: 50, text: 'Short', fontSize: 24, fontFamily: 'sans', textAlign: align };
    const { engine, listeners, point } = setup([text]); let editor;
    engine.onStartInlineText = info => { editor = info; };
    listeners.dblclick(point(200, 120)); expect(editor.elementId).toBe(text.id);
    engine.commitInlineText(editor);
    expect(engine.getElements()[0]).toMatchObject({ x: 100, y: 100, width: 420, height: 50 });
    engine.updateSelectedElement({ stroke: '#ff0000' });
    expect(engine.getElements()[0]).toMatchObject({ x: 100, y: 100, width: 420, height: 50, stroke: '#ff0000' });
    engine.undo(); expect(engine.getElements()[0].stroke).toBe('#fff'); engine.destroy();
  }
});
