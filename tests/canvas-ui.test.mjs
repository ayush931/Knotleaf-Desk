import { test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import React, { act } from 'react';
import { Window } from 'happy-dom';
import { Canvas } from '../components/Canvas.tsx';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import { createBoard, setActiveBoardId, getOrCreateDefaultBoard, getBoard } from '../lib/storage.ts';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { DEFAULT_STYLE } from '../draw/types.ts';
import { ColorControl } from '../components/ColorControl.tsx';
const saved = new Map(), contexts = new WeakMap(), captures = new WeakMap(), exports = [];
let browser, root, createRoot;
function context(canvas) {
  let entry = contexts.get(canvas);
  if (entry && entry.data.length === canvas.width * canvas.height * 4) return entry;
  const ctx = { data: new Uint8ClampedArray(canvas.width * canvas.height * 4), globalAlpha: 1,
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData(x, y, w, h) { const out = this.createImageData(w, h); for (let row = 0; row < h; row++) out.data.set(this.data.subarray(((row + y) * canvas.width + x) * 4, ((row + y) * canvas.width + x + w) * 4), row * w * 4); return out; },
    putImageData(image) { this.data.set(image.data); }, clearRect() { this.data.fill(0); },
    drawImage(source) { const src = contexts.get(source); if (src && source.width === canvas.width && source.height === canvas.height) for (let i = 0; i < this.data.length; i += 4) { const alpha = src.data[i + 3] / 255 * this.globalAlpha; if (!alpha) continue; for (let c = 0; c < 3; c++) this.data[i + c] = src.data[i + c] * alpha + this.data[i + c] * (1 - alpha); this.data[i + 3] = 255 * alpha + this.data[i + 3] * (1 - alpha); } },
    measureText(text) { return { width: text.length * 8 }; }
  };
  entry = new Proxy(ctx, { get: (obj, key) => key in obj ? obj[key] : () => {} }); contexts.set(canvas, entry); return entry;
}
beforeAll(async () => {
  browser = new Window();
  for (const [key, value] of Object.entries({ window: browser, document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, HTMLCanvasElement: browser.HTMLCanvasElement, localStorage: browser.localStorage, getComputedStyle: browser.getComputedStyle.bind(browser), requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser), ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  browser.HTMLCanvasElement.prototype.getContext = function () { return context(this); };
  browser.HTMLCanvasElement.prototype.toDataURL = function (type) { exports.push({ type, width: this.width, height: this.height, pixels: context(this).data.slice() }); return type === 'image/jpeg' ? 'data:image/jpeg;base64,cGFpbnQ=' : 'data:image/png;base64,cGFpbnQ='; };
  browser.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: this.width, height: this.height }; };
  browser.HTMLCanvasElement.prototype.setPointerCapture = function (id) { captures.set(this, id); };
  browser.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; browser.HTMLDialogElement.prototype.close = function () { this.open = false; };
  ({ createRoot } = await import('react-dom/client'));
});
beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')); exports.length = 0; });
afterEach(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
afterAll(() => { browser.close(); for (const [key, old] of saved) if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key]; });
test('custom color validation preserves input and allows correcting hex colors', async () => {
  let color;
  await act(async () => root.render(React.createElement(ColorControl, { label: 'Test color', value: '#ffffff', onChange: c => { color = c; } })));
  const field = document.getElementById('color-test-color'), setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  for (const value of ['bad', '#123456']) { await act(async () => { setter.call(field, value); field.dispatchEvent(new browser.Event('input', { bubbles: true })); }); await act(async () => field.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))); }
  expect(color).toBe('#123456'); expect(field.getAttribute('aria-invalid')).toBe('false');
});


const inspectorProps = { selectedTool: 'select', currentStyle: DEFAULT_STYLE, selectionCount: 1, onUpdateElement() {}, onUpdateStyle() {}, onSwapArrow() {}, onChangeFontSize() {}, onDuplicate() {}, onDelete() {}, onBringToFront() {}, onSendToBack() {}, theme: 'dark' };
const inspectorShape = { ...DEFAULT_STYLE, id: 'one', type: 'rectangle', x: 10, y: 20, width: 100, height: 80 };
function Inspector({ props = {} }) {
  const [open, setOpen] = React.useState(false);
  return React.createElement(PropertiesPanel, { ...inspectorProps, selectedElement: inspectorShape, ...props, isOpen: open, onOpenChange: setOpen });
}
test('Appearance never opens until requested, stays closed across all creation contexts, and defaults closed on a new visit', async () => {
  const show = props => root.render(React.createElement(Inspector, { props }));
  // An old stored "open" preference must not reopen the sidebar on a new visit.
  window.localStorage.setItem('knotleaf.appearance.hidden', 'false');
  await act(async () => show({})); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
  for (const props of [{ selectedElement: { ...inspectorShape, id: 'two' } }, { selectedElement: null, selectedTool: 'arrow' }, { selectedTool: 'fill', selectedElement: null }, { selectedTool: 'text', isTextEditing: true, selectedElement: null }]) {
    await act(async () => show(props)); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
  }
  await act(async () => document.querySelector('[aria-label="Open appearance settings"]').click());
  expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy(); expect(document.activeElement.getAttribute('aria-label')).toBe('Collapse appearance settings');
  await act(async () => show({ selectedElement: { ...inspectorShape, id: 'three' } })); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy();
  await act(async () => document.querySelector('[aria-label="Collapse appearance settings"]').click());
  await act(async () => show({ selectedElement: { ...inspectorShape, id: 'four' }, selectedTool: 'arrow' })); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
  await act(async () => root.render(null)); await act(async () => show({ selectedTool: 'arrow' })); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
});
test('Appearance visibility uses no browser storage and Escape hides the panel', async () => {
  const original = window.localStorage.setItem;
  try {
    window.localStorage.setItem = () => { throw new Error('Storage blocked'); };
    await act(async () => root.render(React.createElement(Inspector)));
    await act(async () => document.querySelector('[aria-label="Open appearance settings"]').click());
    const region = document.querySelector('[aria-label="Appearance settings"]'); expect(region).toBeTruthy();
    expect(region.classList.contains('overflow-hidden')).toBe(true); expect(region.querySelector('.overflow-y-auto')).toBeTruthy(); expect(region.querySelector('[aria-label="Selection actions"]')).toBeTruthy();
    await act(async () => region.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
    await new Promise(resolve => window.requestAnimationFrame(resolve)); expect(document.activeElement.getAttribute('aria-label')).toBe('Open appearance settings');
  } finally { window.localStorage.setItem = original; }
});

const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
async function renderBoard(mode = 'canvas') {
  localStorage.clear(); const board = createBoard('Test canvas'); board.viewMode = mode;
  const { saveBoard } = await import('../lib/storage.ts'); saveBoard(board); setActiveBoardId(board.id);
  await act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, React.createElement(Canvas)))));
  return board.id;
}
const named = label => document.querySelector(`[aria-label="${label}"]`);
async function clickNamed(label) { await act(async () => named(label).click()); }
async function boardPointer(type, x, y) { await act(async () => document.querySelector('main canvas').dispatchEvent(new browser.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true }))); }
async function startText(tool = 'Text & Bullets (T)') {
  await clickNamed(tool); await boardPointer('pointerdown', 100, 100); await boardPointer('pointerup', 100, 100);
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  return named('Edit text');
}
async function typeText(editor, text) {
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { setter.call(editor, text); editor.dispatchEvent(new browser.Event('input', { bubbles: true })); });
}
test('canvas text focuses, keeps editing through Appearance formatting, saves multiline text and reopens', async () => {
  const id = await renderBoard(); const editor = await startText();
  expect(editor.placeholder).toBe('Start typing…'); expect(document.activeElement).toBe(editor);
  await typeText(editor, 'Hello\nworld'); await clickNamed('Open appearance settings');
  expect(named('Edit text')).toBe(editor); expect(document.activeElement).toBe(editor); expect(editor.value).toBe('Hello\nworld');
  await clickNamed('Bold'); await clickNamed('Font: Lora');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Z', shiftKey: true })));
  expect(named('Show controls')).toBeNull();
  expect(editor.style.fontWeight).toBe('700');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true })));
  expect(named('Edit text')).toBeNull(); const saved = getBoard(id).elements[0];
  expect(saved).toMatchObject({ type: 'text', text: 'Hello\nworld', bold: true, fontFamily: 'serif' });
  await boardPointer('dblclick', saved.x + 2, saved.y + 2);
  expect(named('Edit text').value).toBe('Hello\nworld');
});
test('document editing wraps and blank text finishes without adding a shape or opening Appearance', async () => {
  await renderBoard(); let editor = await startText();
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
  expect(getOrCreateDefaultBoard().elements).toHaveLength(0); expect(named('Appearance settings')).toBeNull();
  editor = await startText('Doc Card (N)'); expect(editor.getAttribute('wrap')).toBe('soft');
  await typeText(editor, 'A document note'); expect(editor.getAttribute('wrap')).toBe('soft'); expect(named('Appearance settings')).toBeNull();
});
test('focus view hides controls and notes, retains artwork, and restores the saved split view', async () => {
  const id = await renderBoard('split');
  await clickNamed('Focus canvas'); expect(named('Drawing tools')).toBeNull(); expect(named('Open appearance settings')).toBeNull();
  expect(named('Board notes').classList.contains('hidden')).toBe(true); expect(document.querySelector('main').classList.contains('mt-11')).toBe(false);
  expect(named('Show controls')).toBeTruthy(); expect(getBoard(id).viewMode).toBe('split');
  await act(async () => window.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(named('Drawing tools')).toBeTruthy(); expect(named('Open Paint workspace')).toBeNull(); expect(named('Board notes').classList.contains('hidden')).toBe(false); expect(named('Appearance settings')).toBeNull();
  await act(async () => window.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Z', shiftKey: true, bubbles: true })));
  expect(named('Show controls')).toBeTruthy(); await clickNamed('Show controls'); expect(named('Drawing tools')).toBeTruthy();
});

test('background color changes shapes independently of stroke and canvas color persists separately', async () => {
  const id = await renderBoard(); await clickNamed('Rectangle (R)'); await boardPointer('pointerdown', 100, 100); await boardPointer('pointermove', 240, 200); await boardPointer('pointerup', 240, 200);
  expect(named('Appearance settings')).toBeNull(); await clickNamed('Open appearance settings');
  const before = getBoard(id).elements[0]; await clickNamed('Background #48596b');
  expect(getBoard(id).elements[0]).toMatchObject({ fill: '#48596b', fillStyle: 'solid', stroke: before.stroke });
  await clickNamed('Background style: Hatch'); await clickNamed('Background #4a5b4c');
  expect(getBoard(id).elements[0]).toMatchObject({ fill: '#4a5b4c', fillStyle: 'hachure', stroke: before.stroke });
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'No background').click());
  expect(getBoard(id).elements[0]).toMatchObject({ fill: 'transparent', fillStyle: 'none', stroke: before.stroke });
  const canvasColor = document.querySelector('[aria-label="Choose canvas background color"]');
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(canvasColor, '#292c30'); canvasColor.dispatchEvent(new browser.Event('input', { bubbles: true })); canvasColor.dispatchEvent(new browser.Event('change', { bubbles: true })); });
  expect(getBoard(id).background).toEqual({ fill: '#292c30', fillStyle: 'solid', fillOpacity: 1 });
  await clickNamed('Canvas background style: Dots'); expect(getBoard(id).background.fillStyle).toBe('dots');
  expect(getBoard(id).elements[0].fill).toBe('transparent');
});
