import { beforeEach, afterAll, test, expect } from 'bun:test';
import { createBoard, getBoard, getAllBoards, saveBoard, createWorkspace, getWorkspaces, moveBoardToWorkspace, duplicateBoard, deleteBoard, importBoardFromJson, getOrCreateDefaultBoard } from '../lib/storage.ts';
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let data;
beforeEach(() => {
  data = new Map(); Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) } });
});
afterAll(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage; });
test('create workspace, create board, move, duplicate, and delete without affecting other boards', () => {
  const personal = createBoard('Personal notes');
  const workspace = createWorkspace('Architecture'); expect(getWorkspaces()).toHaveLength(2);
  const board = createBoard('System', undefined, workspace.id); expect(getBoard(board.id).workspaceId).toBe(workspace.id);
  board.markdownNotes = '# Decisions\n\n- [ ] Review'; board.viewMode = 'split'; board.snapToGrid = true; expect(saveBoard(board)).toBe(true);
  const restored = getBoard(board.id); expect(restored.markdownNotes).toBe(board.markdownNotes); expect(restored.viewMode).toBe('split'); expect(restored.snapToGrid).toBe(true);
  moveBoardToWorkspace(board.id, 'personal'); expect(getAllBoards().find(b => b.id === board.id).workspaceId).toBe('personal');
  const copy = duplicateBoard(board.id); expect(copy.id).not.toBe(board.id); expect(copy.markdownNotes).toBe(board.markdownNotes);
  deleteBoard(board.id); expect(getBoard(board.id)).toBeNull(); expect(getBoard(personal.id)).not.toBeNull(); expect(getBoard(copy.id)).not.toBeNull();
});
test('JSON round trip retains notes and never overwrites the original', () => {
  const original = createBoard('Project'); original.markdownNotes = 'A & B'; saveBoard(original);
  const imported = importBoardFromJson(JSON.stringify(original)); expect(imported.id).not.toBe(original.id); expect(imported.markdownNotes).toBe('A & B'); expect(getAllBoards()).toHaveLength(2);
});
test('legacy demo-titled board is never silently erased', () => {
  const board = createBoard('Production Cloud Architecture (Demo)'); board.markdownNotes = 'Keep my work'; saveBoard(board);
  expect(getOrCreateDefaultBoard().markdownNotes).toBe('Keep my work');
});
test('storage failure is reported instead of returning a false saved status', () => {
  const board = createBoard(); const original = localStorage.setItem; localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  expect(saveBoard(board)).toBe(false); localStorage.setItem = original;
});
test('malformed imported elements are rejected before reaching the canvas', () => {
  expect(importBoardFromJson(JSON.stringify({ elements: [{ id: 'broken', type: 'arrow' }] }))).toBeNull(); expect(getAllBoards()).toHaveLength(0);
});

test('leaving a room returns to the last personal board without deleting room data', async () => {
  const { getOrCreatePersonalBoard } = await import('../lib/storage.ts');
  const personal = createBoard('My own notes'); personal.markdownNotes = 'Keep personal notes'; saveBoard(personal);
  const room = createBoard('Shared board', undefined, 'personal', crypto.randomUUID()); room.markdownNotes = 'Keep shared notes'; saveBoard(room);
  const returned = getOrCreatePersonalBoard();
  expect(returned.id).toBe(personal.id); expect(returned.markdownNotes).toBe('Keep personal notes'); expect(getBoard(room.id).markdownNotes).toBe('Keep shared notes');
});

test('leaving a room creates a personal board when the browser only has room copies', async () => {
  const { getOrCreatePersonalBoard } = await import('../lib/storage.ts');
  const room = createBoard('Shared board', undefined, 'personal', crypto.randomUUID());
  const personal = getOrCreatePersonalBoard();
  expect(personal.id).not.toBe(room.id); expect(personal.elements).toHaveLength(0); expect(getBoard(room.id)).not.toBeNull();
});

test('personal startup never edits a cached shared room as an unsynchronized personal board', () => {
  const personal = createBoard('Personal');
  const room = createBoard('Shared', undefined, 'personal', crypto.randomUUID());
  expect(getOrCreateDefaultBoard().id).toBe(personal.id);
  expect(getBoard(room.id).title).toBe('Shared');
});

test('legacy boards missing notes are normalized for room creation', () => {
  const board = createBoard('Legacy');
  delete board.markdownNotes; saveBoard(board);
  expect(getBoard(board.id).markdownNotes).toBe('');
});

test('personal drawing can start even if browser storage is blocked', () => {
  const read = localStorage.getItem, write = localStorage.setItem;
  localStorage.getItem = localStorage.setItem = () => { throw new Error('Storage is blocked'); };
  try { expect(getOrCreateDefaultBoard().elements).toEqual([]); }
  finally { localStorage.getItem = read; localStorage.setItem = write; }
});

test('portable project round trip preserves notes, styling, icons and bound connector IDs', async () => {
  const { serializeProject } = await import('../lib/projectFile.ts');
  const board = createBoard('Portable project');
  const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
  board.elements = [{ ...base, id: 'shape', type: 'rectangle', x: 10, y: 20, width: 120, height: 80 }, { ...base, id: 'arrow', type: 'arrow', x: 130, y: 60, width: 70, height: 40, startX: 130, startY: 60, endX: 200, endY: 100, startBinding: { elementId: 'shape', anchor: 'right' } }, { ...base, id: 'icon', type: 'icon', x: 200, y: 100, width: 48, height: 48, iconId: 'online:lucide:cloud', svgMarkup: '<path d="M0 0h24v24z"/>', viewBox: '0 0 24 24' }, { ...base, id: 'text', type: 'text', x: 400, y: 100, width: 150, height: 30, text: 'Résumé नमस्ते', fontSize: 24, fontFamily: 'sans', bold: true, containerId: 'shape', containerOffset: { x: 0.25, y: 0.25 } }];
  board.markdownNotes = '# Unicode notes\n\n- [x] नमस्ते\n\n```js\nconst result = true;\n```'; board.viewMode = 'split'; board.snapToGrid = true;
  saveBoard(board); const original = JSON.stringify(board);
  const restored = importBoardFromJson(serializeProject(board));
  expect(restored.id).not.toBe(board.id); expect(restored.elements).toEqual(board.elements); expect(restored.markdownNotes).toBe(board.markdownNotes);
  expect(restored.viewMode).toBe('split'); expect(restored.snapToGrid).toBe(true); expect(JSON.stringify(getBoard(board.id))).toBe(original);
});

test('canvas-only and notes-only portable files contain exactly the requested content', async () => {
  const { serializeProject } = await import('../lib/projectFile.ts');
  const board = createBoard('Scope test'); board.markdownNotes = '# Keep notes'; board.workspaceId = 'foreign-workspace';
  const snapshot = JSON.stringify(board);
  const canvas = importBoardFromJson(serializeProject(board, 'canvas'));
  const notes = importBoardFromJson(serializeProject(board, 'notes'));
  expect(canvas.markdownNotes).toBe(''); expect(canvas.viewMode).toBe('canvas');
  expect(notes.elements).toEqual([]); expect(notes.markdownNotes).toBe('# Keep notes'); expect(notes.viewMode).toBe('notes');
  expect(notes.workspaceId).toBe('personal'); expect(JSON.stringify(board)).toBe(snapshot);
});

test('Markdown opens as a new editable notes board, including Unicode and empty notes', async () => {
  const { importBoardFile } = await import('../lib/storage.ts');
  const board = importBoardFile('\uFEFF# Decisions\n\nRésumé नमस्ते', 'Meeting.md');
  expect(board.markdownNotes).toBe('# Decisions\n\nRésumé नमस्ते'); expect(board.viewMode).toBe('notes'); expect(board.elements).toEqual([]);
  expect(importBoardFile('', 'Empty.markdown').markdownNotes).toBe('');
});

test('unknown portable versions and duplicate element IDs cannot create or overwrite a board', async () => {
  const board = createBoard('Original'); board.markdownNotes = 'Keep me'; saveBoard(board);
  expect(importBoardFromJson(JSON.stringify({ format: 'knotleaf.project', version: 2, scope: 'project', board }))).toBeNull();
  const el = { id: 'same', type: 'rectangle', x: 0, y: 0, width: 100, height: 80, stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
  expect(importBoardFromJson(JSON.stringify({ ...board, elements: [el, el] }))).toBeNull();
  expect(getAllBoards()).toHaveLength(1); expect(getBoard(board.id).markdownNotes).toBe('Keep me');
});
