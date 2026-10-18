import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { TopToolbar } from '../components/TopToolbar.tsx';
import { DEFAULT_STYLE } from '../draw/types.ts';
import { FONT_OPTIONS } from '../draw/fonts.ts';
const noop = () => {};
const props = { selectedElement: null, selectedTool: 'select', selectionCount: 1, currentStyle: DEFAULT_STYLE, onSwapArrow: noop, onChangeFontSize: noop, onUpdateStyle: noop, onUpdateElement: noop, onDuplicate: noop, onDelete: noop, onBringToFront: noop, onSendToBack: noop, theme: 'dark' };
test('choosing Arrow immediately exposes all routing modes', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedTool: 'arrow' }));
  expect(html).toContain('aria-label="Arrow routing"');
  for (const label of ['Straight', 'Elbow', 'Curved']) expect(html).toContain(label);
  expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Elbow/s);
});
test('legacy arrows without routing show Straight even when new arrows default to Elbow', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, id: 'legacy', type: 'arrow' } }));
  expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Straight/s);
});
test('selected straight and curved arrows expose a keyboard bend control', () => {
  for (const [routing, bendOffset, value] of [['straight', undefined, 0], ['curved', -100, -50]]) {
    const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, id: 'bend', type: 'arrow', startX: 100, startY: 100, endX: 500, endY: 100, routing, bendOffset } }));
    expect(html).toContain('Drag the center diamond');
    expect(html).toMatch(new RegExp(`aria-label="Arrow bend in pixels"[^>]*value="${value}"`));
    expect(html).toContain('Choose Straight to reset');
  }
});
test('icon inspector omits irrelevant background, line and text controls', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { id: 'icon', type: 'icon', iconColor: '#fff', ...DEFAULT_STYLE }, topOffset: 96 }));
  expect(html).toContain('Icon color'); expect(html).toContain('Opacity'); expect(html).toContain('top:96px');
  expect(html).not.toContain('Background Fill'); expect(html).not.toContain('Line &amp; corners'); expect(html).not.toContain('font size');
});
test('text inspector keeps formatting visible and secondary document controls collapsed', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, isTextEditing: true, selectedElement: { id: 'text', type: 'text', text: 'Hello', fontSize: 24, fontFamily: 'sans', ...DEFAULT_STYLE } }));
  expect(html).toContain('aria-label="Bold"'); expect(html).toContain('aria-label="Underline"');
  expect(html).toContain('Document card</summary>'); expect(html).toContain('Lists</summary>');
  expect(html).not.toMatch(/<details[^>]*\bopen/); expect(html).not.toContain('Background Fill');
});
test('font picker previews all seven families and announces the selected font', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, isTextEditing: true, currentStyle: { ...DEFAULT_STYLE, fontFamily: 'serif' } }));
  expect(html).toContain('aria-label="Font family"'); expect(FONT_OPTIONS).toHaveLength(7);
  for (const font of FONT_OPTIONS) expect(html).toContain(`aria-label="Font: ${font.label}"`);
  expect(html).toContain('aria-label="Font: Lora" aria-pressed="true"');
  expect(html).toContain('var(--font-lora)');
});
test('drawing tools expose visible shortcuts and keyboard metadata', () => {
  const html = renderToStaticMarkup(React.createElement(TopToolbar, { selectedTool: 'select', setSelectedTool: noop, onUndo: noop, onRedo: noop, canUndo: true, canRedo: true, onOpenIconPicker: noop, theme: 'dark' }));
  for (const key of ['v', 'h', 'r', 'd', 'o', 'a', 'l', 'p', 't', 'n', 's', 'f', 'e', 'i']) {
    expect(html).toContain(`aria-keyshortcuts="${key}"`);
    expect(html).toContain(`>${key.toUpperCase()}</kbd>`);
  }
});


test('selected lines expose a signed bend input and straight reset instructions', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, id: 'line', type: 'line', bendOffset: -80 } }));
  expect(html).toMatch(/aria-label="Line bend in pixels"[^>]*value="-40"/);
  expect(html).toContain('Set 0 for a straight line');
});


test('Appearance separates shape fill opacity from whole-object and canvas opacity', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, background: { fill: '#123456', fillStyle: 'dots', fillOpacity: 0.6 }, onBackgroundChange: noop, selectedElement: { ...DEFAULT_STYLE, type: 'rectangle', id: 'fill', fill: '#ec4899', fillStyle: 'crosshatch', fillOpacity: 0.25, opacity: 0.8 } }));
  expect(html).toContain('aria-label="Background opacity"'); expect(html).toContain('aria-label="Canvas background opacity"'); expect(html).toContain('aria-label="Opacity"');
  expect(html).toContain('Custom fill color'); expect(html).toContain('Crosshatch'); expect(html).toContain('Transparent'); expect(html).toContain('Opaque');
});


test('legacy translucent swatches report their effective fill opacity', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, type: 'rectangle', id: 'legacy-alpha', fill: 'rgba(59, 130, 246, 0.2)', fillStyle: 'solid' } }));
  expect(html).toMatch(/aria-label="Background opacity"[^>]*value="0.2"/); expect(html).toContain('value="#3b82f6"');
});
