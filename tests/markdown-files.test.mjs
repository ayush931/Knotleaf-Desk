import { beforeAll, afterAll, beforeEach, test, expect } from 'bun:test';
import { indexedDB as testDB, IDBKeyRange as TestRange } from 'fake-indexeddb';
import { storeMarkdownFile, readMarkdownPage, saveMarkdownPage, markdownDownloadBlob, listMarkdownFiles, getMarkdownFile, deleteMarkdownFile, touchMarkdownFile, closeMarkdownStorage, MARKDOWN_PAGE_BYTES } from '../lib/markdownFiles.ts';
import { importLocalFile, cleanupImportedMarkdown, removeImportedMarkdown } from '../lib/markdownImports.ts';
import { createBoard, getBoard, getAllBoards } from '../lib/storage.ts';
import { savePreferences } from '../lib/preferences.ts';
const saved=new Map();let records;
beforeAll(()=>{
  for(const [key,value] of Object.entries({indexedDB:testDB,IDBKeyRange:TestRange,window:{dispatchEvent(){},location:{origin:'http://localhost:3000'}},navigator:{storage:{estimate:async()=>({quota:1024**3,usage:0})}},localStorage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)}})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
});
beforeEach(async()=>{records=new Map();for(const file of await listMarkdownFiles())await deleteMarkdownFile(file.id);});
afterAll(async()=>{await closeMarkdownStorage();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
const options=(extra={})=>({signal:new AbortController().signal,onProgress(){},...extra});
test('UTF-8 sections are bounded, reconstruct the whole file, and section edits survive reopening',async()=>{
 const text='# Heading\n'+('Emoji 🙂 and 日本語 '.repeat(6000))+'\nEnd';
 const file=new File([text],'unicode.md',{type:'text/markdown'}), info=await storeMarkdownFile(file,options());
 let restored='';for(let page=0;page<info.offsets.length-1;page++){
  expect(info.offsets[page+1]-info.offsets[page]).toBeLessThanOrEqual(MARKDOWN_PAGE_BYTES);
  restored+=await readMarkdownPage(info.id,page);
 }
 expect(restored).toBe(text);expect(restored).not.toContain('\ufffd');
 const first=await readMarkdownPage(info.id,0);await saveMarkdownPage(info.id,0,'Edited\n'+first);
 expect(await readMarkdownPage(info.id,0)).toBe('Edited\n'+first);
 expect(await (await markdownDownloadBlob(info.id)).text()).toBe('Edited\n'+text);
});
test('Markdown above 50 MB opens without decoding the whole file or putting its text into localStorage',async()=>{
 const chunk='a'.repeat(1024*1024),file=new File(Array.from({length:51},()=>chunk),'large.md');
 let largestRead=0;const slice=file.slice.bind(file);
 file.text=async()=>{throw new Error('Whole-file decode is forbidden');};
 file.slice=(...args)=>{const blob=slice(...args),read=blob.arrayBuffer.bind(blob);blob.arrayBuffer=async()=>{largestRead=Math.max(largestRead,blob.size);return read();};return blob;};
 const updates=[];const board=await importLocalFile(file,options({onProgress:progress=>updates.push(progress)}),'personal');
 expect(board.largeMarkdown).toBe(true);expect(board.markdownNotes).toBe('');
 expect(largestRead).toBeLessThanOrEqual(MARKDOWN_PAGE_BYTES+4);
 expect([...records.values()].reduce((n,value)=>n+value.length,0)).toBeLessThan(10_000);
 expect(updates.filter(update=>update.percent!==undefined).length).toBeLessThanOrEqual(101);
 expect(updates.at(-2).percent).toBe(100);
 expect((await getMarkdownFile(board.importedMarkdownId)).size).toBe(51*1024*1024);
});
test('cancelling an import deletes partial file records, bytes and note cache',async()=>{
 const controller=new AbortController(),file=new File(['data\n'.repeat(200000)],'cancel.md');
 await expect(importLocalFile(file,options({signal:controller.signal,onProgress:progress=>{if((progress.percent||0)>=10)controller.abort(new DOMException('Cancelled','AbortError'));}}),'personal')).rejects.toThrow('Cancelled');
 expect(await listMarkdownFiles()).toEqual([]);expect(getAllBoards()).toEqual([]);
 const db=await new Promise((resolve,reject)=>{const request=testDB.open('knotleaf-markdown-files',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{for(const store of ['documents','files','edits'])expect(await new Promise(resolve=>{const request=db.transaction(store).objectStore(store).count();request.onsuccess=()=>resolve(request.result);})).toBe(0);}finally{db.close();}
});
test('storage capacity failure preserves the current project and leaves no upload',async()=>{
 const personal=createBoard('Keep me'),before=JSON.stringify(getAllBoards());const estimate=navigator.storage.estimate;
 navigator.storage.estimate=async()=>({quota:10,usage:9});
 try{await expect(importLocalFile(new File(['more than one byte'],'full.md'),options(),'personal')).rejects.toThrow('Not enough browser storage');}
 finally{navigator.storage.estimate=estimate;}
 expect(getBoard(personal.id).title).toBe('Keep me');expect(JSON.stringify(getAllBoards())).toBe(before);expect(await listMarkdownFiles()).toEqual([]);
});
test('manual deletion removes uploaded bytes, section edits, imported note cache and history but keeps other projects',async()=>{
 const keep=createBoard('Personal'),board=await importLocalFile(new File(['# Imported'],'delete.md'),options(),'personal');
 localStorage.setItem(`knotleaf_history_${board.id}`,'history bytes');
 await saveMarkdownPage(board.importedMarkdownId,0,'Edited content');
 await removeImportedMarkdown(board.importedMarkdownId);
 expect(getBoard(board.id)).toBeNull();expect(localStorage.getItem(`knotleaf_history_${board.id}`)).toBeNull();expect(getBoard(keep.id).title).toBe('Personal');
 expect(await getMarkdownFile(board.importedMarkdownId)).toBeUndefined();await expect(readMarkdownPage(board.importedMarkdownId,0)).rejects.toThrow('deleted or expired');
});
test('seven-day cleanup uses last access, skips the active file and respects Keep until I delete',async()=>{
 const board=await importLocalFile(new File(['# Retained'],'retention.md'),options(),'personal'),originalNow=Date.now,now=originalNow();
 try{
  Date.now=()=>now+8*86400000;
  expect(await cleanupImportedMarkdown(board.importedMarkdownId)).toBe(0);
  savePreferences({markdownRetentionDays:0});expect(await cleanupImportedMarkdown()).toBe(0);
  await touchMarkdownFile(board.importedMarkdownId);savePreferences({markdownRetentionDays:7});expect(await cleanupImportedMarkdown()).toBe(0);
  Date.now=()=>now+16*86400000;expect(await cleanupImportedMarkdown()).toBe(1);expect(getBoard(board.id)).toBeNull();
 }finally{Date.now=originalNow;}
});

test('an unsuccessful note-cache save rolls back the stored file and preserves the prior active board',async()=>{
 const keep=createBoard('Original'),setItem=localStorage.setItem;
 localStorage.setItem=(key,value)=>{if(key.startsWith('excali_eraser_board_import-'))throw new Error('Quota exceeded');return setItem(key,value);};
 try{await expect(importLocalFile(new File(['# Notes'],'quota.md'),options(),'personal')).rejects.toThrow('Could not save');}
 finally{localStorage.setItem=setItem;}
 expect(await listMarkdownFiles(true)).toEqual([]);expect(getBoard(keep.id).title).toBe('Original');
 expect(getAllBoards().map(board=>board.id)).toEqual([keep.id]);
});

test('stale section writes from another tab cannot overwrite newer saved text',async()=>{
 const info=await storeMarkdownFile(new File(['Original'],'conflict.md'),options());
 expect(await saveMarkdownPage(info.id,0,'First tab',0)).toBe(1);
 await expect(saveMarkdownPage(info.id,0,'Stale second tab',0)).rejects.toThrow('Another tab changed');
 expect(await readMarkdownPage(info.id,0)).toBe('First tab');
});

test('malformed UTF-8 continuation runs cannot stall indexing or retain an unbounded section',async()=>{
 const bytes=new Uint8Array(MARKDOWN_PAGE_BYTES*3);bytes.fill(0x80);
 const info=await storeMarkdownFile(new File([bytes],'malformed.md'),options());
 expect(info.offsets.at(-1)).toBe(bytes.length);expect(info.offsets.length).toBe(4);
 expect((await readMarkdownPage(info.id,0)).length).toBeLessThanOrEqual(MARKDOWN_PAGE_BYTES);
});

test('unavailable IndexedDB reports a storage error without claiming nonexistent partial data remains',async()=>{
 await closeMarkdownStorage();globalThis.indexedDB=undefined;
 try{await expect(storeMarkdownFile(new File(['# Notes'],'denied.md'),options())).rejects.toThrow('File storage is unavailable');}
 finally{globalThis.indexedDB=testDB;await closeMarkdownStorage();}
});
