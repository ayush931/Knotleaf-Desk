import { loadPreferences } from './preferences';
import type { Board } from '@/draw/types';
import { createBoard, deleteBoard, getActiveBoardId, getAllBoards, getBoard, importBoardFile, saveBoard, setActiveBoardId } from './storage';
import { deleteMarkdownFile, downloadMarkdownBlob, expiredMarkdownFiles, getMarkdownFile, markdownDownloadBlob, storeMarkdownFile, touchMarkdownFile, type ImportOptions } from './markdownFiles';

export async function readImportText(file: File, { signal, onProgress }: ImportOptions): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    const cancel = () => reader.abort();
    const clean = () => { signal.removeEventListener('abort',cancel); reader.onload=reader.onerror=reader.onabort=reader.onprogress=null; };
    reader.onprogress = event => { if (event.lengthComputable) onProgress({phase:'Reading file',percent:Math.floor(event.loaded/Math.max(1,event.total)*100)}); };
    reader.onload = () => { const text = reader.result; clean(); if(signal.aborted) reject(signal.reason); else if(typeof text==='string') resolve(text); else reject(new Error('Could not read this file.')); };
    reader.onerror = () => { clean(); reject(new Error('Could not read this file. Select it again and retry.')); };
    reader.onabort = () => { clean(); reject(signal.reason || new DOMException('Import cancelled','AbortError')); };
    signal.addEventListener('abort',cancel,{once:true}); reader.readAsText(file);
  });
}
export async function importLocalFile(file: File, options: ImportOptions, workspaceId: string): Promise<Board> {
  let previousId = getActiveBoardId();
  let importedId: string | undefined, boardId: string | undefined;
  try {
    let board: Board | null;
    if (/\.(md|markdown)$/i.test(file.name)) {
      const info = await storeMarkdownFile(file,options); importedId=info.id;
      options.signal.throwIfAborted();
      options.onProgress({phase:'Opening notes'});
      const text = info.large ? '' : await file.text();
      options.signal.throwIfAborted();
      previousId=getActiveBoardId();
      board = createBoard(file.name.replace(/\.(md|markdown)$/i,''),undefined,workspaceId,`import-${crypto.randomUUID()}`);
      boardId=board.id;
      board.markdownNotes=text.replace(/^\uFEFF/,''); board.importedMarkdownId=info.id; board.largeMarkdown=info.large; board.viewMode='notes';
      if(!saveBoard(board)) throw new Error('Could not save the project. Free browser storage and retry.');
      await touchMarkdownFile(info.id,board.id);
    } else {
      if(file.size>50_000_000) throw new Error('Project backups have a 50 MB limit. Markdown files use separate large-file storage.');
      const text=await readImportText(file,options); options.signal.throwIfAborted();
      options.onProgress({phase:'Opening project'});
      previousId=getActiveBoardId();
      board=importBoardFile(text,file.name);
      if(!board) throw new Error('Could not open this backup. Check its format and available storage.');
      boardId=board.id;board.workspaceId=workspaceId;
      if(!saveBoard(board)) throw new Error('Could not save the imported project.');
    }
    options.signal.throwIfAborted();
    return board;
  } catch(error) {
    const activeBeforeRollback=getActiveBoardId();
    if(boardId) deleteBoard(boardId);
    if(previousId&&(!activeBeforeRollback||activeBeforeRollback===boardId))setActiveBoardId(previousId);
    if(importedId) { try { await deleteMarkdownFile(importedId); } catch { const failure=new Error('Import stopped, but temporary data could not be removed. Open Uploaded Markdown and delete the incomplete import.');failure.name='ImportCleanupError';throw failure; } }
    throw error;
  }
}
/** Deletion includes note caches/history; unrelated canvas objects and personal projects survive. */
export async function removeImportedMarkdown(id: string) {
  // Clear local note copies first; retain the stored upload if cache cleanup needs a retry.
  for(const summary of getAllBoards()) {
    const board=getBoard(summary.id);
    if(board?.importedMarkdownId!==id) continue;
    localStorage.removeItem(`knotleaf_history_${board.id}`);
    if(!board.elements.length) deleteBoard(board.id);
    else {
      delete board.importedMarkdownId; delete board.largeMarkdown; board.markdownNotes='';
      localStorage.setItem(`excali_eraser_board_${board.id}`,JSON.stringify(board));
    }
  }
  await deleteMarkdownFile(id);
  window.dispatchEvent(new Event('knotleaf-markdown-files'));
  localStorage.setItem('knotleaf.markdown-files.changed',String(Date.now()));
}
let cleaning: Promise<number> | undefined;
export function cleanupImportedMarkdown(activeId?: string): Promise<number> {
  if(cleaning) return cleaning;
  cleaning=(async()=>{
    const expired=await expiredMarkdownFiles(activeId,Date.now(),loadPreferences().markdownRetentionDays===0?Infinity:7*24*60*60*1000);
    let removed=0;
    for(const file of expired){const latest=await getMarkdownFile(file.id);if(latest&&latest.lastOpenedAt===file.lastOpenedAt){await removeImportedMarkdown(file.id);removed++;}}
    return removed;
  })().finally(()=>{cleaning=undefined;});
  return cleaning;
}
export async function downloadImportedMarkdown(id: string, name: string, boardId?: string, large = true) {
  const board=boardId?getBoard(boardId):null;
  const blob=!large&&board?.importedMarkdownId===id?new Blob([board.markdownNotes],{type:'text/markdown;charset=utf-8'}):await markdownDownloadBlob(id);
  await touchMarkdownFile(id);
  downloadMarkdownBlob(blob,name);
}
