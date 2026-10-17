import { test, expect } from 'bun:test';
import { expandCodeTabs, highlightCode, highlightNotesSource } from '../lib/code.ts';
import { RoomSession } from '../lib/collaboration.ts';
import * as Y from 'yjs';
test('code highlighting escapes source and retains exact multiline content', () => {
  const source = 'const x = "<script>alert(1)</script>";\n// comment\n';
  const result = highlightCode(source, 'javascript');
  expect(result.language).toBe('javascript'); expect(result.html).not.toContain('<script>');
  expect(result.lines.map(l => l.map(t => t.text).join('')).join('\n')).toBe(source);
  expect(result.lines.flat().some(t => t.color === '#b8a8c4')).toBe(true);
  expect(highlightCode('def hello():\n    print("hello")\n', 'auto').language).toBe('python');
});
test('concurrent shared code edits merge characters and deletion cannot resurrect a card', () => {
  const code = { stroke: '#fff', strokeWidth: 1, strokeStyle: 'solid', fill: '#10151e', fillStyle: 'solid', roundness: 'rounded', opacity: 1, id: 'code1', type: 'text', isCodeCard: true, codeLanguage: 'javascript', text: '', x: 0, y: 0, width: 300, height: 100, fontSize: 14, zIndex: 0 };
  const a = new RoomSession('ws://localhost:1', crypto.randomUUID()), b = new RoomSession('ws://localhost:1', crypto.randomUUID());
  const base = { title: 'Class', elements: [code], markdownNotes: '' };
  let first, second; a.onRemote = (elements, markdownNotes, title) => { first = { ...base, elements, markdownNotes, title }; }; b.onRemote = (elements, markdownNotes, title) => { second = { ...base, elements, markdownNotes, title }; };
  try {
    a.synced = true; b.synced = true;
    a.elements.set(code.id, code); a.doc.getText('code:code1').insert(0, 'Hello'); Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    a.update({ ...first, elements: [{ ...first.elements[0], text: 'Hello world' }] });
    b.update({ ...second, elements: [{ ...second.elements[0], text: 'Say Hello' }] });
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc)); Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(first.elements[0].text).toBe('Say Hello world'); expect(second.elements[0].text).toBe('Say Hello world');
    const stale = structuredClone(second); a.update({ ...first, elements: [] }); Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    b.update({ ...stale, elements: [{ ...stale.elements[0], text: 'stale edit' }] });
    expect(b.elements.size).toBe(0);
  } finally { a.destroy(); b.destroy(); }
});

test('canvas tabs use the same two-column stops as the inline cursor layer', () => {
  expect(expandCodeTabs('a\tb\n\tfoo\tbar')).toBe('a b\n  foo bar');
});

test('notes highlight code while typing, including unfinished fences, without changing source', () => {
  const source = '# Lesson\n\n```python\ndef hello():\n  print("<hello>")\n```\nNext paragraph';
  const html = highlightNotesSource(source);
  expect(html).toContain('hljs-keyword'); expect(html).not.toContain('<hello>');
  const plain = html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  expect(plain).toBe(source);
  expect(highlightNotesSource('```python\ndef hello():\n')).toContain('hljs-keyword');
});
