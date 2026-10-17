import type { Board, CanvasElement } from '@/draw/types';
import { isValidElement } from './storage';
export interface BoardVersion { id: string; name: string; createdAt: number; board: Board }
export type CustomTemplate = BoardVersion;
const HISTORY_PREFIX = 'knotleaf_history_';
const TEMPLATES = 'knotleaf_custom_templates';
const HISTORY_BYTES = 8_000_000;
const automaticChecks = new Map<string, number>();
export function listVersions(boardId: string): BoardVersion[] {
  try { const data = JSON.parse(localStorage.getItem(HISTORY_PREFIX + boardId) || '[]'); return Array.isArray(data) ? data.filter(validEntry) : []; } catch { return []; }
}
function validEntry(entry: BoardVersion) { return entry && typeof entry.id === 'string' && typeof entry.name === 'string' && Number.isFinite(entry.createdAt) && entry.board && typeof entry.board.title === 'string' && typeof entry.board.markdownNotes === 'string' && Array.isArray(entry.board.elements) && entry.board.elements.every(isValidElement); }
function content(board: Board) { return JSON.stringify([board.title, board.elements, board.markdownNotes, board.gridType, board.snapToGrid, board.viewMode]); }
export function saveVersion(board: Board, name = 'Checkpoint', automatic = false): BoardVersion | null {
  if (automatic) {
    if (Date.now() - (automaticChecks.get(board.id) || 0) < 300_000) return null;
    automaticChecks.set(board.id, Date.now());
    if (automaticChecks.size > 256) automaticChecks.delete(automaticChecks.keys().next().value!);
  }
  const versions = listVersions(board.id);
  if (automatic && versions[0] && (Date.now() - versions[0].createdAt < 300_000 || content(versions[0].board) === content(board))) return null;
  const entry = { id: crypto.randomUUID(), name: name.trim().slice(0, 80) || 'Checkpoint', createdAt: Date.now(), board: structuredClone(board) };
  const next = [entry, ...versions].slice(0, 20);
  let serialized = JSON.stringify(next);
  while (new TextEncoder().encode(serialized).byteLength > HISTORY_BYTES && next.length > 1) { next.pop(); serialized = JSON.stringify(next); }
  if (new TextEncoder().encode(serialized).byteLength > HISTORY_BYTES) throw new Error('This board is too large for local history. Download a project backup.');
  try { localStorage.setItem(HISTORY_PREFIX + board.id, serialized); } catch { throw new Error('History could not be saved. Free browser storage or download a project backup.'); }
  return entry;
}
export function removeVersion(boardId: string, id: string) { localStorage.setItem(HISTORY_PREFIX + boardId, JSON.stringify(listVersions(boardId).filter(entry => entry.id !== id))); }
export function clearVersions(boardId: string) { localStorage.removeItem(HISTORY_PREFIX + boardId); }
export function listCustomTemplates(): CustomTemplate[] {
  try { const data = JSON.parse(localStorage.getItem(TEMPLATES) || '[]'); return Array.isArray(data) ? data.filter(validEntry) : []; } catch { return []; }
}
export function saveCustomTemplate(board: Board, name: string): CustomTemplate {
  if (!name.trim() || name.trim().length > 80) throw new Error('Enter a template name of 1–80 characters.');
  const entry = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now(), board: structuredClone(board) };
  try { localStorage.setItem(TEMPLATES, JSON.stringify([entry, ...listCustomTemplates()])); } catch { throw new Error('Template could not be saved. Free browser storage and retry.'); }
  return entry;
}
export function removeCustomTemplate(id: string) { localStorage.setItem(TEMPLATES, JSON.stringify(listCustomTemplates().filter(entry => entry.id !== id))); }
export interface BoardMatch { id: string; kind: string; text: string; index?: number }
export function searchBoard(elements: CanvasElement[], notes: string, query: string): BoardMatch[] {
  const needle = query.trim().toLocaleLowerCase(); if (!needle) return [];
  const matches: BoardMatch[] = [];
  for (const el of elements) {
    const text = el.type === 'text' || el.type === 'sticky' ? el.text : el.type === 'frame' ? el.title : el.type === 'icon' ? el.iconName || el.iconId : el.label || '';
    if (text.toLocaleLowerCase().includes(needle)) matches.push({ id: el.id, kind: el.type, text });
  }
  const lower = notes.toLocaleLowerCase();
  let offset = 0;
  while (matches.length < 200) {
    const index = lower.indexOf(needle, offset); if (index < 0) break;
    matches.push({ id: `notes-${index}`, kind: 'notes', index, text: notes.slice(Math.max(0, index - 45), index + needle.length + 80) }); offset = index + Math.max(needle.length, 1);
  }
  return matches.slice(0, 200);
}
