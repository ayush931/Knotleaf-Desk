/** Large Markdown lives as Blobs in IndexedDB; only one bounded section is decoded at a time. */
export const MARKDOWN_PAGE_BYTES = 64 * 1024;
export const LARGE_MARKDOWN_BYTES = 128 * 1024;
export const MARKDOWN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export interface MarkdownFileInfo {
  id: string; name: string; size: number; offsets: number[]; createdAt: number; lastOpenedAt: number;
  state: 'importing' | 'ready'; boardId?: string; large: boolean; revisions?: Record<number,number>;
}
export interface FileProgress { phase: string; percent?: number }
export interface ImportOptions { signal: AbortSignal; onProgress: (progress: FileProgress) => void }
const DB_NAME = 'knotleaf-markdown-files';
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('File storage is unavailable. Enable website storage and retry.')); return; }
    let failed=false;
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('files');
      db.createObjectStore('edits');
    };
    request.onerror = () => {failed=true;reject(new Error('Could not open file storage. Check browser storage permissions.'));};
    request.onblocked = () => {failed=true;reject(new Error('Close older Knotleaf tabs and retry opening file storage.'));};
    request.onsuccess = () => {
      const db = request.result;
      if(failed){db.close();return;}
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
  }).catch(error => { connection = undefined; throw error; });
  return connection!;
}
const result = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('File storage failed.'));
});
function completed(tx: IDBTransaction, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { try { tx.abort(); } catch { /* Already complete. */ } };
    const clean = () => signal?.removeEventListener('abort', cancel);
    tx.oncomplete = () => { clean(); resolve(); };
    tx.onerror = tx.onabort = () => { clean(); reject(signal?.aborted ? signal.reason : new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. Delete uploaded files and retry.' : 'Could not save this file. Check browser storage and retry.')); };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}
export async function listMarkdownFiles(includeIncomplete = false): Promise<MarkdownFileInfo[]> {
  const db = await database();
  return (await result(db.transaction('documents').objectStore('documents').getAll()) as MarkdownFileInfo[]).filter(file => includeIncomplete || file.state === 'ready').sort((a,b) => b.lastOpenedAt - a.lastOpenedAt);
}
export async function getMarkdownFile(id: string): Promise<MarkdownFileInfo | undefined> {
  const db = await database();
  return result(db.transaction('documents').objectStore('documents').get(id));
}
async function writeInfo(info: MarkdownFileInfo, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const db = await database();
  signal?.throwIfAborted();
  const tx = db.transaction('documents', 'readwrite'), done = completed(tx, signal);
  let missing=false;const request=tx.objectStore('documents').get(info.id);
  request.onsuccess=()=>{if(request.result)tx.objectStore('documents').put(info);else missing=true;};
  await done;
  if(missing)throw new Error('This import was removed before it finished. Select the file again to retry.');
}
async function touchStoredFile(id: string, boardId?: string) {
  const db = await database(), tx = db.transaction('documents', 'readwrite'), done = completed(tx);
  const store = tx.objectStore('documents'), request = store.get(id);
  request.onsuccess = () => { const info = request.result as MarkdownFileInfo | undefined; if (info) store.put({ ...info, lastOpenedAt: Date.now(), ...(boardId ? { boardId } : {}) }); };
  await done;
}
const recentTouches=new Map<string,{time:number;boardId?:string;promise:Promise<void>}>();
export function touchMarkdownFile(id: string, boardId?: string): Promise<void> {
  const recent=recentTouches.get(id);
  if(recent&&Date.now()-recent.time<60000&&(!boardId||boardId===recent.boardId))return recent.promise;
  const promise=touchStoredFile(id,boardId).catch(error=>{recentTouches.delete(id);throw error;});
  recentTouches.set(id,{time:Date.now(),boardId,promise});
  if(recentTouches.size>100)recentTouches.delete(recentTouches.keys().next().value!);
  return promise;
}
export async function deleteMarkdownFile(id: string) {
  recentTouches.delete(id);
  const db = await database(), tx = db.transaction(['documents','files','edits'], 'readwrite'), done = completed(tx);
  tx.objectStore('documents').delete(id); tx.objectStore('files').delete(id);
  const cursor = tx.objectStore('edits').openCursor(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
  cursor.onsuccess = () => { const entry = cursor.result; if (entry) { entry.delete(); entry.continue(); } };
  await done;
}
export async function storeMarkdownFile(file: File, options: ImportOptions): Promise<MarkdownFileInfo> {
  const { signal, onProgress } = options;
  signal.throwIfAborted();
  const capacity = await navigator.storage?.estimate?.().catch(() => undefined);
  if (capacity?.quota && capacity.usage !== undefined && file.size > capacity.quota - capacity.usage) throw new Error('Not enough browser storage. Delete uploaded files or free space, then retry.');
  const info: MarkdownFileInfo = { id: crypto.randomUUID(), name: file.name, size: file.size, offsets: [0], createdAt: Date.now(), lastOpenedAt: Date.now(), state: 'importing', large: file.size >= LARGE_MARKDOWN_BYTES };
  let registered=false;
  try {
    onProgress({ phase: 'Saving file locally' });
    const db = await database(); signal.throwIfAborted();
    const tx = db.transaction(['documents','files'], 'readwrite'), done = completed(tx, signal);
    tx.objectStore('documents').put(info); registered=true; tx.objectStore('files').put(file.slice(), info.id);
    await done;
    let start = 0, pages = 0, previousPercent = -1;
    while (start < file.size) {
      signal.throwIfAborted();
      const bytes = new Uint8Array(await file.slice(start, Math.min(file.size, start + MARKDOWN_PAGE_BYTES + 4)).arrayBuffer());
      let length = Math.min(MARKDOWN_PAGE_BYTES, bytes.length);
      if (start + length < file.size) {
        const newline = bytes.lastIndexOf(10, length - 1);
        if (newline >= length / 2) length = newline + 1;
        else {
          let boundary=length,lookback=0;
          while(boundary>0&&lookback<3&&(bytes[boundary]&0xc0)===0x80){boundary--;lookback++;}
          // Invalid input can contain an arbitrary run of continuation bytes; always advance.
          if((bytes[boundary]&0xc0)!==0x80)length=boundary;
        }
      }
      start += length; info.offsets.push(start);
      const percent = Math.floor(start / file.size * 100);
      if (percent !== previousPercent) { onProgress({ phase: 'Preparing Markdown', percent }); previousPercent = percent; }
      // Give Cancel, paint and other work a turn without a background worker or a hot loop.
      if (++pages % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (info.offsets.length === 1) info.offsets.push(0);
    signal.throwIfAborted();
    info.state = 'ready';
    await writeInfo(info, signal);
    return info;
  } catch (error) {
    if(!registered)throw error;
    try { await deleteMarkdownFile(info.id); } catch { const failure=new Error('Import stopped, but temporary data could not be removed. Open Uploaded Markdown and delete the incomplete import.');failure.name='ImportCleanupError';throw failure; }
    throw error;
  }
}
export async function readMarkdownSection(id: string, page: number, signal?: AbortSignal): Promise<{text:string;revision:number}> {
  signal?.throwIfAborted();
  const db = await database(), tx = db.transaction(['documents','files','edits']);
  const [info, file, edit] = await Promise.all([
    result(tx.objectStore('documents').get(id)) as Promise<MarkdownFileInfo | undefined>,
    result(tx.objectStore('files').get(id)) as Promise<Blob | undefined>,
    result(tx.objectStore('edits').get([id,page])) as Promise<Blob | undefined>,
  ]);
  if (!info || !file || info.state !== 'ready') throw new Error('This uploaded file was deleted or expired. Import it again to reopen it.');
  if (!Number.isInteger(page) || page < 0 || page >= info.offsets.length - 1) throw new Error('This section is unavailable.');
  const text = new TextDecoder('utf-8',{ignoreBOM:true}).decode(await (edit || file.slice(info.offsets[page],info.offsets[page+1])).arrayBuffer());
  signal?.throwIfAborted();
  await touchMarkdownFile(id);
  return {text:page === 0 ? text.replace(/^\uFEFF/,'') : text,revision:info.revisions?.[page]||0};
}
export async function readMarkdownPage(id: string,page: number,signal?:AbortSignal):Promise<string>{return (await readMarkdownSection(id,page,signal)).text;}
export async function saveMarkdownPage(id: string, page: number, text: string, expectedRevision?:number): Promise<number> {
  if (new Blob([text]).size > MARKDOWN_PAGE_BYTES * 2) throw new Error('This section is full. Move additional content into a separate Markdown file.');
  const db = await database(), tx = db.transaction(['documents','edits'], 'readwrite'), done = completed(tx);
  const store = tx.objectStore('documents'), request = store.get(id);
  let missing = false, conflict=false, revision=0;
  request.onsuccess = () => {
    const info = request.result as MarkdownFileInfo | undefined;
    if (!info || info.state !== 'ready' || page < 0 || page >= info.offsets.length-1) { missing = true; return; }
    const current=info.revisions?.[page]||0;
    if(expectedRevision!==undefined&&expectedRevision!==current){conflict=true;return;}
    revision=current+1;
    tx.objectStore('edits').put(new Blob([text],{type:'text/markdown;charset=utf-8'}),[id,page]);
    store.put({...info,lastOpenedAt:Date.now(),revisions:{...info.revisions,[page]:revision}});
  };
  await done;
  if (missing) throw new Error('This uploaded file was deleted or expired. Download your current section before closing.');
  if(conflict)throw new Error('Another tab changed this section. Download your draft, then reload the file before making more changes.');
  return revision;
}
export async function markdownDownloadBlob(id: string): Promise<Blob> {
  const db = await database(), tx = db.transaction(['documents','files','edits']);
  const [info,file,keys,edits] = await Promise.all([
    result(tx.objectStore('documents').get(id)) as Promise<MarkdownFileInfo | undefined>,
    result(tx.objectStore('files').get(id)) as Promise<Blob | undefined>,
    result(tx.objectStore('edits').getAllKeys(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]))),
    result(tx.objectStore('edits').getAll(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]))) as Promise<Blob[]>,
  ]);
  if (!info || !file) throw new Error('This uploaded file was deleted or expired.');
  if (!edits.length) return file;
  const changed = new Map(keys.map((key,index) => [(key as [string,number])[1],edits[index]]));
  return new Blob(info.offsets.slice(0,-1).map((start,page) => changed.get(page) || file.slice(start,info.offsets[page+1])),{type:'text/markdown;charset=utf-8'});
}
export async function expiredMarkdownFiles(activeId?: string, now = Date.now(), retentionMs = MARKDOWN_RETENTION_MS): Promise<MarkdownFileInfo[]> {
  const db = await database();
  const all = await result(db.transaction('documents').objectStore('documents').getAll()) as MarkdownFileInfo[];
  return all.filter(file => file.id !== activeId && now - file.lastOpenedAt >= (file.state === 'importing' || !file.boardId ? 24*60*60*1000 : retentionMs));
}
export function downloadMarkdownBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

/** Release the connection when a storage owner is retired (also used by isolated tests). */
export async function closeMarkdownStorage() {
  const current=connection; connection=undefined;recentTouches.clear();
  if(current)(await current).close();
}
