import type { Board } from '@/draw/types';
export const PROJECT_FORMAT = 'knotleaf.project';
export const PROJECT_VERSION = 1;
export type ExportScope = 'project' | 'canvas' | 'notes';
export function serializeProject(board: Board, scope: ExportScope = 'project'): string {
  if(board.largeMarkdown&&scope!=="canvas")throw new Error('Download the uploaded Markdown separately from Uploaded Markdown. Large files are not embedded in project backups.');
  const copy: Board = structuredClone(board);
  delete copy.importedMarkdownId; delete copy.largeMarkdown;
  delete copy.workspaceId; // Imports choose a workspace on the receiving device.
  if (scope === 'canvas') { copy.markdownNotes = ''; copy.viewMode = 'canvas'; }
  if (scope === 'notes') { copy.elements = []; copy.viewMode = 'notes'; }
  return JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, scope, board: copy }, null, 2);
}
export function readProjectPayload(text: string): unknown {
  const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (parsed && typeof parsed === 'object' && 'format' in parsed) {
    if (parsed.format !== PROJECT_FORMAT || parsed.version !== PROJECT_VERSION || !['project', 'canvas', 'notes'].includes(parsed.scope)) throw new Error('Unsupported project file version.');
    return parsed.board;
  }
  return parsed; // Existing JSON backups remain supported.
}
export function safeFilename(title: string) { return title.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 100) || 'Untitled board'; }
