import { test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import React, { act } from 'react';
import { Window } from 'happy-dom';
import { Canvas } from '../components/Canvas.tsx';
import { usePointerDrag } from '../lib/usePointerDrag.ts';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import { createBoard, setActiveBoardId, getOrCreateDefaultBoard, getBoard } from '../lib/storage.ts';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { STROKE_SHADES, BACKGROUND_SHADES } from '../lib/colorPalettes.ts';
import { DEFAULT_STYLE } from '../draw/types.ts';
import { TemplatesModal } from '../components/TemplatesModal.tsx';
import { BugReportForm } from '../components/BugReportForm.tsx';
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
  browser = new Window({ url: 'http://localhost:3000' });
  for (const [key, value] of Object.entries({ window: browser, document: browser.document, navigator: browser.navigator, HTMLElement: browser.HTMLElement, HTMLCanvasElement: browser.HTMLCanvasElement, localStorage: browser.localStorage, getComputedStyle: browser.getComputedStyle.bind(browser), requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser), ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  browser.HTMLCanvasElement.prototype.getContext = function () { return context(this); };
  browser.HTMLCanvasElement.prototype.toDataURL = function (type) { exports.push({ type, width: this.width, height: this.height, pixels: context(this).data.slice() }); return type === 'image/jpeg' ? 'data:image/jpeg;base64,cGFpbnQ=' : 'data:image/png;base64,cGFpbnQ='; };
  browser.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: this.width, height: this.height }; };
  browser.HTMLCanvasElement.prototype.setPointerCapture = function (id) { captures.set(this, id); };
  browser.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; browser.HTMLDialogElement.prototype.close = function () { this.open = false; };
  ({ createRoot } = await import('react-dom/client'));
});
beforeEach(() => { browser.localStorage.removeItem('knotleaf.preferences.v1'); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')); exports.length = 0; });
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

test('both More colors buttons reveal 50 distinct predefined shades and apply independently', async () => {
  const id = await renderBoard(); await clickNamed('Rectangle (R)'); await boardPointer('pointerdown', 100, 100); await boardPointer('pointermove', 240, 200); await boardPointer('pointerup', 240, 200); await clickNamed('Open appearance settings');
  expect(named('Stroke color shades')).toBeNull(); expect(named('Background color shades')).toBeNull();
  await clickNamed('More stroke colors'); await clickNamed('More background colors');
  expect(named('Stroke color shades').querySelectorAll('button')).toHaveLength(50); expect(named('Background color shades').querySelectorAll('button')).toHaveLength(50);
  expect(new Set(STROKE_SHADES).size).toBe(50); expect(new Set(BACKGROUND_SHADES).size).toBe(50); expect(STROKE_SHADES.some(color => BACKGROUND_SHADES.includes(color))).toBe(false);
  await clickNamed(`Color ${STROKE_SHADES[20]}`); await clickNamed(`Background ${BACKGROUND_SHADES[20]}`);
  expect(getBoard(id).elements[0]).toMatchObject({ stroke: STROKE_SHADES[20], fill: BACKGROUND_SHADES[20] });
  await clickNamed('More stroke colors'); expect(named('Stroke color shades')).toBeNull(); expect(named('Background color shades')).toBeTruthy();
});
test('double-click inside a shape focuses attached text while border double-click only selects', async () => {
  const id = await renderBoard(); await clickNamed('Rectangle (R)'); await boardPointer('pointerdown', 100, 100); await boardPointer('pointermove', 240, 200); await boardPointer('pointerup', 240, 200);
  await boardPointer('dblclick', 160, 140); await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  const editor = named('Edit text'); expect(editor).toBeTruthy(); expect(document.activeElement).toBe(editor); expect(named('Appearance settings')).toBeNull();
  await typeText(editor, 'Inside my shape'); await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true })));
  const elements = getBoard(id).elements; expect(elements.find(el => el.type === 'text')).toMatchObject({ text: 'Inside my shape', containerId: elements[0].id });
  await boardPointer('dblclick', 130, 100); expect(named('Edit text')).toBeNull();
});

test('notes-only layout fills the available main area instead of collapsing on narrow screens', async () => {
  await renderBoard('notes');expect(named('Board notes').classList.contains('flex-1')).toBe(true);
  expect(named('Notes editor')).toBeTruthy();expect(named('Board notes in Markdown')).toBeNull();
});


test('template picker searches, clears, filters and recovers from insertion errors without duplicate submissions', async () => {
  let calls = 0, closeCount = 0, release;
  await act(async () => root.render(React.createElement(TemplatesModal, { isOpen: true, theme: 'dark', onClose: () => closeCount++, onSelectTemplate: async () => { calls++; await new Promise(resolve => { release = resolve; }); throw new Error('Test insertion failure'); } })));
  expect(document.activeElement).toBe(named('Search templates'));
  expect(document.querySelectorAll('article')).toHaveLength(12);
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(named('Search templates'), 'no matching diagram'); named('Search templates').dispatchEvent(new browser.Event('input', { bubbles: true })); });
  expect(document.querySelectorAll('article')).toHaveLength(0); expect(document.body.textContent).toContain('No matching templates');
  await clickNamed('Clear template search'); expect(document.querySelectorAll('article')).toHaveLength(12);
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Planning').click());
  expect(document.querySelectorAll('article')).toHaveLength(5);
  const add = document.querySelector('article button');
  await act(async () => { add.click(); add.click(); }); expect(calls).toBe(1); expect(named('Close templates').disabled).toBe(true);
  await act(async () => document.querySelector('dialog').dispatchEvent(new browser.Event('cancel', { cancelable: true })));
  expect(closeCount).toBe(0);
  await act(async () => release());
  expect(document.querySelector('[role="alert"]').textContent).toBe('Test insertion failure'); expect(named('Close templates').disabled).toBe(false);
  await clickNamed('Close templates'); expect(closeCount).toBe(1);
});
for (const mode of ['canvas', 'notes', 'split']) {
  test(`template insertion from ${mode} view keeps notes and original artwork and does not open Appearance`, async () => {
    const id = await renderBoard(mode);
    await clickNamed('Browse diagram templates');
    expect(document.querySelector('dialog[open]')).toBeTruthy();
    expect(document.querySelector('dialog[open] input[type="checkbox"]').checked).toBe(false);
    await clickNamed('Add template: Cloud web application');
    expect(document.querySelector('[aria-labelledby="template-title"]')).toBeNull();
    let board = getBoard(id), original = structuredClone(board.elements);
    expect(board.elements.length).toBeGreaterThan(10); expect(board.markdownNotes).toContain('# Cloud web application');
    expect(board.elements.some(el => el.type === 'text' && el.fill !== 'transparent')).toBe(false);
    expect(board.viewMode).toBe(mode === 'notes' ? 'canvas' : mode); expect(named('Appearance settings')).toBeNull();
    await clickNamed('Browse diagram templates'); await clickNamed('Add template: Team retrospective');
    board = getBoard(id); expect(board.elements.slice(0, original.length)).toEqual(original);
    expect(board.markdownNotes).toContain('# Cloud web application'); expect(board.markdownNotes).toContain('# Team retrospective');
    expect(new Set(board.elements.map(el => el.id)).size).toBe(board.elements.length);
    await clickNamed('Browse diagram templates');
    await act(async () => document.querySelector('dialog[open] input[type="checkbox"]').click());
    await clickNamed('Add template: Mind map');
    board = getBoard(id); expect(board.elements.some(el => original.some(item => item.id === el.id))).toBe(false);
    expect(board.markdownNotes).toContain('# Cloud web application'); expect(board.markdownNotes).toContain('# Mind map');
  });
}
test('bug reporting prepares a reviewable public issue, excludes private context and supports copy fallback', async () => {
  await act(async () => root.render(React.createElement(BugReportForm)));
  const inputSetter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  expect([...document.querySelectorAll('button')].find(button => button.textContent === 'Copy report').disabled).toBe(true);
  await act(async () => { inputSetter.call(named('Bug summary'), 'Template placement'); named('Bug summary').dispatchEvent(new browser.Event('input', { bubbles: true })); });
  await typeText(named('Steps to reproduce'), 'Open templates and add a diagram');
  await typeText(named('Expected behavior'), 'A centered diagram'); await typeText(named('Actual behavior'), 'It is outside the viewport');
  const link = document.querySelector('a'), url = new URL(link.href);
  expect(url.origin).toBe('https://github.com'); expect(url.pathname).toBe('/ayush931/Knotleaf-Desk/issues/new');
  expect(url.searchParams.get('title')).toBe('Template placement'); expect(url.searchParams.get('body')).toContain('Open templates and add a diagram');
  expect(url.searchParams.get('body')).toContain('## Environment'); expect(link.rel).toBe('noopener noreferrer');
  await act(async () => document.querySelector('input[type="checkbox"]').click());
  expect(new URL(document.querySelector('a').href).searchParams.get('body')).not.toContain('## Environment');
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  try {
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Copy report').click());
    expect(document.querySelector('details').open).toBe(true); expect(document.activeElement).toBe(named('Bug report preview'));
    expect(document.body.textContent).toContain('copy it manually');
  } finally { if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard); else delete navigator.clipboard; }
});
test('Report bug opens directly from the visible screen action and retains a draft in Board tools', async () => {
  await renderBoard(); await clickNamed('Report bug');
  await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
  expect(document.activeElement === named('Bug summary')).toBe(true);
  expect(named('Bug report').closest('[hidden]')).toBeNull();
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(named('Bug summary'), 'My draft'); named('Bug summary').dispatchEvent(new browser.Event('input', { bubbles: true })); });
  await clickNamed('Close board tools'); await clickNamed('Board tools: find, history, templates and report a bug');
  await act(async () => new Promise(resolve => setTimeout(resolve, 5)));
  await act(async () => [...document.querySelectorAll('dialog[open] button')].find(button => button.textContent === 'Report bug').click());
  expect(named('Bug summary').value).toBe('My draft');
});

test('uploads have one toolbar action and eraser exposes uncapped numeric size and filtering',async()=>{
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:{push(){},replace(){},refresh(){},back(){},forward(){},prefetch(){}}},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 expect(document.querySelectorAll('[aria-label="Upload image or file"]')).toHaveLength(1);expect(document.querySelector('[aria-label="Drawing tools"] [aria-label="Upload image or file"]')).toBeTruthy();expect(document.querySelector('[aria-label="Upload images or assets"]')).toBeNull();
 await act(async()=>document.querySelector('[aria-label="Eraser (E)"]').click());const size=document.getElementById('eraser-size');expect(size.getAttribute('max')).toBeNull();expect(size.value).toBe('24');
 await act(async()=>document.querySelector('[aria-label="Increase eraser size"]').click());expect(size.value).toBe('30');expect([...document.querySelector('[aria-label="Erase"]').options].map(o=>o.value)).toEqual(['all','drawings','objects']);
 expect(document.querySelector('[aria-label="Appearance settings"]')).toBeNull();
});

test('chosen font size persists for new text and survives a complete canvas remount', async () => {
  const id = await renderBoard();
  let editor = await startText();
  await typeText(editor, 'First size');
  await clickNamed('Open appearance settings');
  await clickNamed('Increase font size');
  await clickNamed('Increase font size');
  const size = parseFloat(editor.style.fontSize);
  expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).style.fontSize).toBe(size);
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(getBoard(id).elements[0].fontSize).toBe(size);
  await clickNamed('Text & Bullets (T)');
  await boardPointer('pointerdown', 400, 300); await boardPointer('pointerup', 400, 300);
  editor = named('Edit text'); expect(parseFloat(editor.style.fontSize)).toBe(size);
  await typeText(editor, 'Second size');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => root.render(null));
  await act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, React.createElement(Canvas)))));
  await clickNamed('Text & Bullets (T)');
  await boardPointer('pointerdown', 700, 500); await boardPointer('pointerup', 700, 500);
  editor = named('Edit text');
  expect(parseFloat(editor.style.fontSize)).toBe(size);
});


test('panel resize survives missing capture and follows only its pointer through final release', async () => {
  const points = [];
  function Handle() {
    const begin = usePointerDrag(event => points.push(event.clientX));
    return React.createElement('button', { onPointerDown: begin, 'aria-label': 'Test resize' }, 'Resize');
  }
  await act(async () => root.render(React.createElement(Handle)));
  const handle = named('Test resize');
  handle.setPointerCapture = () => { throw new Error('Capture unavailable'); };
  const event = (type, pointerId, clientX, button = 0) => new browser.PointerEvent(type, { bubbles: true, cancelable: true, pointerId, clientX, button, isPrimary: true });
  await act(async () => handle.dispatchEvent(event('pointerdown', 1, 10, 2)));
  await act(async () => window.dispatchEvent(event('pointermove', 1, 20)));
  expect(points).toEqual([]);
  await act(async () => handle.dispatchEvent(event('pointerdown', 1, 10)));
  expect(document.activeElement).toBe(handle);
  await act(async () => window.dispatchEvent(event('pointermove', 2, 30)));
  await act(async () => window.dispatchEvent(event('pointermove', 1, 40)));
  await act(async () => window.dispatchEvent(event('pointerup', 1, 80)));
  await act(async () => window.dispatchEvent(event('pointermove', 1, 100)));
  expect(points).toEqual([40, 80]);
});

test('Mac Command Shift Period and Comma resize inline text and save the next-text size', async () => {
  await renderBoard(); const editor = await startText();
  await typeText(editor, 'Mac shortcut');
  const size = parseFloat(editor.style.fontSize);
  const key = (code, value) => new browser.KeyboardEvent('keydown', { code, key: value, metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
  const increase = key('Period', 'Unidentified');
  await act(async () => editor.dispatchEvent(increase));
  expect(increase.defaultPrevented).toBe(true);
  expect(parseFloat(editor.style.fontSize)).toBe(size + 2);
  expect(editor.value).toBe('Mac shortcut');
  expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).style.fontSize).toBe(size + 2);
  await act(async () => editor.dispatchEvent(key('Comma', '<')));
  expect(parseFloat(editor.style.fontSize)).toBe(size);
});

test('Mac Command Shift Period reported as Escape grows inline text instead of finishing the edit', async () => {
  await renderBoard(); const editor = await startText();
  await typeText(editor, 'Still editing');
  const size = parseFloat(editor.style.fontSize);
  const increase = new browser.KeyboardEvent('keydown', { key: 'Escape', metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
  await act(async () => editor.dispatchEvent(increase));
  expect(increase.defaultPrevented).toBe(true);
  expect(document.querySelector('textarea[aria-label="Edit text"]')).toBe(editor);
  expect(parseFloat(editor.style.fontSize)).toBe(size + 2);
});

test('the shortcut text size is used for the next new text instead of the default', async () => {
  const id = await renderBoard(); let editor = await startText();
  await typeText(editor, 'First');
  const size = parseFloat(editor.style.fontSize);
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { code: 'Period', key: '>', metaKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await clickNamed('Text & Bullets (T)'); await boardPointer('pointerdown', 400, 400); await boardPointer('pointerup', 400, 400);
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  editor = named('Edit text');
  expect(parseFloat(editor.style.fontSize)).toBe(size + 2);
  await typeText(editor, 'Second');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(getBoard(id).elements.map(el => el.fontSize)).toEqual([size + 2, size + 2]);
});

test('Mac text-size shortcut works while focus is on an Appearance button', async () => {
  const id = await renderBoard(); const editor = await startText();
  await typeText(editor, 'Selected text');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const size = getBoard(id).elements[0].fontSize;
  await clickNamed('Open appearance settings');
  const control = named('Increase font size'); control.focus();
  const increase = new browser.KeyboardEvent('keydown', { code: 'Period', key: '>', metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
  await act(async () => control.dispatchEvent(increase));
  expect(increase.defaultPrevented).toBe(true);
  expect(getBoard(id).elements[0].fontSize).toBe(size + 2);
  expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).style.fontSize).toBe(size + 2);
});

test('Mac text-size shortcut changes visual Notes text while its editor has focus', async () => {
  const { DocEditor } = await import('../components/DocEditor.tsx');
  await act(async () => root.render(React.createElement(DocEditor, { value: 'A note', onChange() {}, onExportMarkdown() {}, theme: 'dark' })));
  const editor = document.querySelector('[contenteditable="true"]');
  expect(editor).not.toBeNull(); editor.focus();
  const increase = new browser.KeyboardEvent('keydown', { code: 'Period', key: '.', metaKey: true, shiftKey: true, bubbles: true, cancelable: true });
  await act(async () => editor.dispatchEvent(increase));
  expect(increase.defaultPrevented).toBe(true);
  expect(named('Text size').value).toBe('18');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { code: 'Comma', key: '<', metaKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  expect(named('Text size').value).toBe('16');
});

test('Notes remember the shortcut text size for new typing after a remount', async () => {
  const { DocEditor } = await import('../components/DocEditor.tsx');
  const props = { value: 'A note', onChange() {}, onExportMarkdown() {}, theme: 'dark' };
  await act(async () => root.render(React.createElement(DocEditor, props)));
  let editor = document.querySelector('[contenteditable="true"]'); editor.focus();
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { code: 'Period', key: '>', metaKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).noteTypingSize).toBe(18);
  await act(async () => root.render(null));
  await act(async () => root.render(React.createElement(DocEditor, props)));
  editor = document.querySelector('[contenteditable="true"]'); editor.focus();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(named('Text size').value).toBe('18');
});

test('drawing toolbar labels appear immediately on hover and focus, including disabled actions', async () => {
  const { TopToolbar } = await import('../components/TopToolbar.tsx');
  await act(async () => root.render(React.createElement(TopToolbar, { selectedTool: 'rectangle', setSelectedTool() {}, onUndo() {}, onRedo() {}, canUndo: false, canRedo: false, onOpenIconPicker() {}, onUploadAssets() {}, theme: 'dark' })));
  for (const button of document.querySelectorAll('[role="toolbar"] button')) {
    await act(async () => button.parentElement.dispatchEvent(new browser.MouseEvent('mouseover', { bubbles: true })));
    const tip = document.querySelector('[role="tooltip"]');
    expect(tip).not.toBeNull();
    expect(tip.textContent).toContain(button.getAttribute('aria-label').split(' (')[0]);
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip.parentElement).toBe(document.body);
    await act(async () => button.parentElement.dispatchEvent(new browser.MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  }
  const rectangle = document.querySelector('[aria-label="Rectangle (R)"]');
  await act(async () => rectangle.focus());
  expect(document.querySelector('[role="tooltip"]').textContent).toBe('Rectangle (R)');
  await act(async () => document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  expect(document.activeElement).toBe(rectangle);
  await act(async () => { rectangle.blur(); rectangle.focus(); });
  await act(async () => window.dispatchEvent(new browser.Event('resize')));
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

test('personal canvas schedules warmup before Share is opened and cancels scheduled work on unmount', async () => {
  const originalIdle = window.requestIdleCallback, originalCancel = window.cancelIdleCallback;
  let scheduled = 0, cancelled;
  window.requestIdleCallback = (_callback, options) => { scheduled++; expect(options.timeout).toBe(1000); return 91; };
  window.cancelIdleCallback = id => { cancelled = id; };
  try {
    await renderBoard();
    expect(scheduled).toBe(1);
    expect(document.querySelector('[aria-labelledby="room-title"]').open).toBe(false);
    await act(async () => root.render(null));
    expect(cancelled).toBe(91);
  } finally { window.requestIdleCallback = originalIdle; window.cancelIdleCallback = originalCancel; }
});

test('shape colors stay on the selected object and each new drawing tool remembers its own colors', async () => {
  const id = await renderBoard();
  const initial = (await import('../draw/types.ts')).DEFAULT_STYLE;
  await clickNamed('Rectangle (R)'); await clickNamed('Open appearance settings');
  await clickNamed('Color #EF4444'); await clickNamed('Background #48596b');
  await boardPointer('pointerdown', 100, 100); await boardPointer('pointermove', 220, 200); await boardPointer('pointerup', 220, 200);
  expect(getBoard(id).elements[0]).toMatchObject({ stroke: '#EF4444', fill: '#48596b' });
  // Editing a selected shape remembers its type only; siblings and other tool defaults stay independent.
  await clickNamed('Color #10B981');
  expect(getBoard(id).elements[0].stroke).toBe('#10B981');
  await clickNamed('Ellipse (O)');
  await boardPointer('pointerdown', 350, 100); await boardPointer('pointermove', 470, 200); await boardPointer('pointerup', 470, 200);
  expect(getBoard(id).elements[1]).toMatchObject({ stroke: initial.stroke, fill: initial.fill });
  await clickNamed('Text & Bullets (T)');
  await boardPointer('pointerdown', 100, 350); await boardPointer('pointerup', 100, 350);
  let editor = named('Edit text'); expect(editor.style.color).not.toBe('rgb(239, 68, 68)');
  await typeText(editor, 'Independent text');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(getBoard(id).elements[2].stroke).toBe(initial.stroke);
  await clickNamed('Rectangle (R)');
  await boardPointer('pointerdown', 550, 100); await boardPointer('pointermove', 670, 200); await boardPointer('pointerup', 670, 200);
  expect(getBoard(id).elements[3]).toMatchObject({ stroke: '#10B981', fill: '#48596b' });
  expect(getBoard(id).elements[0].stroke).toBe('#10B981');
  await act(async () => root.render(null));
  await act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams() }, React.createElement(Canvas)))));
  await clickNamed('Rectangle (R)');
  await boardPointer('pointerdown', 550, 350); await boardPointer('pointermove', 670, 450); await boardPointer('pointerup', 670, 450);
  expect(getBoard(id).elements[4]).toMatchObject({ stroke: '#10B981', fill: '#48596b' });
});

test('text editor alignment width and position match saved text before and after clicking away', async () => {
  const id = await renderBoard();
  const editor = await startText();
  await typeText(editor, 'Aligned words');
  await clickNamed('Open appearance settings');
  const align = [...document.querySelectorAll('[aria-label="Appearance settings"] button')].find(button => button.textContent === 'center');
  await act(async () => align.click());
  const width = parseFloat(editor.style.width), left = parseFloat(editor.style.left), top = parseFloat(editor.style.top);
  await act(async () => editor.dispatchEvent(new browser.FocusEvent('focusout', { bubbles: true, relatedTarget: document.querySelector('main canvas') })));
  const saved = getBoard(id).elements[0];
  expect(saved.width).toBe(width); expect(saved.x).toBe(left); expect(saved.y).toBe(top); expect(saved.textAlign).toBe('center');
  await act(async () => document.querySelector('main canvas').dispatchEvent(new browser.MouseEvent('dblclick', { bubbles: true, clientX: left + 30, clientY: top + 15 })));
  const reopened = named('Edit text'); expect(parseFloat(reopened.style.width)).toBe(width); expect(parseFloat(reopened.style.left)).toBe(left);
  await act(async () => reopened.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(getBoard(id).elements[0]).toMatchObject({ x: saved.x, y: saved.y, width: saved.width, height: saved.height });
});

test('changing selected text from green to white survives reopening and stays separate from shape colors',async()=>{
 const id=await renderBoard();
 await clickNamed('Rectangle (R)');await clickNamed('Open appearance settings');await clickNamed('Color #EF4444');
 await boardPointer('pointerdown',350,100);await boardPointer('pointermove',470,200);await boardPointer('pointerup',470,200);
 let editor=await startText();await typeText(editor,'Original');if(!named('Color #10B981'))await clickNamed('Open appearance settings');await clickNamed('Color #10B981');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(getBoard(id).elements[1].stroke).toBe('#10B981');
 // Reopen an existing text editor; its color edit must become the text tool default.
 await boardPointer('dblclick',102,102);editor=named('Edit text');expect(editor).toBeTruthy();
 if(!named('Color #FFFFFF'))await clickNamed('Open appearance settings');
 await clickNamed('Color #FFFFFF');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(getBoard(id).elements[1].stroke).toBe('#FFFFFF');
 expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).toolColors.text.stroke).toBe('#FFFFFF');
 await act(async()=>root.render(null));
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 editor=await startText();expect(editor.style.color.toLowerCase()).toBe('#ffffff');await typeText(editor,'After reopening');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(getBoard(id).elements[2].stroke).toBe('#FFFFFF');
 await clickNamed('Rectangle (R)');await boardPointer('pointerdown',550,100);await boardPointer('pointermove',670,200);await boardPointer('pointerup',670,200);
 expect(getBoard(id).elements[3].stroke).toBe('#EF4444');expect(getBoard(id).elements[0].stroke).toBe('#EF4444');
});
