import {beforeAll,afterAll,beforeEach,afterEach,test,expect} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {indexedDB as testDB,IDBKeyRange as TestRange} from 'fake-indexeddb';
import {FileImportController} from '../components/FileImportController.tsx';
import {BoardHeader} from '../components/BoardHeader.tsx';
import {LargeMarkdownNotes} from '../components/LargeMarkdownNotes.tsx';
import {MarkdownFileLibrary} from '../components/MarkdownFileLibrary.tsx';
import {storeMarkdownFile,readMarkdownPage,listMarkdownFiles,deleteMarkdownFile,touchMarkdownFile,closeMarkdownStorage,MARKDOWN_PAGE_BYTES} from '../lib/markdownFiles.ts';
import {createBoard,getBoard} from '../lib/storage.ts';
const globals=new Map();let browser,root,createRoot;
beforeAll(async()=>{
 browser=new Window({url:'http://localhost:3000'});
 for(const[key,value]of Object.entries({window:browser,Event:browser.Event,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,localStorage:browser.localStorage,indexedDB:testDB,IDBKeyRange:TestRange,getComputedStyle:browser.getComputedStyle.bind(browser),requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),IS_REACT_ACT_ENVIRONMENT:true})){
  globals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 browser.HTMLDialogElement.prototype.showModal=function(){this.open=true;};browser.HTMLDialogElement.prototype.close=function(){this.open=false;};
 ({createRoot}=await import('react-dom/client'));
});
beforeEach(async()=>{localStorage.clear();for(const file of await listMarkdownFiles(true))await deleteMarkdownFile(file.id);document.body.innerHTML='<div id="root"></div>';root=createRoot(document.getElementById('root'));});
afterEach(async()=>{await act(async()=>root.unmount());await browser.happyDOM.abort();});
afterAll(async()=>{await closeMarkdownStorage();browser.close();for(const[key,old]of globals){if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];}});
const noop=()=>{};
const props={onBeforeRefresh:noop,saveError:false,onRetrySave:noop,viewMode:'canvas',onChangeViewMode:noop,title:'Test',onRenameTitle:noop,onToggleSidebar:noop,onOpenTemplates:noop,onOpenBoardTools:noop,onClearBoard:noop,gridType:'dot',onChangeGridType:noop,snapToGrid:false,onToggleSnap:noop,selectionCount:0,onExportSvg:noop,onExportDrawio:noop,onExportImage:noop,onExportJson:noop,onExportProject:noop,onExportPdf:async()=>{},onExportMarkdown:noop,onCopyClipboard:async()=>true,onTogglePresentation:noop,onShowShortcuts:noop};
function ImportHeader({onImportFile}){const ref=React.useRef(null);return React.createElement(React.Fragment,null,React.createElement(FileImportController,{ref,onImport:onImportFile}),React.createElement(BoardHeader,{...props,onImportFile:file=>ref.current.start(file)}));}
const options=()=>({signal:new AbortController().signal,onProgress(){}});
async function until(check){for(let count=0;count<100;count++){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,2));});if(check())return;}throw new Error('Timed out waiting for UI: '+document.body.textContent);}
test('import toast shows real percentages, Cancel aborts the operation, and duplicate selection is blocked',async()=>{
 let calls=0,aborted=false;
 await act(async()=>root.render(React.createElement(ImportHeader,{onImportFile:async(_file,{signal,onProgress})=>{calls++;onProgress({phase:'Preparing Markdown',percent:47});return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true}));}})));
 const input=document.querySelector('[aria-label="Import project or Markdown"]');Object.defineProperty(input,'files',{configurable:true,value:[new File(['# Test'],'notes.md')]});
 await act(async()=>input.dispatchEvent(new browser.Event('change',{bubbles:true})));
 expect(document.querySelector('progress').value).toBe(47);expect(document.body.textContent).toContain('Preparing Markdown · 47%');
 await act(async()=>input.dispatchEvent(new browser.Event('change',{bubbles:true})));expect(calls).toBe(1);
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Cancel import').click());
 expect(aborted).toBe(true);expect(document.body.textContent).toContain('Import cancelled. Partial file data removed.');expect(document.querySelector('progress')).toBeNull();
});
test('large reader loads one bounded section, saves before paging, and does not mount a rich-document editor',async()=>{
 const info=await storeMarkdownFile(new File(['a'.repeat(MARKDOWN_PAGE_BYTES)+'b'.repeat(MARKDOWN_PAGE_BYTES)],'paged.md'),options());
 await act(async()=>root.render(React.createElement(LargeMarkdownNotes,{fileId:info.id,onDownload:noop})));
 await until(()=>document.querySelector('textarea')?.value.length>0);
 const input=document.querySelector('[aria-label="Large Markdown section"]');expect(input.value).toHaveLength(MARKDOWN_PAGE_BYTES);expect(document.querySelector('.tiptap')).toBeNull();
 const setter=Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set;
 await act(async()=>{setter.call(input,'Edited section');input.dispatchEvent(new browser.Event('input',{bubbles:true}));});
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Next section').click());
 await until(()=>document.body.textContent.includes('Section 2 of 2')&&document.querySelector('textarea')?.value.startsWith('b'));
 expect(await readMarkdownPage(info.id,0)).toBe('Edited section');expect(document.querySelector('textarea').value).toHaveLength(MARKDOWN_PAGE_BYTES);
});
test('uploaded files view lists storage, offers retention choice, and confirms deletion of file bytes and notes',async()=>{
 const info=await storeMarkdownFile(new File(['# Managed'],'managed.md'),options()),board=createBoard('Imported');board.importedMarkdownId=info.id;board.markdownNotes='# Managed';
 const {saveBoard}=await import('../lib/storage.ts');saveBoard(board);await touchMarkdownFile(info.id,board.id);let deleted=0;
 await act(async()=>root.render(React.createElement(MarkdownFileLibrary,{open:true,onClose:noop,onOpen:noop,onDeleted:()=>deleted++,activeId:info.id})));
 await until(()=>document.body.textContent.includes('managed.md')&&!document.body.textContent.includes('Updating files…'));
 expect(document.querySelector('[aria-label="Uploaded Markdown retention"]').value).toBe('7');
 await act(async()=>document.querySelector('[aria-label="Delete managed.md"]').click());
 expect(getBoard(board.id)).not.toBeNull();
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Delete from device').click());
 await until(()=>deleted===1);expect(getBoard(board.id)).toBeNull();expect(await listMarkdownFiles()).toEqual([]);
});

test('existing oversized notes use one plain source section instead of a rich tree or syntax mirror',async()=>{
 const {DocEditor}=await import('../components/DocEditor.tsx');let published;
 await act(async()=>root.render(React.createElement(DocEditor,{value:'# Large notes\n'.repeat(20000),onChange:value=>{published=value;},onExportMarkdown:noop,theme:'dark'})));
 const input=document.querySelector('[aria-label="Large notes source section"]');expect(input.value.length).toBeLessThanOrEqual(64*1024);expect(document.querySelector('.tiptap')).toBeNull();expect(document.querySelector('.hljs')).toBeNull();
 const setter=Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set;
 await act(async()=>{setter.call(input,'Edited');input.dispatchEvent(new browser.Event('input',{bubbles:true}));});
 expect(published).toBeUndefined();expect([...document.querySelectorAll('button')].find(button=>button.textContent==='Next section').disabled).toBe(true);
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Save section').click());expect(published).toStartWith('Edited');
});
