import { beforeEach, afterAll, test, expect } from 'bun:test';
import { saveVersion, listVersions, removeVersion, saveCustomTemplate, listCustomTemplates, removeCustomTemplate, searchBoard } from '../lib/boardLibrary.ts';
const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let data;
beforeEach(() => { data = new Map(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } }); });
afterAll(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; });
const board = () => ({ id: crypto.randomUUID(), title: 'Project', elements: [], markdownNotes: '# Decisions\n\nKeep this work', createdAt: 1, updatedAt: 1, theme: 'dark', viewMode: 'split', gridType: 'dot', snapToGrid: false, zoom: 1, panOffset: { x: 0, y: 0 } });
test('history checkpoints are immutable, newest first and bounded to 20 versions', () => {
  const source = board();
  for (let index = 0; index < 25; index++) { source.markdownNotes = `Revision ${index}`; saveVersion(source, `Version ${index}`); }
  source.markdownNotes = 'Unsaved new text';
  const versions = listVersions(source.id); expect(versions).toHaveLength(20); expect(versions[0].name).toBe('Version 24'); expect(versions[0].board.markdownNotes).toBe('Revision 24');
  removeVersion(source.id, versions[0].id); expect(listVersions(source.id)[0].name).toBe('Version 23');
});
test('automatic history avoids per-keystroke storage writes while manual checkpoints remain available', () => {
  const source = board(); expect(saveVersion(source, 'Automatic', true)).not.toBeNull();
  source.markdownNotes = 'Edited'; expect(saveVersion(source, 'Automatic', true)).toBeNull();
  expect(listVersions(source.id)).toHaveLength(1);
  saveVersion(source, 'Manual'); expect(listVersions(source.id)).toHaveLength(2);
});
test('template creation preserves source content, exports independent snapshots and validates names', () => {
  const source = board(), saved = saveCustomTemplate(source, 'System blueprint');
  source.markdownNotes = 'Different'; expect(listCustomTemplates()[0].board.markdownNotes).toContain('Decisions');
  expect(() => saveCustomTemplate(source, ' ')).toThrow('template name');
  removeCustomTemplate(saved.id); expect(listCustomTemplates()).toEqual([]);
});
test('quota failures are reported without damaging previous versions or templates', () => {
  const source = board(); saveVersion(source); saveCustomTemplate(source, 'Keep');
  const original = localStorage.setItem; localStorage.setItem = () => { throw new Error('Quota'); };
  expect(() => saveVersion(source, 'Failed')).toThrow('History could not');
  expect(() => saveCustomTemplate(source, 'Failed')).toThrow('Template could not');
  localStorage.setItem = original; expect(listVersions(source.id)).toHaveLength(1); expect(listCustomTemplates()).toHaveLength(1);
});
test('search covers text, sticky notes, labels, icons, frames and exact Markdown offsets', () => {
  const elements = [{ id: 'text', type: 'text', text: 'Cloud API' }, { id: 'sticky', type: 'sticky', text: 'Cloud TODO' }, { id: 'shape', type: 'rectangle', label: 'Cloud app' }, { id: 'icon', type: 'icon', iconName: 'Cloud service' }, { id: 'frame', type: 'frame', title: 'Cloud overview' }];
  const notes = 'First Cloud note\nNext cloud note';
  const found = searchBoard(elements, notes, ' cloud '); expect(found).toHaveLength(7);
  for (const match of found.filter(match => match.kind === 'notes')) expect(notes.slice(match.index, match.index + 5).toLowerCase()).toBe('cloud');
  expect(searchBoard(elements, notes, '')).toEqual([]); expect(searchBoard(elements, notes, 'missing')).toEqual([]);
  expect(searchBoard([], 'word '.repeat(500), 'word')).toHaveLength(200);
});
