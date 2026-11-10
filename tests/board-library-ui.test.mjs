import {beforeAll,afterAll,beforeEach,afterEach,test,expect} from 'bun:test';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {BoardsSidebar} from '../components/BoardsSidebar.tsx';
import {loadPreferences,savePreferences} from '../lib/preferences.ts';
let browser,root,createRoot;const globals=new Map(),noop=()=>{};
const boards=[{id:'a',title:'Résumé plan',workspaceId:'personal',createdAt:1,updatedAt:9,elementCount:2},{id:'b',title:'Budget',workspaceId:'work',createdAt:5,updatedAt:1,elementCount:3}];
const props={isOpen:true,onClose:noop,boards,activeBoardId:'a',onSelectBoard:noop,onCreateBoard:noop,onDuplicateBoard:noop,onDeleteBoard:noop,onImportFile:async()=>{},theme:'light',workspaces:[{id:'personal',name:'Personal'},{id:'work',name:'Work'}],workspaceId:'personal',onChangeWorkspace:noop,onCreateWorkspace:noop,onMoveBoard:noop};
beforeAll(async()=>{
 browser=new Window({url:'http://localhost:3000'});
 for(const [key,value]of Object.entries({window:browser,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,Node:browser.Node,localStorage:browser.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){globals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 browser.HTMLDialogElement.prototype.showModal=function(){this.open=true;};browser.HTMLDialogElement.prototype.close=function(){this.open=false;};
 ({createRoot}=await import('react-dom/client'));
});
beforeEach(()=>{localStorage.clear();document.body.innerHTML='<div id="root"></div>';root=createRoot(document.getElementById('root'));});
afterEach(async()=>{await act(async()=>root.unmount());await browser.happyDOM.abort();});
afterAll(()=>{browser.close();for(const [key,value]of globals)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
const named=name=>document.querySelector(`[aria-label="${name}"]`);
const change=async(name,value)=>act(async()=>{const element=named(name);if(element.tagName==='INPUT')Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype,'value').set.call(element,value);else element.value=value;element.dispatchEvent(new browser.Event(element.tagName==='INPUT'?'input':'change',{bubbles:true}));});
test('workspace search focuses on open, finds boards across workspaces, clears, pins and persists sorting',async()=>{
 await act(async()=>root.render(React.createElement(BoardsSidebar,props)));
 expect(document.activeElement).toBe(named('Search boards'));expect(named('Pin Budget')).toBeNull();
 await change('Board search scope','all');expect(named('Pin Budget')).not.toBeNull();
 await change('Search boards','budget');expect(named('Pin Résumé plan')).toBeNull();expect(named('Pin Budget')).not.toBeNull();
 await act(async()=>named('Clear board search').click());expect(document.activeElement).toBe(named('Search boards'));
 await act(async()=>named('Pin Budget').click());expect(named('Unpin Budget').getAttribute('aria-pressed')).toBe('true');
 expect([...document.querySelectorAll('[aria-pressed]')][0].getAttribute('aria-label')).toBe('Unpin Budget');
 await change('Sort boards','title');savePreferences({notesWidth:480});
 expect(loadPreferences().boardLibrary).toEqual({scope:'all',sort:'title',pinnedIds:['b']});
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(BoardsSidebar,props)));
 expect(named('Board search scope').value).toBe('all');expect(named('Sort boards').value).toBe('title');expect(named('Unpin Budget')).not.toBeNull();
});
test('all-workspace board moves use the board workspace and storage failures retain usable controls',async()=>{
 const moves=[];await act(async()=>root.render(React.createElement(BoardsSidebar,{...props,onMoveBoard:(...args)=>moves.push(args)})));
 await change('Board search scope','all');expect(named('Workspace for Budget').value).toBe('work');
 await change('Workspace for Budget','personal');expect(moves).toEqual([['b','personal']]);
 const original=globalThis.localStorage;Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:key=>original.getItem(key),setItem(){throw Error('Quota');}}});
 try{await act(async()=>named('Pin Budget').click());expect(named('Unpin Budget')).not.toBeNull();expect(document.body.textContent).toContain('Could not save library preferences');}finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:original});}
});

test('large libraries load in batches but search always covers the full index',async()=>{
 const many=Array.from({length:60},(_,i)=>({...boards[0],id:`board-${i}`,title:i?`Board ${i}`:'Rare target',updatedAt:i}));
 await act(async()=>root.render(React.createElement(BoardsSidebar,{...props,boards:many})));
 expect(!!named('Pin Rare target')).toBe(false);
 const more=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Load more boards'));
 await act(async()=>more.click());expect(named('Pin Rare target')).not.toBeNull();
 await change('Search boards','Rare target');expect(named('Pin Rare target')).not.toBeNull();
 expect([...document.querySelectorAll('button')].some(button=>button.textContent.includes('Load more boards'))).toBe(false);
 await act(async()=>named('Clear board search').click());expect(!!named('Pin Rare target')).toBe(false);
});
