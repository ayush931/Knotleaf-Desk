import { test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import React, { act } from 'react';
import { Window } from 'happy-dom';
import { setAppearanceHidden } from '../lib/appearancePreference.ts';
import { PaintStudio } from '../components/PaintStudio.tsx';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { DEFAULT_STYLE } from '../draw/types.ts';
import { FillControls } from '../components/FillControls.tsx';
import { ColorControl } from '../components/ColorControl.tsx';
const saved = new Map(), contexts = new WeakMap(), captures = new WeakMap(), exports = [];
let browser, root, createRoot, inserted, closes;
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
  for (const [key, value] of Object.entries({ window: browser, document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, HTMLCanvasElement: browser.HTMLCanvasElement, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  browser.HTMLCanvasElement.prototype.getContext = function () { return context(this); };
  browser.HTMLCanvasElement.prototype.toDataURL = function (type) { exports.push({ type, width: this.width, height: this.height, pixels: context(this).data.slice() }); return type === 'image/jpeg' ? 'data:image/jpeg;base64,cGFpbnQ=' : 'data:image/png;base64,cGFpbnQ='; };
  browser.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: this.width, height: this.height }; };
  browser.HTMLCanvasElement.prototype.setPointerCapture = function (id) { captures.set(this, id); };
  browser.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; browser.HTMLDialogElement.prototype.close = function () { this.open = false; };
  ({ createRoot } = await import('react-dom/client'));
});
beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')); inserted = []; closes = 0; exports.length = 0; });
afterEach(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
afterAll(() => { browser.close(); for (const [key, old] of saved) if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key]; });
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent === text);
const image = () => document.querySelector('[aria-label="Paint image canvas"]');
async function click(text) { await act(async () => button(text).click()); }
async function render(open = true) { await act(async () => root.render(React.createElement(PaintStudio, { open, onClose: () => closes++, onInsert: (...args) => inserted.push(args) }))); }
async function input(label, value, type = 'input') { const el = [...document.querySelectorAll('label')].find(el => el.textContent.startsWith(label))?.querySelector(type); if (!el) throw new Error(`Missing ${label}`); const setter = Object.getOwnPropertyDescriptor(type === 'select' ? browser.HTMLSelectElement.prototype : browser.HTMLInputElement.prototype, 'value').set; await act(async () => { setter.call(el, String(value)); el.dispatchEvent(new browser.Event('input', { bubbles: true })); el.dispatchEvent(new browser.Event('change', { bubbles: true })); }); }
async function small() { await render(); await input('Width (px)', 16); await input('Height (px)', 12); await click('Apply size'); }
async function pointer(type, x, y) { await act(async () => image().dispatchEvent(new browser.PointerEvent(type, { bubbles: true, button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y }))); }

test('Paint opens as a modal with core tools, bounded settings, layers and project save', async () => {
  await render(); expect(document.querySelector('dialog').open).toBe(true); expect(document.querySelector('dialog').parentElement).toBe(document.body);
  for (const label of ['Brush', 'Fill bucket', 'Color picker', 'Crop to selection', 'Rotate left', 'Flip vertical', 'Save editable project']) expect(button(label)).toBeTruthy();
  await act(async () => document.querySelector('[aria-label="Add paint layer"]').click());
  expect(document.querySelector('[aria-label="Paint layers"]').textContent).toContain('Layer 2');
  await act(async () => document.querySelector('[aria-label="Undo paint edit"]').click()); expect(document.querySelector('[aria-label="Paint layers"]').textContent).not.toContain('Layer 2');
  await act(async () => document.querySelector('[aria-label="Close Paint workspace"]').click()); expect(closes).toBe(1);
});
test('Fill bucket paints transparent pixels and insertion carries the resulting dimensions', async () => {
  await small(); await click('Fill bucket'); await pointer('pointerdown', 3, 3); await click('Insert onto board');
  expect(inserted).toEqual([['data:image/png;base64,cGFpbnQ=', 16, 12]]);
  expect([...exports.at(-1).pixels.slice(0, 4)]).toEqual([245, 158, 11, 255]);
  await act(async () => document.querySelector('[aria-label="Undo paint edit"]').click()); await click('Insert onto board'); expect(exports.at(-1).pixels.every(n => n === 0)).toBe(true);
});
test('crop and rotation change dimensions and undo restores the preceding image', async () => {
  await small(); await click('Select area'); await pointer('pointerdown', 2, 2); await pointer('pointermove', 9, 7); await pointer('pointerup', 9, 7); await click('Crop to selection');
  expect([image().width, image().height]).toEqual([8, 6]); await click('Rotate right'); expect([image().width, image().height]).toEqual([6, 8]);
  await act(async () => document.querySelector('[aria-label="Undo paint edit"]').click()); expect([image().width, image().height]).toEqual([8, 6]);
});
test('cancelled brush gestures do not create history and invalid resize keeps work', async () => {
  await small(); await pointer('pointerdown', 2, 2); await pointer('pointermove', 8, 7); await pointer('pointercancel', 8, 7);
  await act(async () => document.querySelector('[aria-label="Undo paint edit"]').click()); expect([image().width, image().height]).toEqual([960, 640]);
  await input('Width (px)', 0); await click('Apply size'); expect(document.querySelector('[role="alert"]').textContent).toContain('whole-number'); expect(image().width).toBe(960);
});
test('a failed board insertion retains the Paint draft with a visible error', async () => {
  await act(async () => root.render(React.createElement(PaintStudio, { open: true, onClose: () => {}, onInsert: () => { throw new Error('Room disconnected.'); } })));
  await click('Insert onto board'); expect(document.querySelector('[role="alert"]').textContent).toContain('Room disconnected.'); expect(document.querySelector('dialog').open).toBe(true);
});
test('custom color validation preserves input and allows correcting hex colors', async () => {
  let color;
  await act(async () => root.render(React.createElement(ColorControl, { label: 'Test color', value: '#ffffff', onChange: c => { color = c; } })));
  const field = document.getElementById('color-test-color'), setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  for (const value of ['bad', '#123456']) { await act(async () => { setter.call(field, value); field.dispatchEvent(new browser.Event('input', { bubbles: true })); }); await act(async () => field.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))); }
  expect(color).toBe('#123456'); expect(field.getAttribute('aria-invalid')).toBe('false');
});


test('background controls expose the complete transparent-to-opaque range and all fill styles', async () => {
  let opacity, style;
  await act(async () => root.render(React.createElement(FillControls, { style: 'solid', opacity: 0.5, onStyle: v => { style = v; }, onOpacity: v => { opacity = v; } })));
  const slider = document.querySelector('[aria-label="Background opacity"]'); expect([slider.min, slider.max]).toEqual(['0', '1']);
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(slider, '0'); slider.dispatchEvent(new browser.Event('input', { bubbles: true })); slider.dispatchEvent(new browser.Event('change', { bubbles: true })); }); expect(opacity).toBe(0);
  await act(async () => { setter.call(slider, '1'); slider.dispatchEvent(new browser.Event('input', { bubbles: true })); slider.dispatchEvent(new browser.Event('change', { bubbles: true })); }); expect(opacity).toBe(1);
  await click('Crosshatch'); expect(style).toBe('crosshatch'); expect(document.body.textContent).toContain('Transparent'); expect(document.body.textContent).toContain('Opaque');
});


test('photo insertion offers JPEG explicitly while PNG remains the transparent default', async () => {
  await small(); expect(document.querySelector('[aria-label="Board image format"]').value).toBe('png');
  await input('Board format', 'jpeg', 'select'); await click('Insert onto board');
  expect(inserted[0]).toEqual(['data:image/jpeg;base64,cGFpbnQ=', 16, 12]); expect(exports.at(-1).type).toBe('image/jpeg');
});


test('raising an old translucent background to 100% normalizes its color without fading its outline', async () => {
  let changed; const noop = () => {};
  await act(async () => root.render(React.createElement(PropertiesPanel, { selectedElement: { ...DEFAULT_STYLE, type: 'rectangle', id: 'alpha', fill: 'rgba(59, 130, 246, 0.2)', fillStyle: 'solid', opacity: 0.8 }, currentStyle: DEFAULT_STYLE, selectedTool: 'select', selectionCount: 1, onUpdateElement: props => { changed = props; }, onUpdateStyle: noop, onSwapArrow: noop, onChangeFontSize: noop, onDuplicate: noop, onDelete: noop, onBringToFront: noop, onSendToBack: noop, theme: 'dark' })));
  const slider = document.querySelector('[aria-label="Background opacity"]'); expect(slider.value).toBe('0.2');
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(slider, '1'); slider.dispatchEvent(new browser.Event('input', { bubbles: true })); slider.dispatchEvent(new browser.Event('change', { bubbles: true })); });
  expect(changed).toMatchObject({ fill: '#3b82f6', fillStyle: 'solid', fillOpacity: 1 }); expect(changed.opacity).toBeUndefined();
});


const inspectorProps = { selectedTool: 'select', currentStyle: DEFAULT_STYLE, selectionCount: 1, onUpdateElement() {}, onUpdateStyle() {}, onSwapArrow() {}, onChangeFontSize() {}, onDuplicate() {}, onDelete() {}, onBringToFront() {}, onSendToBack() {}, theme: 'dark' };
const inspectorShape = { ...DEFAULT_STYLE, id: 'one', type: 'rectangle', x: 10, y: 20, width: 100, height: 80 };
test('explicitly hidden Appearance stays hidden for new shapes, tools, text editors and remounts', async () => {
  const show = props => root.render(React.createElement(PropertiesPanel, { ...inspectorProps, selectedElement: inspectorShape, ...props }));
  try {
    await act(async () => { setAppearanceHidden(false); show({}); });
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy();
    await act(async () => document.querySelector('[aria-label="Collapse appearance settings"]').click());
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
    for (const props of [{ selectedElement: { ...inspectorShape, id: 'two' } }, { selectedElement: null, selectedTool: 'arrow' }, { selectedTool: 'fill', selectedElement: null }, { selectedTool: 'text', isTextEditing: true, selectedElement: null }]) {
      await act(async () => show(props)); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull(); expect(document.querySelector('[aria-label="Open appearance settings"]')).toBeTruthy();
    }
    await act(async () => root.render(null)); await act(async () => show({ selectedTool: 'arrow' }));
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
    expect(window.localStorage.getItem('knotleaf.appearance.hidden')).toBe('true');
    await act(async () => document.querySelector('[aria-label="Open appearance settings"]').click());
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy();
    await act(async () => show({ selectedElement: { ...inspectorShape, id: 'three' } })); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy();
  } finally { await act(async () => setAppearanceHidden(false)); }
});
test('hidden Appearance works when browser storage cannot save preferences', async () => {
  const original = window.localStorage.setItem;
  try {
    window.localStorage.setItem = () => { throw new Error('Storage blocked'); };
    await act(async () => root.render(React.createElement(PropertiesPanel, { ...inspectorProps, selectedElement: inspectorShape })));
    await act(async () => document.querySelector('[aria-label="Collapse appearance settings"]').click());
    await act(async () => root.render(React.createElement(PropertiesPanel, { ...inspectorProps, selectedTool: 'arrow', selectedElement: { ...inspectorShape, id: 'next' } })));
    expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
    await act(async () => document.querySelector('[aria-label="Open appearance settings"]').click()); expect(document.querySelector('[aria-label="Appearance settings"]')).toBeTruthy();
  } finally { window.localStorage.setItem = original; await act(async () => setAppearanceHidden(false)); }
});
