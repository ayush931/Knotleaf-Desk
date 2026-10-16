import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertiesPanel } from '../components/PropertiesPanel.tsx';
import { TopToolbar } from '../components/TopToolbar.tsx';
import { DEFAULT_STYLE } from '../draw/types.ts';
const noop = () => {};
const props = { selectedElement: null, selectedTool: 'select', selectionCount: 1, currentStyle: DEFAULT_STYLE, onSwapArrow: noop, onChangeFontSize: noop, onUpdateStyle: noop, onUpdateElement: noop, onDuplicate: noop, onDelete: noop, onBringToFront: noop, onSendToBack: noop, theme: 'dark' };
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
test('drawing tools expose visible shortcuts and keyboard metadata', () => {
  const html = renderToStaticMarkup(React.createElement(TopToolbar, { selectedTool: 'select', setSelectedTool: noop, onUndo: noop, onRedo: noop, canUndo: true, canRedo: true, onOpenIconPicker: noop, theme: 'dark' }));
  for (const key of ['v', 'h', 'r', 'd', 'o', 'a', 'l', 'p', 't', 'n', 's', 'f', 'e', 'i']) {
    expect(html).toContain(`aria-keyshortcuts="${key}"`);
    expect(html).toContain(`>${key.toUpperCase()}</kbd>`);
  }
});
