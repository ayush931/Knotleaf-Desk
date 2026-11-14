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
import { Minimap, minimapLayout } from '../components/Minimap.tsx';
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
async function chooseCanvasFont(font) { await act(async()=>{const picker=named('Canvas font library');picker.focus();picker.value=font;picker.dispatchEvent(new browser.Event('change',{bubbles:true}));}); }
async function boardPointer(type, x, y) { await act(async () => document.querySelector('main canvas').dispatchEvent(new browser.PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true }))); }
async function startText(tool = 'Text & Bullets (T)', x = 100, y = 100) {
  await clickNamed(tool); await boardPointer('pointerdown', x, y); await boardPointer('pointerup', x, y);
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  return named('Edit text');
}
async function typeText(editor, text) {
  const setter = Object.getOwnPropertyDescriptor(editor.tagName === 'INPUT' ? browser.HTMLInputElement.prototype : browser.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { if(editor.getAttribute('contenteditable')==='true'){editor.textContent=text;editor.setSelectionRange(text.length,text.length);}else setter.call(editor, text); editor.dispatchEvent(new browser.Event('input', { bubbles: true })); });
}
test('canvas text focuses, keeps editing through Appearance formatting, saves multiline text and reopens', async () => {
  const id = await renderBoard(); const editor = await startText();
  expect(editor.dataset.placeholder).toBe('Start typing…'); expect(document.activeElement).toBe(editor);
  await typeText(editor, 'Hello\nworld'); await clickNamed('Open appearance settings');
  expect(named('Edit text')).toBe(editor); expect(document.activeElement).toBe(editor); expect(editor.value).toBe('Hello\nworld');
  await clickNamed('Bold'); await chooseCanvasFont('serif');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Z', shiftKey: true })));
  expect(named('Show controls')).toBeNull();
  expect(editor.style.fontWeight).toBe('700');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true })));
  expect(named('Edit text')).toBeNull(); const saved = getBoard(id).elements[0];
  expect(saved).toMatchObject({ type: 'text', text: 'Hello\nworld', bold: true, fontFamily: 'serif' });
  await boardPointer('dblclick', saved.x + 2, saved.y + 2);
  expect(named('Edit text').value).toBe('Hello\nworld');
});
test('free canvas typing never soft-wraps, preserves Enter, and retains that policy when reopened', async () => {
  const id = await renderBoard(); const editor = await startText();
  expect(editor.style.whiteSpace).toBe('pre');
  const sentence = 'A longer sentence with several words and additional content';
  await typeText(editor, sentence);
  expect(editor.style.whiteSpace).toBe('pre'); expect(editor.style.overflowWrap).toBe('normal');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
  await typeText(editor, sentence + '\nSecond line');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true })));
  const saved = getBoard(id).elements[0]; expect(saved.text).toBe(sentence + '\nSecond line');
  await boardPointer('dblclick', saved.x + 2, saved.y + 2);
  expect(named('Edit text').style.whiteSpace).toBe('pre'); expect(named('Edit text').value).toBe(saved.text);
});
test('explicit text boxes and sticky notes keep soft wrapping', async () => {
  await renderBoard(); await clickNamed('Text & Bullets (T)');
  await boardPointer('pointerdown',100,100); await boardPointer('pointermove',240,180); await boardPointer('pointerup',240,180);
  await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  let editor = named('Edit text'); expect(editor.style.whiteSpace).toBe('pre-wrap');
  await typeText(editor,'A long sentence inside a fixed width text box'); expect(editor.style.whiteSpace).toBe('pre-wrap');
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true })));
  editor = await startText('Sticky note (S)'); expect(editor.style.whiteSpace).toBe('pre-wrap');
  await typeText(editor,'A long sentence inside a sticky note'); expect(editor.style.whiteSpace).toBe('pre-wrap');
});
test('document editing wraps and blank text finishes without adding a shape or opening Appearance', async () => {
  await renderBoard(); let editor = await startText();
  await act(async () => editor.dispatchEvent(new browser.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
  expect(getOrCreateDefaultBoard().elements).toHaveLength(0); expect(named('Appearance settings')).toBeNull();
  editor = await startText('Doc Card (N)'); expect(editor.style.whiteSpace).toBe('pre-wrap');
  await typeText(editor, 'A document note'); expect(editor.style.whiteSpace).toBe('pre-wrap'); expect(named('Appearance settings')).toBeNull();
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
  expect(document.querySelectorAll('article')).toHaveLength(15);
  const setter = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(named('Search templates'), 'no matching diagram'); named('Search templates').dispatchEvent(new browser.Event('input', { bubbles: true })); });
  expect(document.querySelectorAll('article')).toHaveLength(0); expect(document.body.textContent).toContain('No matching templates');
  await clickNamed('Clear template search'); expect(document.querySelectorAll('article')).toHaveLength(15);
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Planning').click());
  expect(document.querySelectorAll('article')).toHaveLength(5);
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Strategy').click());
  expect(document.querySelectorAll('article')).toHaveLength(3);
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
test('strategy templates insert an editable planning board with starter notes', async () => {
  const id = await renderBoard();
  await clickNamed('Browse diagram templates');
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Strategy').click());
  expect(document.querySelectorAll('article')).toHaveLength(3);
  await clickNamed('Add template: Lean canvas');
  const board = getBoard(id);
  expect(board.elements.filter(el => el.type === 'sticky')).toHaveLength(6);
  expect(board.elements.filter(el => el.type === 'frame')).toHaveLength(3);
  expect(board.markdownNotes).toContain('# Lean canvas');
  expect(named('Appearance settings')).toBeNull();
});
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
  await clickNamed('Close board tools'); await clickNamed('Board actions'); await clickNamed('Board tools: find, history, templates and report a bug');
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
  expect(document.querySelector('[aria-label="Edit text"]')).toBe(editor);
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
 editor=await startText('Text & Bullets (T)',300,300);expect(editor.style.color.toLowerCase()).toBe('#ffffff');await typeText(editor,'After reopening');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(getBoard(id).elements[2].stroke).toBe('#FFFFFF');
 await clickNamed('Rectangle (R)');await boardPointer('pointerdown',550,100);await boardPointer('pointermove',670,200);await boardPointer('pointerup',670,200);
 expect(getBoard(id).elements[3].stroke).toBe('#EF4444');expect(getBoard(id).elements[0].stroke).toBe('#EF4444');
});

test('light mode changes the canvas and persists without rewriting stored artwork', async () => {
 const id=await renderBoard();
 const original=getBoard(id);
 expect(document.documentElement.classList.contains('dark')).toBe(true);
 expect(named('Switch to light mode').textContent).toBe('Light mode');
 await clickNamed('Switch to light mode');
 expect(named('Switch to dark mode').textContent).toBe('Dark mode');
 expect(document.documentElement.classList.contains('light')).toBe(true);
 expect(document.documentElement.classList.contains('dark')).toBe(false);
 expect(document.documentElement.style.colorScheme).toBe('light');
 expect(named('Drawing canvas').dataset.background).toBe('#ffffff');
 expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).theme).toBe('light');
 expect(getBoard(id).background).toEqual(original.background);
 expect(getBoard(id).elements).toEqual(original.elements);
 await act(async()=>root.unmount()); root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 expect(named('Switch to dark mode')).not.toBeNull();
 expect(document.documentElement.classList.contains('light')).toBe(true);
 await clickNamed('Switch to dark mode');
 expect(document.documentElement.classList.contains('dark')).toBe(true);
 expect(document.documentElement.classList.contains('light')).toBe(false);
 expect(named('Drawing canvas').dataset.background).toBe('#000000');
});

test('moving the open board also follows its destination workspace',async()=>{
 const id=await renderBoard();await clickNamed('Open workspaces');await clickNamed('Create workspace');
 const input=document.getElementById('workspace-name');
 await act(async()=>{Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype,'value').set.call(input,'Project team');input.dispatchEvent(new browser.Event('input',{bubbles:true}));});
 await act(async()=>input.closest('form').dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true})));
 const workspaceSelect=document.getElementById('workspace-select');const destination=workspaceSelect.value;expect(destination).not.toBe('personal');
 await act(async()=>{workspaceSelect.value='personal';workspaceSelect.dispatchEvent(new browser.Event('change',{bubbles:true}));});
 await act(async()=>{const move=named('Workspace for Test canvas');move.value=destination;move.dispatchEvent(new browser.Event('change',{bubbles:true}));});
 expect(document.getElementById('workspace-select').value).toBe(destination);expect(getBoard(id).workspaceId).toBe(destination);
});

test('canvas code editor has no language UI and shares its syntax colors with the saved canvas',async()=>{
 const {CodeEditor}=await import('../components/CodeEditor.tsx');const {CODE_COLORS}=await import('../lib/codePalette.ts');
 const props={value:'const count = 42;',language:'javascript',onChange(){},onClose(){},x:50,y:50,width:300,height:100,zoom:1,fontSize:16};
 for(const light of [false,true]){
  await act(async()=>root.render(React.createElement(CodeEditor,{...props,background:{fill:light?'#ffffff':'#111d2d',fillStyle:'solid'}})));
  expect(!!named('Code language')).toBe(false);expect(!!named('Copy code')).toBe(true);expect(!!named('Finish editing code')).toBe(true);
  const code=named('Code source'),colors=CODE_COLORS[light?'light':'dark'];
  expect(code.textContent).toBe(props.value);expect(code.innerHTML).toContain(colors.keyword);expect(code.innerHTML).toContain(colors.number);
  expect(document.querySelector('.code-source').style.height).toBe('100px');expect(named('Code source').value).toBe(props.value);
 }
});

test('Appearance lets code cards shrink, fit and choose explicit black backgrounds',async()=>{
 const changes=[];const card={...DEFAULT_STYLE,id:'sized-code',type:'text',isCodeCard:true,text:'const x=1;',fontSize:14,fontFamily:'mono',textAlign:'left',x:100,y:100,width:200,height:80,fill:'#18181b',fillStyle:'solid'};
 await act(async()=>root.render(React.createElement(PropertiesPanel,{...inspectorProps,isOpen:true,onOpenChange(){},selectedElement:card,onUpdateElement:change=>changes.push(change)})));
 const width=named('Code card width');expect(width.value).toBe('232');expect(named('Code card height').value).toBe('112');
 await act(async()=>{Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype,'value').set.call(width,'152');width.dispatchEvent(new browser.Event('input',{bubbles:true}));});
 expect(changes.at(-1)).toMatchObject({width:120,codeAutoSize:false});
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Fit to code').click());expect(changes.at(-1)).toEqual({codeAutoSize:true});
 await clickNamed('Background #000000');expect(changes.at(-1)).toMatchObject({fill:'#000000',cardFillCustom:true});
 const {CodeEditor}=await import('../components/CodeEditor.tsx');await act(async()=>root.render(React.createElement(CodeEditor,{value:card.text,language:'auto',onChange(){},onClose(){},x:10,y:10,width:80,height:32,zoom:1,fontSize:14,background:{fill:'#09090b',fillStyle:'solid',cardFillCustom:true}})));
 expect(document.querySelector('.code-source').style.height).toBe('32px');expect(named('Inline code editor').dataset.light).toBe('false');expect(named('Code source').value).toBe(card.text);
});

test('code focus restores caret and scroll without shifting its content box or closing on internal focus',async()=>{
 const {CodeEditor}=await import('../components/CodeEditor.tsx');let view,closed=0;
 for(const zoom of [.5,1,2]){
  const props={value:'const first = 1;\nconst second = 2;\n'.repeat(10),language:'javascript',onChange(){},onClose(){closed++;},onViewChange:value=>{view=value;},x:137.5,y:86.25,width:128,height:40,zoom,fontSize:16};
  await act(async()=>root.render(React.createElement(CodeEditor,{...props,key:`initial-${zoom}`})));
  let editor=named('Code source');expect(editor.selectionStart).toBe(0);expect(editor.scrollLeft).toBe(0);expect(editor.scrollTop).toBe(0);
  const box=named('Inline code editor'),geometry=[box.style.left,box.style.top,box.style.width,box.style.transform];expect(document.querySelector('.code-source').style.fontWeight).toBe('400');
  await act(async()=>{editor.setSelectionRange(24,29);editor.scrollLeft=28;editor.scrollTop=21;editor.dispatchEvent(new browser.Event('scroll',{bubbles:true}));});
  const previousClosed=closed;
  await act(async()=>editor.dispatchEvent(new browser.FocusEvent('focusout',{bubbles:true,relatedTarget:named('Copy code')})));expect(closed).toBe(previousClosed);
  await act(async()=>editor.dispatchEvent(new browser.FocusEvent('focusout',{bubbles:true,relatedTarget:document.body})));
  expect(closed).toBe(previousClosed+1);expect(view).toEqual({scrollLeft:28,scrollTop:21,selectionStart:24,selectionEnd:29});
  await act(async()=>root.render(React.createElement(CodeEditor,{...props,initialView:view,key:`restored-${zoom}`})));
  editor=named('Code source');expect(editor.scrollLeft).toBe(28);expect(editor.scrollTop).toBe(21);expect(editor.selectionStart).toBe(24);expect(editor.selectionEnd).toBe(29);
  const reopened=named('Inline code editor');expect([reopened.style.left,reopened.style.top,reopened.style.width,reopened.style.transform]).toEqual(geometry);
 }
});

test('reopening existing text near the canvas boundary retains its exact stored position and width',async()=>{
 localStorage.clear();const board=createBoard('Stable edge text');board.elements=[{...DEFAULT_STYLE,id:'edge-text',type:'text',text:'Existing text',fontSize:24,fontFamily:'sans',textAlign:'left',bold:false,x:850,y:200,width:420,height:36,fill:'transparent',fillStyle:'none'}];
 const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);setActiveBoardId(board.id);
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 const canvas=document.querySelector('main canvas');
 for(let cycle=0;cycle<3;cycle++){
  await act(async()=>canvas.dispatchEvent(new browser.MouseEvent('dblclick',{bubbles:true,clientX:860,clientY:210})));
  const editor=named('Edit text');expect([editor.style.left,editor.style.top,editor.style.width,editor.style.fontWeight]).toEqual(['850px','200px','420px','500']);
  await act(async()=>editor.dispatchEvent(new browser.FocusEvent('focusout',{bubbles:true,relatedTarget:canvas})));
  expect(getBoard(board.id).elements[0]).toMatchObject({x:850,y:200,width:420,height:36,text:'Existing text'});
 }
});

test('code syntax and caret share one scrolling surface',async()=>{
 const {CodeEditor}=await import('../components/CodeEditor.tsx');
 await act(async()=>root.render(React.createElement(CodeEditor,{value:'const name = "a long code line";\n'.repeat(10),language:'javascript',onChange(){},onClose(){},x:100,y:100,width:128,height:40,zoom:1,fontSize:16})));
 const input=named('Code source');expect(input.getAttribute('contenteditable')).toBe('true');expect(document.querySelector('.code-source pre')).toBeNull();
 await act(async()=>{input.scrollLeft=45;input.scrollTop=24;input.dispatchEvent(new browser.Event('scroll',{bubbles:true}));});expect([input.scrollLeft,input.scrollTop]).toEqual([45,24]);
});


test('first text creation stays anchored through typing, native caret scrolling, click-away and refocus',async()=>{
 for(const [x,y] of [[100,100],[895,595]]){
  const id=await renderBoard();await clickNamed('Text & Bullets (T)');
  await boardPointer('pointerdown',x,y);await boardPointer('pointerup',x,y);
  let editor=named('Edit text');expect([editor.style.left,editor.style.top]).toEqual([`${x}px`,`${y}px`]);
  for(const text of ['i','A long first line that extends beyond the viewport','First line\nSecond line\n'.repeat(30)]){
   await typeText(editor,text);expect([editor.style.left,editor.style.top]).toEqual([`${x}px`,`${y}px`]);
   await act(async()=>{editor.scrollLeft=2;editor.scrollTop=20;editor.dispatchEvent(new browser.Event('scroll',{bubbles:true}));});
   expect([editor.scrollLeft,editor.scrollTop]).toEqual([0,0]);expect(editor.style.overflowY).toBe('visible');expect(editor.style.overflowX).toBe('visible');
  }
  const text=editor.value;
  await boardPointer('pointerdown',20,20);await boardPointer('pointerup',20,20);
  // The Text tool stays active, so clicking blank canvas starts another text.
  // Escape dismisses it without altering the first, anchored text.
  const next=named('Edit text');
  if(next)await act(async()=>next.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(!named('Edit text')).toBe(true);expect(getBoard(id).elements[0]).toMatchObject({x,y,text});
  await boardPointer('dblclick',x+2,y+2);editor=named('Edit text');
  expect([editor.style.left,editor.style.top]).toEqual([`${x}px`,`${y}px`]);
  await act(async()=>editor.dispatchEvent(new browser.FocusEvent('focusout',{bubbles:true,relatedTarget:document.querySelector('main canvas')})));
  expect(getBoard(id).elements[0]).toMatchObject({x,y,text});
  await act(async()=>root.render(null));
 }
});


test('arrangement controls expose all eight actions and count attached labels as part of their parent',async()=>{
 const {SelectionTools}=await import('../components/SelectionTools.tsx');let mode;
 const a={...inspectorShape,id:'a'},b={...inspectorShape,id:'b',x:300},label={...a,id:'label',type:'text',containerId:'a'};
 await act(async()=>root.render(React.createElement(SelectionTools,{selection:[a,b,label],onArrange:value=>{mode=value;},onConnect(){}})));
 const toolbar=named('Arrange selection'),buttons=[...toolbar.querySelectorAll('button')];expect(buttons.filter(b=>b.textContent.startsWith('Align'))).toHaveLength(6);
 expect(buttons.find(b=>b.textContent==='Space vertically').disabled).toBe(true);await act(async()=>buttons.find(b=>b.textContent==='Align right').click());expect(mode).toBe('right');
 await act(async()=>root.render(React.createElement(SelectionTools,{selection:[a,b,{...a,id:'c'}],onArrange:value=>{mode=value;},onConnect(){}})));
 await act(async()=>[...named('Arrange selection').querySelectorAll('button')].find(b=>b.textContent==='Space vertically').click());expect(mode).toBe('vertical');
});
test('multiple selected objects retain Appearance selection actions',async()=>{
 let duplicated=0;await act(async()=>root.render(React.createElement(Inspector,{props:{selectedElement:null,selectionCount:3,onDuplicate(){duplicated++;}}})));
 await clickNamed('Open appearance settings');expect(!!named('Selection actions')).toBe(true);await clickNamed('Duplicate selection');expect(duplicated).toBe(1);expect(!!named('Delete selection')).toBe(true);
});
test('Ink Studio offers four inks and updates the selected pencil and future strokes',async()=>{
 const updates=[],styles=[];
 const pencil={...DEFAULT_STYLE,id:'ink-pencil',type:'pencil',x:10,y:20,width:120,height:40,strokeWidth:2,inkStyle:undefined,points:[{x:10,y:20},{x:40,y:30}]};
 const props={...inspectorProps,isOpen:true,onOpenChange(){},selectedElement:pencil,onUpdateElement:value=>updates.push(value),onUpdateStyle:value=>styles.push(value)};
 await act(async()=>root.render(React.createElement(PropertiesPanel,props)));
 const group=document.querySelector('[role="group"][aria-label="Ink styles"]');
 expect(!!group).toBe(true);expect(group.querySelectorAll('button')).toHaveLength(4);
 expect(named('Marker').getAttribute('aria-pressed')).toBe('true');
 await clickNamed('Brush');
 expect(updates.at(-1)).toEqual({inkStyle:'brush'});expect(styles.at(-1)).toEqual({inkStyle:'brush'});
 await act(async()=>root.render(React.createElement(PropertiesPanel,{...props,selectedElement:{...pencil,inkStyle:'brush'}})));
 expect(named('Brush').getAttribute('aria-pressed')).toBe('true');
 await clickNamed('Ink weight 4');expect(updates.at(-1)).toEqual({strokeWidth:4});expect(styles.at(-1)).toEqual({strokeWidth:4});
 await act(async()=>root.render(React.createElement(PropertiesPanel,{...props,selectedElement:{...pencil,inkStyle:'technical'}})));
 expect(named('Technical').getAttribute('aria-pressed')).toBe('true');
});
test('selection action bar applies quick colors and exposes duplicate, order, style and delete',async()=>{
 const {SelectionActionBar}=await import('../components/SelectionActionBar.tsx');
 const shape={...inspectorShape,id:'bar-shape',stroke:'#111111'};let color,duplicated=0,deleted=0,front=0,back=0,appearance=0;
 await act(async()=>root.render(React.createElement(SelectionActionBar,{selection:[shape],onColor:value=>{color=value;},onDuplicate(){duplicated++;},onDelete(){deleted++;},onBringToFront(){front++;},onSendToBack(){back++;},onOpenAppearance(){appearance++;}})));
 expect(!!named('Selection action bar')).toBe(true);expect(named('1 selected')).toBeTruthy();
 await clickNamed('Selection color Iris');expect(color).toBe('#A78BFA');
 await clickNamed('Duplicate selected objects');expect(duplicated).toBe(1);
 await clickNamed('Bring selection to front');expect(front).toBe(1);
 await clickNamed('Send selection to back');expect(back).toBe(1);
 await clickNamed('Customize selection');expect(appearance).toBe(1);
 await clickNamed('Delete selected objects');expect(deleted).toBe(1);
 await act(async()=>root.render(React.createElement(SelectionActionBar,{selection:[shape,{...shape,id:'second',stroke:'#222222'}],onColor(){},onDuplicate(){},onDelete(){},onBringToFront(){},onSendToBack(){},onOpenAppearance(){}})));
 expect(named('2 selected')).toBeTruthy();expect(named('Selection color Iris').getAttribute('aria-pressed')).toBe('false');
});
test('selection action bar styles and duplicates a freshly drawn shape without opening Appearance',async()=>{
 const id=await renderBoard();await clickNamed('Rectangle (R)');await boardPointer('pointerdown',100,100);await boardPointer('pointermove',240,200);await boardPointer('pointerup',240,200);
 expect(!!named('Selection action bar')).toBe(true);expect(named('1 selected')).toBeTruthy();
 await clickNamed('Selection color Iris');expect(getBoard(id).elements[0].stroke).toBe('#A78BFA');
 await clickNamed('Duplicate selected objects');expect(getBoard(id).elements).toHaveLength(2);expect(named('Appearance settings')).toBeNull();
 await clickNamed('Customize selection');expect(!!named('Appearance settings')).toBe(true);
});
test('keyboard shortcuts use a themed native modal, Mac labels, Escape and restored focus',async()=>{
 const {ShortcutsModal}=await import('../components/ShortcutsModal.tsx');
 function Harness({theme}){const [open,setOpen]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement('button',{'aria-label':'Open shortcut help',onClick:()=>setOpen(true)},'Help'),React.createElement(ShortcutsModal,{isOpen:open,onClose:()=>setOpen(false),theme}));}
 for(const theme of ['light','dark']){
  await act(async()=>root.render(React.createElement(Harness,{theme,key:theme})));const trigger=named('Open shortcut help');trigger.focus();await clickNamed('Open shortcut help');
  const dialog=named('Keyboard shortcuts');expect(dialog.tagName).toBe('DIALOG');expect(dialog.open).toBe(true);expect(document.activeElement).toBe(named('Close keyboard shortcuts'));expect(dialog.textContent.includes('Ctrl/Cmd+Z')).toBe(true);expect(dialog.classList.contains(theme==='light'?'bg-white':'dark:bg-black')).toBe(true);
  await act(async()=>dialog.dispatchEvent(new browser.Event('cancel',{bubbles:true})));expect(!named('Keyboard shortcuts')).toBe(true);expect(document.activeElement).toBe(trigger);
 }
});


test('Mac select-all exposes arrangement and vertical spacing updates the saved board',async()=>{
 localStorage.clear();const board=createBoard('Arrange three shapes');board.elements=[100,220,500].map((y,index)=>({...inspectorShape,id:`shape-${index}`,x:100+index*180,y,width:100,height:80}));
 const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);setActiveBoardId(board.id);
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 await act(async()=>window.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'a',metaKey:true,bubbles:true})));
 const tools=named('Arrange selection');expect(!!tools).toBe(true);const space=[...tools.querySelectorAll('button')].find(b=>b.textContent==='Space vertically');space.focus();await act(async()=>space.click());
 expect(getBoard(board.id).elements.map(el=>el.y)).toEqual([100,300,500]);
 await act(async()=>space.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true})));expect(getBoard(board.id).elements.map(el=>el.y)).toEqual([100,220,500]);
 await act(async()=>space.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'z',metaKey:true,shiftKey:true,bubbles:true})));expect(getBoard(board.id).elements.map(el=>el.y)).toEqual([100,300,500]);
});


test('new board writing uses Knotleaf Sketch and retains the saved size through blur and the next text',async()=>{
 const id=await renderBoard();const editor=await startText();expect(editor.style.fontFamily.includes('--font-knotleaf-sketch')).toBe(true);await typeText(editor,'A hand-written diagram');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(getBoard(id).elements[0].fontFamily).toBe('sketch');const size=getBoard(id).elements[0].fontSize;
 const next=await startText();expect(next.style.fontFamily.includes('--font-knotleaf-sketch')).toBe(true);expect(next.style.fontSize).toBe(`${size}px`);
});


test('theme picker independently applies Canvas, Notes and Both, saves settings and preserves artwork',async()=>{
 localStorage.clear();const board=createBoard('Theme scopes');board.viewMode='split';board.background={fill:'#123456',fillStyle:'solid',fillOpacity:1};board.elements=[inspectorShape];board.markdownNotes='# Keep this note\n\n';const original=structuredClone(board);
 const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);setActiveBoardId(board.id);
 const show=()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas))));
 await act(async()=>show());await clickNamed('Canvas and notes themes');
 const scope=()=>document.getElementById('theme-scope');const changeScope=async value=>act(async()=>{scope().value=value;scope().dispatchEvent(new browser.Event('change',{bubbles:true}));});
 const apply=async()=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply theme').click());
 await changeScope('notes');await clickNamed('Theme: Meadow');await apply();
 expect(named('Drawing canvas').dataset.background).toBe('#123456');expect(named('Board notes').dataset.notesTheme).toBe('forest');
 await changeScope('canvas');await clickNamed('Theme: Parchment');
 const checkbox=[...document.querySelectorAll('input[type="checkbox"]')].find(input=>input.parentElement.textContent.includes('Use theme background'));await act(async()=>checkbox.click());await apply();expect(named('Drawing canvas').dataset.background).toBe('#123456');
 await act(async()=>checkbox.click());await apply();expect(named('Drawing canvas').dataset.background).toBe('#211e19');expect(named('Board notes').dataset.notesTheme).toBe('forest');
 await changeScope('both');await clickNamed('Theme: Iris');await apply();await clickNamed('Close themes');
 expect(named('Drawing canvas').dataset.background).toBe('#1b1928');expect(named('Board notes').dataset.notesTheme).toBe('slate');
 await clickNamed('Switch to light mode');expect(named('Drawing canvas').dataset.background).toBe('#f7f5ff');expect(named('Board notes').dataset.notesMode).toBe('light');
 expect(getBoard(board.id).elements).toEqual(original.elements);expect(getBoard(board.id).markdownNotes).toBe(original.markdownNotes);
 await act(async()=>root.render(null));await act(async()=>show());expect(named('Drawing canvas').dataset.background).toBe('#f7f5ff');expect(named('Board notes').dataset.notesTheme).toBe('slate');
});
test('theme storage failure is visible while the session appearance stays usable',async()=>{
 await renderBoard('split');await clickNamed('Canvas and notes themes');const select=document.getElementById('theme-scope');await act(async()=>{select.value='notes';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});await clickNamed('Theme: Meadow');
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:key=>storage.getItem(key),setItem(){throw Error('Quota');}}});
 try{await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply theme').click());expect([...document.querySelectorAll('[role="alert"]')].some(e=>e.textContent.includes('Could not save'))).toBe(true);expect(named('Board notes').dataset.notesTheme).toBe('forest');}finally{Object.defineProperty(globalThis,'localStorage',original);}
});


test('notes page-mode control changes only notes and stays consistent with the shared theme scope',async()=>{
 const {MarkdownWorkspace}=await import('../components/MarkdownWorkspace.tsx');const {NotesThemeContext}=await import('../lib/notesThemeContext.ts');let currentMode='dark';
 function Harness(){const [mode,setMode]=React.useState('dark');return React.createElement(NotesThemeContext.Provider,{value:{mode,onModeChange:value=>{currentMode=value;setMode(value);return true;}}},React.createElement(MarkdownWorkspace,{value:'# Title',onChange(){},initialView:'source'}));}
 await act(async()=>root.render(React.createElement(Harness)));await clickNamed('Markdown options');
 const select=named('Markdown page theme');expect(select.value).toBe('dark');await act(async()=>{select.value='paper';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});
 expect(currentMode).toBe('light');expect(select.value).toBe('paper');
});
test('reminders remain accessible in canvas and notes without modifying the board',async()=>{
 for(const mode of ['canvas','notes']){const id=await renderBoard(mode);const original=getBoard(id);await clickNamed('Open reminders');expect(document.querySelector('[aria-labelledby="reminders-title"]')).not.toBeNull();await clickNamed('Close reminders');expect(getBoard(id)).toEqual(original);}
});
test('Midnight updates logo and portalled dialog tokens, and releases them when the workspace closes',async()=>{
 const rootStyle=document.documentElement.style;const previous=rootStyle.getPropertyValue('--ui-accent');await renderBoard('canvas');
 await clickNamed('Canvas and notes themes');await clickNamed('Theme: Studio');await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply theme').click());await clickNamed('Close themes');
 expect(document.documentElement.dataset.workspaceUi).toBe('true');expect(rootStyle.getPropertyValue('--drawing-panel')).toBe('#000000');expect(rootStyle.getPropertyValue('--ui-accent')).toBe('#8eb4ff');expect(document.querySelector('[data-brand-mark] path').getAttribute('fill')).toBe('var(--ui-brand)');
 await clickNamed('Install web app');const dialog=document.querySelector('[aria-labelledby="install-web-app-title"]');expect(dialog.parentElement).toBe(document.body);
 await clickNamed('Close installation instructions');await clickNamed('Switch to light mode');expect(rootStyle.getPropertyValue('--ui-accent')).toBe('#305db5');
 await act(async()=>root.render(null));expect(rootStyle.getPropertyValue('--ui-accent')).toBe(previous);expect(document.documentElement.hasAttribute('data-workspace-ui')).toBe(false);
});

test('compact board-view selector switches the workspace and saves the chosen view',async()=>{
 const id=await renderBoard('canvas');const select=document.querySelector('select[aria-label="Board view"]');expect(select).not.toBeNull();await act(async()=>{select.value='notes';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});expect(getBoard(id).viewMode).toBe('notes');expect(named('Board notes')).not.toBeNull();
});

test('logo can use the theme accent or black, and saves independently of the theme scope',async()=>{
 const {loadPreferences}=await import('../lib/preferences.ts');await renderBoard('split');await clickNamed('Canvas and notes themes');const select=document.getElementById('logo-style');
 await act(async()=>{select.value='black';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});expect(loadPreferences().logoStyle).toBe('black');expect(document.documentElement.style.getPropertyValue('--ui-brand')).toBe('#000000');expect(document.documentElement.style.getPropertyValue('--ui-brand-bg')).toBe('#ffffff');
 await clickNamed('Theme: Meadow');await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply theme').click());expect(loadPreferences().logoStyle).toBe('black');
 await act(async()=>{select.value='theme';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});expect(document.documentElement.style.getPropertyValue('--ui-brand')).toBe('#b0e0bd');expect(loadPreferences().logoStyle).toBe('theme');
});

test('modern header keeps export directly accessible and menu commands close the menu',async()=>{
 await renderBoard();expect(named('Export board')).not.toBeNull();expect(document.getElementById('board-actions').classList.contains('hidden')).toBe(true);await clickNamed('Board actions');expect(named('Board actions').getAttribute('aria-expanded')).toBe('true');await clickNamed('Keyboard shortcuts');expect(named('Board actions').getAttribute('aria-expanded')).toBe('false');expect(document.querySelector('dialog[aria-label="Keyboard shortcuts"]').open).toBe(true);await clickNamed('Close keyboard shortcuts');expect(document.activeElement).toBe(named('Board actions'));
});
test('new reminder action focuses its task field in the modern composer',async()=>{
 await renderBoard();await clickNamed('Open reminders');const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New reminder');await act(async()=>button.click());expect(document.activeElement).toBe(document.querySelector('input[name="title"]'));
});

test('selected canvas words retain independent formatting through toolbar actions save and reopen',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');
 await act(async()=>{editor.setSelectionRange(6,11);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});
 await clickNamed('Open appearance settings');await clickNamed('Bold');await clickNamed('Increase font size');
 expect(editor.value).toBe('hello world');expect(editor.selectionStart).toBe(6);expect(editor.selectionEnd).toBe(11);
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));
 const saved=getBoard(id).elements[0];expect(saved.bold).toBe(false);expect(saved.textRanges).toEqual([{start:6,end:11,style:{bold:true,fontSize:18}}]);
 await boardPointer('dblclick',saved.x+2,saved.y+2);const reopened=named('Edit text');expect(reopened.value).toBe('hello world');expect(reopened.querySelector('span').textContent).toBe('hello ');expect(reopened.querySelector('span').style.fontWeight).toBe('');expect(reopened.querySelectorAll('span')[1].style.fontWeight).toBe('700');
});

test('selected text font wins, and a later whole-object font replaces only font overrides',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');
 await act(async()=>{editor.setSelectionRange(6,11);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});
 await clickNamed('Open appearance settings');await chooseCanvasFont('serif');await clickNamed('Bold');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));
 expect(getBoard(id).elements[0].textRanges).toEqual([{start:6,end:11,style:{fontFamily:'serif',bold:true}}]);
 await chooseCanvasFont('sans');
 const saved=getBoard(id).elements[0];expect(saved.fontFamily).toBe('sans');expect(saved.textRanges).toEqual([{start:6,end:11,style:{bold:true}}]);
});

test('font picker keeps the selected range through repeated changes while focused outside the editor',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');
 await act(async()=>{editor.setSelectionRange(6,11);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});
 await clickNamed('Open appearance settings');const picker=named('Canvas font library');
 for(const font of ['serif','manrope']){
  await act(async()=>{picker.focus();picker.value=font;picker.dispatchEvent(new browser.Event('change',{bubbles:true}));});
  // Browsers collapse a DOM range when formatted spans are replaced while the picker owns focus.
  const collapsed=document.createRange();collapsed.selectNodeContents(editor);collapsed.collapse(true);window.getSelection().removeAllRanges();window.getSelection().addRange(collapsed);
  expect([editor.selectionStart,editor.selectionEnd]).toEqual([6,11]);
 }
 await clickNamed('Bold');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));
 const saved=getBoard(id).elements[0];expect(saved.fontFamily).toBe('sketch');expect(saved.bold).toBe(false);expect(saved.textRanges).toEqual([{start:6,end:11,style:{fontFamily:'manrope',bold:true}}]);
});

test('a group of selected text objects exposes fonts and changes every selected object',async()=>{
 const id=await renderBoard();
 for(const [text,x] of [['First',100],['Second',300]]){const editor=await startText('Text & Bullets (T)',x,100);await typeText(editor,text);await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));}
 await clickNamed('Select (V)');document.querySelector('main canvas').focus();await act(async()=>window.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'a',metaKey:true,bubbles:true})));
 await clickNamed('Open appearance settings');expect(named('Canvas font library')).toBeTruthy();await chooseCanvasFont('serif');
 const saved=getBoard(id).elements;expect(saved).toHaveLength(2);expect(saved.every(el=>el.fontFamily==='serif')).toBe(true);
});

test('selecting all characters gives the font picker priority over whole-card defaults',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');
 await act(async()=>{editor.select();editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});await clickNamed('Open appearance settings');
 const picker=named('Canvas font library');await act(async()=>{picker.focus();picker.value='playfair';picker.dispatchEvent(new browser.Event('change',{bubbles:true}));});
 expect([editor.selectionStart,editor.selectionEnd]).toEqual([0,11]);
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));
 const saved=getBoard(id).elements[0];expect(saved.fontFamily).toBe('sketch');expect(saved.textRanges).toEqual([{start:0,end:11,style:{fontFamily:'playfair'}}]);
});

for(const tool of ['Text & Bullets (T)','Doc Card (N)','Sticky note (S)'])test(`Enter and Shift Enter insert actual newlines in ${tool}`,async()=>{
  const id=await renderBoard(),editor=await startText(tool);await typeText(editor,'FirstSecond');editor.setSelectionRange(5,5);
  await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter'})));
  expect(editor.value).toBe('First\nSecond');expect(editor.selectionStart).toBe(6);
  editor.setSelectionRange(6,12);await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',shiftKey:true})));
  expect(editor.value).toBe('First\n\n');expect(editor.selectionStart).toBe(7);
  await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,key:'Enter',metaKey:true})));
  expect(getBoard(id).elements[0].text).toBe('First\n\n');
});
test('mobile beforeinput line breaks insert a newline and empty hyphen lists exit on Enter',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'First');editor.setSelectionRange(5,5);
 await act(async()=>editor.dispatchEvent(new browser.InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertParagraph'})));expect(editor.value).toBe('First\n');
 await typeText(editor,'- item\n- ');await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter'})));expect(editor.value).toBe('- item\n');
});

test('Mac undo and redo restore inline text and newlines without undoing the board',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'First');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));await typeText(editor,'First\nSecond');
 const key=async(shift=false)=>act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'z',metaKey:true,shiftKey:shift,bubbles:true,cancelable:true})));
 await key();expect(editor.value).toBe('First\n');await key();expect(editor.value).toBe('First');await key(true);expect(editor.value).toBe('First\n');await key(true);expect(editor.value).toBe('First\nSecond');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));expect(getBoard(id).elements[0].text).toBe('First\nSecond');
});
test('undo and redo from Appearance restore selected formatting and preserve the active editor',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);await clickNamed('Open appearance settings');await clickNamed('Bold');
 const undo=async shift=>act(async()=>named('Bold').dispatchEvent(new browser.KeyboardEvent('keydown',{key:'z',metaKey:true,shiftKey:shift,bubbles:true,cancelable:true})));
 await undo(false);expect(editor.querySelectorAll('span').length).toBe(1);await undo(true);expect(editor.querySelectorAll('span')[1].style.fontWeight).toBe('700');expect(editor.value).toBe('hello world');
});

test('toolbar and native input undo share editing history, and new typing clears redo',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'Alpha');await typeText(editor,'Alpha beta');
 expect(named('Undo').disabled).toBe(false);await clickNamed('Undo');expect(editor.value).toBe('Alpha');await clickNamed('Redo');expect(editor.value).toBe('Alpha beta');
 await act(async()=>editor.dispatchEvent(new browser.InputEvent('beforeinput',{inputType:'historyUndo',bubbles:true,cancelable:true})));expect(editor.value).toBe('Alpha');
 await typeText(editor,'Alpha gamma');expect(named('Redo').disabled).toBe(true);await clickNamed('Undo');expect(editor.value).toBe('Alpha');
});

test('undo restores replaced formatted text and its previous character selection',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);await clickNamed('Open appearance settings');await clickNamed('Bold');editor.focus();editor.setSelectionRange(6,11);
 await act(async()=>editor.dispatchEvent(new browser.InputEvent('beforeinput',{inputType:'insertText',bubbles:true,cancelable:true,data:'team'})));await typeText(editor,'hello team');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'z',metaKey:true,bubbles:true,cancelable:true})));await act(async()=>new Promise(resolve=>window.requestAnimationFrame(resolve)));
 expect(editor.value).toBe('hello world');expect([editor.selectionStart,editor.selectionEnd]).toEqual([6,11]);expect(editor.querySelectorAll('span')[1].style.fontWeight).toBe('700');
});

for(const eventName of ['beforeunload','pagehide'])test(`navigation flushes an active text draft once on ${eventName}`,async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'Draft that must survive refresh');
 await act(async()=>window.dispatchEvent(new browser.Event(eventName)));expect(getBoard(id).elements[0].text).toBe('Draft that must survive refresh');
 await act(async()=>window.dispatchEvent(new browser.Event('pagehide')));expect(getBoard(id).elements).toHaveLength(1);
});

test('quick colors format only selected characters and remember the matching drawing tool',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);
 await clickNamed('Drawing color #A78BFA');expect(named('Edit text')).toBe(editor);
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 expect(getBoard(id).elements[0].textRanges).toEqual([{start:6,end:11,style:{color:'#A78BFA'}}]);
 const prefs=JSON.parse(localStorage.getItem('knotleaf.preferences.v1'));expect(prefs.toolColors.text.stroke).toBe('#A78BFA');expect(prefs.toolColors.rectangle.stroke).toBe(DEFAULT_STYLE.stroke);
 await clickNamed('Rectangle (R)');await clickNamed('Drawing color #22D3EE');await clickNamed('Ellipse (O)');await clickNamed('Rectangle (R)');
 await boardPointer('pointerdown',350,150);await boardPointer('pointermove',450,250);await boardPointer('pointerup',450,250);
 expect(getBoard(id).elements.at(-1).stroke).toBe('#22D3EE');
});

test('quick actions search supports clear, IME-safe execution and keyboard focus restoration',async()=>{
 await renderBoard();const trigger=named('Open quick actions');await act(async()=>trigger.focus());await clickNamed('Open quick actions');const input=named('Search commands');
 expect(document.activeElement).toBe(input);expect(document.querySelector('[data-command-palette]').open).toBe(true);
 await typeText(input,'zzzz-no-match');expect(document.querySelector('[role="option"]')).toBeNull();await clickNamed('Clear command search');expect(input.value).toBe('');expect(document.activeElement).toBe(input);
 await typeText(input,'Ellipse tool');
 await act(async()=>input.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));expect(named('Search commands')).toBe(input);
 await act(async()=>input.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));await act(async()=>new Promise(resolve=>window.requestAnimationFrame(resolve)));
 expect(named('Search commands')).toBeNull();expect(named('Ellipse (O)').getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(trigger);
});

test('command shortcut respects text inputs and other open modal dialogs',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'Keep writing');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true,cancelable:true})));expect(named('Search commands')).toBeNull();
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 await clickNamed('Open quick actions');await typeText(named('Search commands'),'Canvas & notes themes');await act(async()=>named('Search commands').dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));await act(async()=>new Promise(resolve=>window.requestAnimationFrame(resolve)));
 expect(document.querySelector('[aria-labelledby="workspace-themes-title"]').open).toBe(true);
 await act(async()=>window.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true,cancelable:true})));expect(named('Search commands')).toBeNull();
});


test('minimap maps thin strokes and supports keyboard navigation without a drag',async()=>{
 const element={...DEFAULT_STYLE,id:'line-map',type:'line',x:100,y:100,width:200,height:0,startX:100,startY:100,endX:300,endY:100};
 expect(minimapLayout([element]).items).toHaveLength(1);
 let point;await act(async()=>root.render(React.createElement(Minimap,{elements:[element],viewport:{zoom:1,pan:{x:0,y:0}},width:800,height:600,open:true,theme:'dark',onToggle:()=>{},onNavigate:next=>{point=next;}})));
 const map=named('Navigate board map');await act(async()=>map.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));expect(point).toEqual({x:600,y:300});
 await act(async()=>map.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));expect(point.x).toBeCloseTo(200);expect(point.y).toBeCloseTo(100.5);
});

test('Appearance reports mixed formatting and a single toggle applies to the full selected passage',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);await act(async()=>editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true})));await clickNamed('Open appearance settings');await clickNamed('Bold');
 editor.setSelectionRange(0,11);await act(async()=>editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true})));
 expect(named('Bold').getAttribute('aria-pressed')).toBe('mixed');await clickNamed('Bold');expect(named('Bold').getAttribute('aria-pressed')).toBe('true');await clickNamed('Bold');expect(named('Bold').getAttribute('aria-pressed')).toBe('false');
});


for(const [key,label] of [['bold','Bold'],['italic','Italic'],['underline','Underline'],['strikethrough','Strikethrough']])test(`Appearance ${label} toggles selected text, then the whole object, without changing other marks`,async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);await act(async()=>editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true})));await clickNamed('Open appearance settings');
 await clickNamed(label);expect(named(label).getAttribute('aria-pressed')).toBe('true');expect([editor.selectionStart,editor.selectionEnd]).toEqual([6,11]);
 await clickNamed(label);expect(named(label).getAttribute('aria-pressed')).toBe('false');
 editor.setSelectionRange(11,11);await act(async()=>editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true})));await clickNamed(label);
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 const saved=getBoard(id).elements[0];expect(saved[key]).toBe(true);expect(saved.textRanges?.some(range=>key in range.style)||false).toBe(false);expect(saved.text).toBe('hello world');
});

test('group formatting reflects every selected object and one Undo restores the original mixture',async()=>{
 const id=await renderBoard();let editor=await startText();await typeText(editor,'First');editor.select();await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'b',metaKey:true,bubbles:true,cancelable:true})));await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 editor=await startText('Text & Bullets (T)',300,100);await typeText(editor,'Second');await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 const before=structuredClone(getBoard(id).elements);await clickNamed('Select (V)');await act(async()=>{document.querySelector('main canvas').focus();window.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'a',metaKey:true,bubbles:true}));});await clickNamed('Open appearance settings');expect(named('Bold').getAttribute('aria-pressed')).toBe('mixed');await clickNamed('Bold');expect(getBoard(id).elements.every(element=>element.bold)).toBe(true);
 await clickNamed('Undo');expect(getBoard(id).elements).toEqual(before);expect(named('Bold').getAttribute('aria-pressed')).toBe('mixed');
});

const appearancePointer=async(type,x,y,id=51)=>act(async()=>{
 const target=type==='pointerdown'?named('Open appearance settings'):window;
 target.dispatchEvent(new browser.PointerEvent(type,{pointerId:id,button:0,buttons:type==='pointerup'?0:1,pointerType:'mouse',isPrimary:true,clientX:x,clientY:y,bubbles:true,cancelable:true}));
});
test('Appearance dragging follows the pointer, saves its position, and does not open on release',async()=>{
 const props={canvasSize:{width:800,height:600},topOffset:64};await act(async()=>root.render(React.createElement(Inspector,{props})));
 await appearancePointer('pointerdown',40,80);await appearancePointer('pointermove',240,230);expect(named('Open appearance settings').style.left).toBe('208px');expect(named('Open appearance settings').style.top).toBe('214px');
 await appearancePointer('pointerup',240,230);await act(async()=>named('Open appearance settings').dispatchEvent(new browser.MouseEvent('click',{bubbles:true,detail:1})));expect(named('Appearance settings')).toBeNull();
 expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).appearancePosition).toEqual({x:208,y:214});await act(async()=>root.render(null));await act(async()=>root.render(React.createElement(Inspector,{props})));
 expect(named('Open appearance settings').style.left).toBe('208px');await clickNamed('Open appearance settings');expect(named('Appearance settings').style.left).toBe('208px');await clickNamed('Collapse appearance settings');expect(named('Open appearance settings').style.top).toBe('214px');
});
test('Appearance keeps clicks distinct from drags and cancellation restores its original location',async()=>{
 await act(async()=>root.render(React.createElement(Inspector,{props:{canvasSize:{width:800,height:600},topOffset:64}})));
 await appearancePointer('pointerdown',40,80);await appearancePointer('pointermove',42,81);await appearancePointer('pointerup',42,81);await act(async()=>named('Open appearance settings').dispatchEvent(new browser.MouseEvent('click',{bubbles:true,detail:1})));expect(named('Appearance settings')).toBeTruthy();await clickNamed('Collapse appearance settings');
 for(const cancel of ['pointercancel','Escape','blur']){
  await appearancePointer('pointerdown',40,80);await appearancePointer('pointermove',240,230);
  await act(async()=>{if(cancel==='Escape')window.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));else if(cancel==='blur')window.dispatchEvent(new browser.Event('blur'));else window.dispatchEvent(new browser.PointerEvent('pointercancel',{pointerId:51,bubbles:true}));});
  expect(named('Open appearance settings').style.left).toBe('8px');expect(named('Open appearance settings').style.top).toBe('64px');
 }
 expect(localStorage.getItem('knotleaf.preferences.v1')).toBeNull();
});
test('Appearance clamps to a resized canvas, opens within it, and supports keyboard movement and reset',async()=>{
 const props={canvasSize:{width:800,height:600},topOffset:64};await act(async()=>root.render(React.createElement(Inspector,{props})));
 await appearancePointer('pointerdown',40,80);await appearancePointer('pointermove',5000,5000);await appearancePointer('pointerup',5000,5000);expect(named('Open appearance settings').style.left).toBe('660px');expect(named('Open appearance settings').style.top).toBe('556px');
 await act(async()=>root.render(React.createElement(Inspector,{props:{...props,canvasSize:{width:390,height:500}}})));expect(named('Open appearance settings').style.left).toBe('250px');expect(named('Open appearance settings').style.top).toBe('456px');
 await clickNamed('Open appearance settings');expect(named('Appearance settings').style.left).toBe('94px');expect(named('Appearance settings').style.top).toBe('236px');await clickNamed('Collapse appearance settings');
 await act(async()=>named('Open appearance settings').dispatchEvent(new browser.KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true})));expect(named('Open appearance settings').style.left).toBe('240px');
 await act(async()=>named('Open appearance settings').dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Home',altKey:true,bubbles:true,cancelable:true})));expect(named('Open appearance settings').style.left).toBe('8px');expect(named('Open appearance settings').style.top).toBe('64px');expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).appearancePosition).toBeNull();
});

test('Appearance drag and single-shape styling leave unselected artwork unchanged',async()=>{
 const id=await renderBoard();
 for(const x of [100,350,600]){await clickNamed('Rectangle (R)');await boardPointer('pointerdown',x,200);await boardPointer('pointermove',x+100,300);await boardPointer('pointerup',x+100,300);}
 const original=structuredClone(getBoard(id).elements);
 await appearancePointer('pointerdown',40,80);await appearancePointer('pointermove',440,180);await appearancePointer('pointerup',440,180);expect(getBoard(id).elements).toEqual(original);
 await clickNamed('Select (V)');await boardPointer('pointerdown',100,240);await boardPointer('pointerup',100,240);await clickNamed('Open appearance settings');
 await clickNamed('Color #EF4444');expect(getBoard(id).elements[0].stroke).toBe('#EF4444');expect(getBoard(id).elements.slice(1)).toEqual(original.slice(1));
 await clickNamed('Background #48596b');expect(getBoard(id).elements[0].fill).toBe('#48596b');expect(getBoard(id).elements.slice(1)).toEqual(original.slice(1));
 await act(async()=>[...document.querySelectorAll('#appearance-settings button')].find(button=>button.textContent==='4px').click());expect(getBoard(id).elements[0].strokeWidth).toBe(4);expect(getBoard(id).elements.slice(1)).toEqual(original.slice(1));
 await act(async()=>[...document.querySelectorAll('#appearance-settings button')].find(button=>button.textContent==='sharp').click());expect(getBoard(id).elements[0].roundness).toBe('sharp');expect(getBoard(id).elements.slice(1)).toEqual(original.slice(1));
 await act(async()=>{const input=named('Opacity');Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype,'value').set.call(input,'0.5');input.dispatchEvent(new browser.Event('change',{bubbles:true}));input.dispatchEvent(new browser.Event('input',{bubbles:true}));});expect(getBoard(id).elements[0].opacity).toBe(0.5);expect(getBoard(id).elements.slice(1)).toEqual(original.slice(1));
});


test('Appearance can reach the top edge beside the toolbar and open there',async()=>{
 await act(async()=>root.render(React.createElement(Inspector,{props:{canvasSize:{width:800,height:600},topOffset:96}})));
 await appearancePointer('pointerdown',40,110);await appearancePointer('pointermove',340,-100);await appearancePointer('pointerup',340,-100);expect(named('Open appearance settings').style.top).toBe('0px');expect(named('Open appearance settings').style.left).toBe('308px');
 expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).appearancePosition).toEqual({x:308,y:0});await clickNamed('Open appearance settings');expect(named('Appearance settings').style.top).toBe('0px');await clickNamed('Collapse appearance settings');expect(named('Open appearance settings').style.top).toBe('0px');
});

test('arrow labels use the same readable editing surface, save independently, and do not leak card styling to new text',async()=>{
 localStorage.clear();const board=createBoard('Readable labels');board.viewMode='canvas';const base={...DEFAULT_STYLE,type:'arrow',x:600,y:300,width:400,height:0,startX:600,startY:300,endX:1000,endY:300,routing:'straight',zIndex:0};board.elements=[{...base,id:'label-one',label:'First\nSecond'},{...base,id:'label-two',y:500,startY:500,endY:500,label:'Keep this label'}];const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);setActiveBoardId(board.id);
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 await boardPointer('dblclick',800,310);let editor=named('Edit text');expect(editor.style.fontSize).toBe('16px');expect(editor.style.fontWeight).toBe('600');expect(editor.style.padding).toBe('6px 12px');expect(editor.style.background).not.toBe('transparent');await typeText(editor,'Edited\nArrow');await clickNamed('Open appearance settings');expect(named('Arrow label').value).toBe('Edited\nArrow');await typeText(named('Arrow label'),'Saved from\nAppearance');expect(editor.value).toBe('Saved from\nAppearance');await clickNamed('Collapse appearance settings');
 // Starting another text draft commits this label in the same pointer event.
 editor=await startText();expect(editor.style.padding).toBe('0px');expect(editor.style.background).toBe('transparent');expect(editor.style.boxShadow).toBe('none');
 expect(getBoard(board.id).elements.find(element=>element.id==='label-one').label).toBe('Saved from\nAppearance');expect(getBoard(board.id).elements.find(element=>element.id==='label-two')).toEqual(board.elements[1]);
});

test('native multiline insertion preserves line breaks and replaces only the selected text',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'hello world');editor.setSelectionRange(6,11);
 const input=new browser.InputEvent('beforeinput',{inputType:'insertText',data:'team\r\nnext',bubbles:true,cancelable:true});await act(async()=>editor.dispatchEvent(input));expect(input.defaultPrevented).toBe(true);expect(editor.value).toBe('hello team\nnext');expect(editor.selectionStart).toBe(15);
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));expect(getBoard(id).elements[0].text).toBe('hello team\nnext');
});
test('browser-created block lines preserve both text and caret offsets when normalized',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'Original');
 await act(async()=>{editor.innerHTML='<span>First</span><div><span>Second</span></div>';const range=document.createRange();range.setStart(editor.lastChild.firstChild.firstChild,6);range.collapse(true);window.getSelection().removeAllRanges();window.getSelection().addRange(range);editor.dispatchEvent(new browser.InputEvent('input',{inputType:'insertText',data:'Second',bubbles:true}));});
 expect(editor.value).toBe('First\nSecond');expect(editor.selectionStart).toBe(12);expect(editor.innerHTML).not.toContain('<div>');
});
test('software-keyboard Enter continues lists and exits an empty item using the same command',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'- First');
 await act(async()=>editor.dispatchEvent(new browser.InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true})));expect(editor.value).toBe('- First\n- ');
 await act(async()=>editor.dispatchEvent(new browser.InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true})));expect(editor.value).toBe('- First\n');
});
test('rapid Enter and paste use the latest text and caret without deferred selection jumps',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'- First');
 await act(async()=>{for(const text of ['Second','Third']){editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));const paste=new browser.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{getData:()=>text}});editor.dispatchEvent(paste);}});
 expect(editor.value).toBe('- First\n- Second\n- Third');expect(editor.selectionStart).toBe(editor.value.length);
});
test('composition retains native text through formatting rerenders and ignores an unflagged Enter',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'Original');editor.select();await clickNamed('Open appearance settings');
 await act(async()=>{editor.dispatchEvent(new browser.CompositionEvent('compositionstart',{bubbles:true}));editor.textContent='日本';editor.setSelectionRange(2,2);editor.dispatchEvent(new browser.InputEvent('input',{inputType:'insertCompositionText',isComposing:true,bubbles:true}));});
 await clickNamed('Bold');expect(editor.textContent).toBe('日本');await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));expect(editor.value).toBe('日本');
 await act(async()=>editor.dispatchEvent(new browser.CompositionEvent('compositionend',{data:'日本',bubbles:true})));expect(editor.value).toBe('日本');
});
test('blurring during composition flushes the current text before committing the object',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'Original');
 await act(async()=>{editor.dispatchEvent(new browser.CompositionEvent('compositionstart',{bubbles:true}));editor.textContent='文字';editor.dispatchEvent(new browser.InputEvent('input',{inputType:'insertCompositionText',isComposing:true,bubbles:true}));editor.dispatchEvent(new browser.FocusEvent('focusout',{bubbles:true,relatedTarget:document.querySelector('main canvas')}));});
 expect(getBoard(id).elements[0].text).toBe('文字');
});

test('indenting multiple selected lines preserves their independent character formatting',async()=>{
 const id=await renderBoard(),editor=await startText();await typeText(editor,'First\nSecond');editor.setSelectionRange(0,5);await clickNamed('Open appearance settings');await clickNamed('Bold');editor.setSelectionRange(6,12);await clickNamed('Italic');
 editor.focus();editor.select();await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(editor.value).toBe('  First\n  Second');
 await act(async()=>editor.dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true})));
 const ranges=getBoard(id).elements[0].textRanges;expect(ranges.some(range=>range.start<=2&&range.end>=7&&range.style.bold)).toBe(true);expect(ranges.some(range=>range.start<=10&&range.end>=16&&range.style.italic)).toBe(true);expect(ranges.some(range=>range.start<=10&&range.end>=16&&range.style.bold)).toBe(false);
});

test('an empty editor keeps the caret before its placeholder break and clamps textarea-style selections',async()=>{
 await renderBoard();const editor=await startText();editor.setSelectionRange(0,0);expect(editor.firstChild.nodeType).toBe(3);expect(window.getSelection().anchorNode).toBe(editor.firstChild);editor.setSelectionRange(100,200);expect([editor.selectionStart,editor.selectionEnd]).toEqual([0,0]);
 await typeText(editor,'First');editor.setSelectionRange(99,200);expect([editor.selectionStart,editor.selectionEnd]).toEqual([5,5]);
});

test('non-cancelable native insertion is normalized after input rather than inserted twice',async()=>{
 await renderBoard();const editor=await startText();await typeText(editor,'Original');editor.select();const before=new browser.InputEvent('beforeinput',{inputType:'insertText',data:'First\nSecond',bubbles:true,cancelable:false});await act(async()=>editor.dispatchEvent(before));expect(editor.value).toBe('Original');
 await act(async()=>{editor.innerHTML='First<div>Second</div>';editor.dispatchEvent(new browser.InputEvent('input',{inputType:'insertText',data:'Second',bubbles:true}));});expect(editor.value).toBe('First\nSecond');
});


test('code Appearance prioritizes selected source, preserves syntax and siblings, then styles the whole card',async()=>{
 localStorage.clear();const board=createBoard('Code appearance');board.viewMode='canvas';
 const card={...DEFAULT_STYLE,id:'styled-code',type:'text',isCodeCard:true,isDocCard:true,text:'const count = 42;',codeLanguage:'javascript',fontSize:16,fontFamily:'mono',textAlign:'left',x:400,y:250,width:300,height:100,codeAutoSize:false,bold:false,italic:false,fill:'#10151e',fillStyle:'solid'};
 const sibling={...card,id:'other-code',y:500,text:'Keep this unchanged'};board.elements=[card,sibling];const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);setActiveBoardId(board.id);
 await act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Canvas)))));
 await boardPointer('dblclick',420,260);let editor=named('Code source');expect(editor).toBeTruthy();
 await act(async()=>{editor.focus();editor.setSelectionRange(6,11);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});
 await clickNamed('Open appearance settings');await clickNamed('Bold');await clickNamed('Italic');await clickNamed('Underline');await clickNamed('Strikethrough');await chooseCanvasFont('sketch');await clickNamed('Increase font size');
 let saved=getBoard(board.id).elements[0];expect(saved.bold).toBe(false);expect(saved.fontFamily).toBe('mono');expect(saved.textRanges).toEqual([{start:6,end:11,style:{bold:true,italic:true,underline:true,strikethrough:true,fontFamily:'sketch',fontSize:18}}]);
 expect(named('Code source')).toBe(editor);expect(editor.innerHTML).toContain('700');expect(editor.innerHTML).toContain('line-through');expect(getBoard(board.id).elements[1]).toEqual(sibling);
 await act(async()=>{editor.focus();editor.setSelectionRange(0,0);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});
 await clickNamed('Bold');saved=getBoard(board.id).elements[0];expect(saved.bold).toBe(true);expect(saved.textRanges[0].style.bold).toBeUndefined();expect(saved.textRanges[0].style.italic).toBe(true);
 await clickNamed('Finish editing code');await boardPointer('dblclick',420,260);expect(named('Code source').innerHTML).toContain('line-through');expect(getBoard(board.id).elements[1]).toEqual(sibling);
});

test('a whole-code-card font choice is remembered for the next code card',async()=>{
 const id=await renderBoard();
 await clickNamed('Code card (C)');await boardPointer('pointerdown',400,250);await boardPointer('pointerup',400,250);
 await clickNamed('Open appearance settings');await chooseCanvasFont('serif');await clickNamed('Finish editing code');
 await clickNamed('Code card (C)');await boardPointer('pointerdown',700,500);await boardPointer('pointerup',700,500);
 expect(getBoard(id).elements.map(el=>el.fontFamily)).toEqual(['serif','serif']);expect(document.querySelector('.code-source').style.fontFamily).toContain('--font-lora');

});

test('a new code card clears the prior source selection before applying a whole-card font',async()=>{
 const id=await renderBoard();await clickNamed('Code card (C)');await boardPointer('pointerdown',400,250);await boardPointer('pointerup',400,250);
 const editor=named('Code source');await typeText(editor,'const first = 1;');
 await act(async()=>{editor.setSelectionRange(6,11);editor.dispatchEvent(new browser.MouseEvent('mouseup',{bubbles:true}));});await clickNamed('Finish editing code');
 await clickNamed('Code card (C)');await boardPointer('pointerdown',700,500);await boardPointer('pointerup',700,500);await typeText(named('Code source'),'const second = 2;');
 await clickNamed('Open appearance settings');await chooseCanvasFont('serif');
 expect(getBoard(id).elements[1].fontFamily).toBe('serif');expect(getBoard(id).elements[1].textRanges?.length||0).toBe(0);expect(getBoard(id).elements[0].fontFamily).toBe(DEFAULT_STYLE.fontFamily);
});
