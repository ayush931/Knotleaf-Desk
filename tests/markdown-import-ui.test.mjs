import {beforeAll,afterAll,beforeEach,afterEach,test,expect} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {indexedDB as testDB,IDBKeyRange as TestRange} from 'fake-indexeddb';
import {MarkdownWorkspace} from '../components/MarkdownWorkspace.tsx';
import {FileImportController} from '../components/FileImportController.tsx';
import {BoardHeader} from '../components/BoardHeader.tsx';
import {LargeMarkdownNotes} from '../components/LargeMarkdownNotes.tsx';
import {MarkdownFileLibrary} from '../components/MarkdownFileLibrary.tsx';
import {storeMarkdownFile,readMarkdownPage,listMarkdownFiles,deleteMarkdownFile,touchMarkdownFile,closeMarkdownStorage,MARKDOWN_PAGE_BYTES} from '../lib/markdownFiles.ts';
import {createBoard,getBoard} from '../lib/storage.ts';
const globals=new Map();let browser,root,createRoot;
beforeAll(async()=>{
 browser=new Window({url:'http://localhost:3000'});
 for(const[key,value]of Object.entries({window:browser,Event:browser.Event,NodeFilter:browser.NodeFilter,FormData:browser.FormData,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,localStorage:browser.localStorage,indexedDB:testDB,IDBKeyRange:TestRange,getComputedStyle:browser.getComputedStyle.bind(browser),requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),IS_REACT_ACT_ENVIRONMENT:true})){
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
async function until(check){for(let count=0;count<200;count++){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});if(check())return;}throw new Error('Timed out waiting for UI: '+document.body.textContent);}
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

function WorkspaceHarness({initial='# Roadmap\n\nHello team.\n\n## Next\n\n- [ ] Ship\n',view='split'}){
 const [value,setValue]=React.useState(initial);
 return React.createElement(MarkdownWorkspace,{value,onChange:setValue,title:'roadmap.md',initialView:view});
}
const named=label=>document.querySelector(`[aria-label="${label}"]`);
async function inputValue(element,value){const type=element.tagName==='TEXTAREA'?browser.HTMLTextAreaElement:browser.HTMLInputElement;const setter=Object.getOwnPropertyDescriptor(type.prototype,'value').set;await act(async()=>{setter.call(element,value);element.dispatchEvent(new browser.Event('input',{bubbles:true}));});}

test('split preview updates after typing, keeps source intact, and switches reading themes without changing the app',async()=>{
 await act(async()=>root.render(React.createElement(WorkspaceHarness)));
 await until(()=>named('Rendered Markdown')?.querySelector('h1')?.textContent==='Roadmap');
 expect(named('Markdown source')).not.toBeNull();expect(named('Markdown split view').getAttribute('aria-pressed')).toBe('true');
 await inputValue(named('Markdown source'),'# Changed\n\nLive **preview**.');
 await until(()=>named('Rendered Markdown')?.querySelector('h1')?.textContent==='Changed');
 expect(named('Rendered Markdown').querySelector('strong').textContent).toBe('preview');
 const select=named('Markdown page theme');await act(async()=>{select.value='paper';select.dispatchEvent(new browser.Event('change',{bubbles:true}));});
 expect(document.querySelector('.markdown-reader').dataset.theme).toBe('paper');expect(named('Markdown source').value).toBe('# Changed\n\nLive **preview**.');
 expect(JSON.parse(localStorage.getItem('knotleaf.preferences.v1')).markdownWorkspace.theme).toBe('paper');
});
test('find/replace works literally, highlights the preview, and offers one-step replacement undo',async()=>{
 await act(async()=>root.render(React.createElement(WorkspaceHarness,{initial:'# Search\n\nHello team, hello team.'})));
 await until(()=>named('Rendered Markdown')?.textContent.includes('Hello team'));
 await act(async()=>named('Find in Markdown').click());await inputValue(named('Find Markdown text'),'team');
 await until(()=>document.querySelectorAll('mark[data-markdown-search]').length===2);
 await inputValue(named('Markdown replacement'),'friends');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Replace all').click());
 expect(named('Markdown source').value).toBe('# Search\n\nHello friends, hello friends.');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Undo replace').click());
 expect(named('Markdown source').value).toContain('Hello team, hello team.');
 await act(async()=>named('Clear Markdown search').click());expect(named('Find Markdown text').value).toBe('');
});
test('reader outline, safe code copy, tables and image opt-in operate on sanitized content',async()=>{
 const original=Object.getOwnPropertyDescriptor(browser.navigator,'clipboard');let copied;
 Object.defineProperty(browser.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
 try{
  const markdown='# Guide\n\n## Code\n\n```javascript\nconst x = "<safe>";\n```\n\n| Item | Value |\n| --- | --- |\n| one | two |\n\n![Diagram](https://example.test/diagram.png)\n\n<script>bad()</script>';
  await act(async()=>root.render(React.createElement(WorkspaceHarness,{initial:markdown,view:'preview'})));
  await until(()=>document.querySelector('[aria-label="Copy code block"]'));
  expect(named('Markdown source')).toBeNull();expect(named('Rendered Markdown').querySelector('script')).toBeNull();
  await act(async()=>named('Markdown outline').click());expect(named('Markdown headings').textContent).toContain('Guide');expect(named('Markdown headings').textContent).toContain('Code');
  expect(named('Markdown table')).not.toBeNull();
  const code=named('Rendered Markdown').querySelector('pre code').textContent;
  await act(async()=>named('Copy code block').click());expect(copied).toBe(code);
  const image=named('Rendered Markdown').querySelector('img');expect(image.getAttribute('src')).toBeNull();
  await act(async()=>named('Load image: Diagram').click());expect(image.getAttribute('src')).toBe('https://example.test/diagram.png');
 }finally{if(original)Object.defineProperty(browser.navigator,'clipboard',original);else delete browser.navigator.clipboard;}
});
test('file library Preview carries preview intent and large-file mode changes preserve unsaved source',async()=>{
 const info=await storeMarkdownFile(new File(['# First\n\n'+'a'.repeat(MARKDOWN_PAGE_BYTES)+'\n# Next\n'],'preview.md'),options());let requested;
 await act(async()=>root.render(React.createElement(MarkdownFileLibrary,{open:true,onClose:noop,onOpen:(_file,view)=>{requested=view;},onDeleted:noop})));
 await until(()=>named('Preview preview.md')&&!document.body.textContent.includes('Updating files…'));
 await act(async()=>named('Preview preview.md').click());await until(()=>requested==='preview');
 await act(async()=>root.render(React.createElement(LargeMarkdownNotes,{fileId:info.id,onDownload:noop,initialView:'source',viewToken:1})));
 await until(()=>named('Large Markdown section')?.value.startsWith('# First'));
 await inputValue(named('Large Markdown section'),'# Unsaved\n\nDraft text.');
 await act(async()=>root.render(React.createElement(LargeMarkdownNotes,{fileId:info.id,onDownload:noop,initialView:'preview',viewToken:2})));
 await until(()=>named('Rendered Markdown')?.querySelector('h1')?.textContent==='Unsaved');
 await act(async()=>named('Markdown split view').click());expect(named('Large Markdown section').value).toContain('Draft text.');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Next section').click());
 await until(()=>document.body.textContent.includes('Section 2 of')&&named('Large Markdown section')?.value.length>0);
 expect(named('Markdown split view').getAttribute('aria-pressed')).toBe('true');expect(await readMarkdownPage(info.id,0)).toContain('Draft text.');
});

test('line gutters stay virtualized and replacement undo cannot leak into another section',async()=>{
 await act(async()=>root.render(React.createElement(WorkspaceHarness,{initial:'a\n'.repeat(30000),view:'source'})));
 expect(document.querySelector('[data-markdown-line-numbers]').children.length).toBeLessThanOrEqual(200);
 expect(document.querySelectorAll('.markdown-source-pane pre')).toHaveLength(0);
 function Sections(){const [section,setSection]=React.useState('one'),[value,setValue]=React.useState('team');return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setSection('two')},'Other section'),React.createElement(MarkdownWorkspace,{documentKey:section,value,onChange:setValue}));}
 await act(async()=>root.render(React.createElement(Sections)));
 await act(async()=>named('Find in Markdown').click());await inputValue(named('Find Markdown text'),'team');await inputValue(named('Markdown replacement'),'people');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Replace all').click());
 expect([...document.querySelectorAll('button')].some(button=>button.textContent==='Undo replace')).toBe(true);
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Other section').click());
 expect([...document.querySelectorAll('button')].some(button=>button.textContent==='Undo replace')).toBe(false);
});


test('deferred image serialization never assigns a network src before opt-in',async()=>{
 const {notesToSafeHtml}=await import('../lib/richNotes.ts');
 const original=browser.Element.prototype.setAttribute;const assigned=[];
 browser.Element.prototype.setAttribute=function(name,value){if(this.tagName==='IMG'&&name==='src')assigned.push(value);return original.call(this,name,value);};
 try{
  const html=notesToSafeHtml('![Remote](https://example.test/photo.png)',{deferImages:true});
  expect(assigned).toEqual([]);expect(html).toContain('data-markdown-image-src="https://example.test/photo.png"');
 }finally{browser.Element.prototype.setAttribute=original;}
});
test('ordinary notes open the reader and return to rich writing without changing Markdown',async()=>{
 const {DocEditor}=await import('../components/DocEditor.tsx');let changed=false;
 await act(async()=>root.render(React.createElement(DocEditor,{value:'# Original\n\nKeep **formatting**.',onChange:()=>{changed=true;},onExportMarkdown:noop,saveStatus:'Not saved · retry from the header',theme:'dark'})));
 await act(async()=>named('Open Markdown preview').click());
 await until(()=>named('Rendered Markdown')?.querySelector('h1'));
 expect(document.body.textContent).toContain('Not saved · retry from the header');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Back to writing').click());
 expect(named('Open Markdown preview')).not.toBeNull();expect(changed).toBe(false);
});

test('preview failure offers source recovery without discarding the document',async()=>{
 const {MarkdownPreviewBoundary}=await import('../components/MarkdownPreviewBoundary.tsx');let recovered=false;
 function BrokenPreview(){throw new Error('Preview unavailable');}
 const original=console.error;console.error=()=>{};
 try{
  await act(async()=>root.render(React.createElement(MarkdownPreviewBoundary,{resetKey:'source',onSource:()=>{recovered=true;}},React.createElement(BrokenPreview))));
  expect(document.querySelector('[role="alert"]').textContent).toContain('Your Markdown source is safe');
  await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Open Markdown source').click());expect(recovered).toBe(true);
 }finally{console.error=original;}
});

test('compact options preserve formatting selection and dismiss with Escape or outside press',async()=>{
 await act(async()=>root.render(React.createElement(WorkspaceHarness,{initial:'hello',view:'source'})));
 const options=named('Markdown options').closest('details');
 expect(options.open).toBe(false);expect(document.querySelector('.markdown-source-pane [role="toolbar"]')).toBeNull();expect(document.querySelector('.markdown-reader-label')).toBeNull();
 const source=named('Markdown source');source.setSelectionRange(0,5);
 await act(async()=>{options.open=true;named('Markdown bold').click();});
 expect(source.value).toBe('**hello**');expect(options.open).toBe(false);
 await act(async()=>{options.open=true;named('Markdown reading size').focus();named('Markdown reading size').dispatchEvent(new browser.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
 expect(options.open).toBe(false);expect(document.activeElement).toBe(named('Markdown options'));
 await act(async()=>{options.open=true;source.dispatchEvent(new browser.PointerEvent('pointerdown',{bubbles:true}));});expect(options.open).toBe(false);
 await act(async()=>named('Markdown outline').click());expect(document.querySelector('.markdown-outline').classList.contains('absolute')).toBe(true);
 await act(async()=>named('Close Markdown outline').click());expect(document.querySelector('.markdown-outline')).toBeNull();expect(document.activeElement).toBe(named('Markdown outline'));
});
test('section options keep jump navigation and help behind the compact row',async()=>{
 const {MarkdownSectionNavigation}=await import('../components/MarkdownSectionNavigation.tsx');let page;
 await act(async()=>root.render(React.createElement(MarkdownSectionNavigation,{page:0,pages:30,onNavigate:next=>{page=next;},help:'Preview is section-based.'})));
 const menu=named('Markdown section navigation options').closest('details');expect(menu.open).toBe(false);expect(named('Previous section').disabled).toBe(true);expect(named('Next section').disabled).toBe(false);
 await act(async()=>{menu.open=true;});await inputValue(named('Go to Markdown section'),'20');
 await act(async()=>named('Go to Markdown section').closest('form').dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true})));
 expect(page).toBe(19);expect(menu.open).toBe(false);expect(document.activeElement).toBe(named('Markdown section navigation options'));
 await act(async()=>root.render(React.createElement(MarkdownSectionNavigation,{page:1,pages:30,disabled:true,onNavigate:next=>{page=next;},help:'Save first.'})));
 expect(named('Previous section').disabled).toBe(true);expect(named('Next section').disabled).toBe(true);
 await act(async()=>named('Go to Markdown section').closest('form').dispatchEvent(new browser.Event('submit',{bubbles:true,cancelable:true})));expect(page).toBe(19);
});
