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
