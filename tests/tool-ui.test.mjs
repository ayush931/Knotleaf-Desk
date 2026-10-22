import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { TopToolbar } from '../components/TopToolbar.tsx';
import { DEFAULT_STYLE } from '../draw/types.ts';
import { FONT_OPTIONS, QUICK_FONTS } from '../draw/fonts.ts';
const noop = () => {};
const props = { isOpen: true, onOpenChange: noop, selectedElement: null, selectedTool: 'select', selectionCount: 1, currentStyle: DEFAULT_STYLE, onSwapArrow: noop, onChangeFontSize: noop, onUpdateStyle: noop, onUpdateElement: noop, onDuplicate: noop, onDelete: noop, onBringToFront: noop, onSendToBack: noop, theme: 'dark' };
test('manually opened Arrow inspector exposes all routing modes', () => {
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
test('font picker retains quick previews and offers the full grouped collection', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, isTextEditing: true, currentStyle: { ...DEFAULT_STYLE, fontFamily: 'serif' } }));
  expect(html).toContain('aria-label="Font family"'); expect(QUICK_FONTS).toHaveLength(7);expect(FONT_OPTIONS).toHaveLength(30);
  for (const font of QUICK_FONTS) expect(html).toContain(`aria-label="Font: ${font.label}"`);
  expect(html).toContain('aria-label="More fonts"');for(const font of FONT_OPTIONS)expect(html).toContain(`<option value="${font.id}"`);expect(html).toContain('label="Playful &amp; display"');
  expect(html).toContain('aria-label="Font: Lora" aria-pressed="true"');
  expect(html).toContain('var(--font-lora)');
});
test('compact drawing tools retain shortcuts in accessible metadata and tooltips', () => {
  const html = renderToStaticMarkup(React.createElement(TopToolbar, { selectedTool: 'select', setSelectedTool: noop, onUndo: noop, onRedo: noop, canUndo: true, canRedo: true, onOpenIconPicker: noop, theme: 'dark' }));
  for (const key of ['v', 'h', 'r', 'd', 'o', 'a', 'l', 'p', 't', 'n', 's', 'f', 'e', 'i']) {
    expect(html).toContain(`aria-keyshortcuts="${key}"`);
    expect(html).toContain(`(${key.toUpperCase()})`);
  }
});


test('selected lines expose a signed bend input and straight reset instructions', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, id: 'line', type: 'line', bendOffset: -80 } }));
  expect(html).toMatch(/aria-label="Line bend in pixels"[^>]*value="-40"/);
  expect(html).toContain('Set 0 for a straight line');
});


test('Appearance offers background colors and previewed patterns without fill-opacity controls', () => {
  const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, selectedElement: { ...DEFAULT_STYLE, type: 'rectangle', id: 'fill', fill: '#ec4899', fillStyle: 'crosshatch', fillOpacity: 0.25, opacity: 0.8 } }));
  expect(html).toContain('Background color'); expect(html).toContain('No background'); expect(html).toContain('Crosshatch'); expect(html).not.toContain('aria-label="Background opacity"');
  expect(html).toContain('aria-label="Opacity"');
});

test('Appearance defaults closed for every selected tool and element, including text editing', () => {
  for (const tool of ['select', 'rectangle', 'arrow', 'fill', 'eyedropper', 'text', 'pencil', 'doc', 'sticky', 'code']) {
    const html = renderToStaticMarkup(React.createElement(PropertiesPanel, { ...props, isOpen: false, selectedTool: tool, isTextEditing: true, selectedElement: { ...DEFAULT_STYLE, type: 'rectangle', id: 'created' } }));
    expect(html).toContain('aria-label="Open appearance settings"'); expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain('role="region"');
  }
});
