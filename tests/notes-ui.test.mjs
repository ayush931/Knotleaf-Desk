import {test,expect,beforeAll,beforeEach,afterEach,afterAll} from 'bun:test';
import React,{act,useState} from 'react';
import {Window} from 'happy-dom';
import {DocEditor} from '../components/DocEditor.tsx';
let browser,root,createRoot;const previous=new Map();
beforeAll(async()=>{
 browser=new Window({url:'https://desk.example/'});
 const values={window:browser,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,Node:browser.Node,Event:browser.Event,MouseEvent:browser.MouseEvent,KeyboardEvent:browser.KeyboardEvent,ResizeObserver:browser.ResizeObserver,requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser),IS_REACT_ACT_ENVIRONMENT:true};
 for(const [key,value]of Object.entries(values)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 ({createRoot}=await import('react-dom/client'));
});
beforeEach(()=>{document.body.innerHTML='<div id="root"></div>';root=createRoot(document.getElementById('root'));});
afterEach(async()=>{await act(async()=>root.unmount());await browser.happyDOM.abort();});
afterAll(()=>{browser.close();for(const [key,value]of previous)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];});
function Harness({initial=''}){const [value,onChange]=useState(initial);return React.createElement(DocEditor,{value,onChange,theme:'dark',onExportMarkdown:()=>{}});}
async function render(initial){await act(async()=>root.render(React.createElement(Harness,{initial})));}
const input=()=>document.querySelector('textarea');
const button=label=>[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===label||el.textContent===label);
test('note toolbar formats a selected line and keeps the caret in the editor',async()=>{
 await render('hello world');input().focus();input().setSelectionRange(6,11);
 await act(async()=>button('Heading').click());expect(input().value).toBe('# hello world');expect(document.activeElement).toBe(input());
 expect(document.querySelector('.notes-source').className).not.toContain('min-h-60');
});
test('bold shortcut keeps an empty insertion point ready for typing and ignores IME',async()=>{
 await render('');input().focus();
 await act(async()=>input().dispatchEvent(new window.KeyboardEvent('keydown',{key:'b',ctrlKey:true,bubbles:true,cancelable:true})));
 expect(input().value).toBe('****');expect(input().selectionStart).toBe(2);expect(input().selectionEnd).toBe(2);
 await act(async()=>input().dispatchEvent(new window.KeyboardEvent('keydown',{key:'b',ctrlKey:true,isComposing:true,bubbles:true,cancelable:true})));expect(input().value).toBe('****');
});
test('preview restores editing selection and outline navigation skips code headings',async()=>{
 await render('# Intro\n```python\n# code comment\n```\n## Next');input().focus();input().setSelectionRange(2,7);input().scrollTop=60;
 await act(async()=>button('Preview').click());expect(input()).toBe(null);expect(document.querySelector('article h1').textContent).toBe('Intro');
 await act(async()=>button('Edit').click());expect(input().selectionStart).toBe(2);expect(input().selectionEnd).toBe(7);expect(input().scrollTop).toBe(60);
 await act(async()=>button('Show note outline').click());expect(document.querySelector('nav').textContent).not.toContain('code comment');
 await act(async()=>button('Preview').click());await act(async()=>button('Next').click());expect(input().value.slice(input().selectionStart,input().selectionEnd)).toBe('## Next');
});

async function field(label,value){const el=document.querySelector(`[aria-label="${label}"]`),setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;await act(async()=>{setter.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));});return el;}
test('notes find shortcut is scoped, navigation wraps, and replacing matches supports undo',async()=>{
 await render('cat CAT cat');input().focus();input().setSelectionRange(0,0);let globalFind=0;const globalKey=event=>{if(event.ctrlKey&&event.key==='f')globalFind++;};window.addEventListener('keydown',globalKey);
 try{
  await act(async()=>input().dispatchEvent(new window.KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true,cancelable:true})));
  expect(globalFind).toBe(0);expect(document.querySelector('[role="search"]')).toBeTruthy();
  const find=await field('Find in notes','cat');expect(document.activeElement).toBe(find);
  for(const start of [0,4,8,0]){await act(async()=>find.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));expect(input().selectionStart).toBe(start);expect(document.querySelector('mark').textContent.toLowerCase()).toBe('cat');}
  await field('Replace in notes','dog');await act(async()=>button('Replace all').click());expect(input().value).toBe('dog dog dog');expect(document.body.textContent).toContain('Replaced 3 matches.');
  await act(async()=>button('Undo replace').click());expect(input().value).toBe('cat CAT cat');
  await act(async()=>document.querySelector('[type="checkbox"]').click());await act(async()=>button('Replace all').click());expect(input().value).toBe('dog CAT dog');
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;setter.call(input(),'Newer notes');input().dispatchEvent(new window.Event('input',{bubbles:true}));});expect(button('Undo replace').disabled).toBe(true);await act(async()=>button('Undo replace').click());expect(input().value).toBe('Newer notes');
  await act(async()=>document.querySelector('[aria-label="Replace in notes"]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(document.querySelector('[role="search"]')).toBeNull();expect(document.activeElement).toBe(input());
 }finally{window.removeEventListener('keydown',globalKey);}
});
test('empty queries and no matches cannot replace or insert text',async()=>{
 await render('Keep my notes');await act(async()=>button('Find and replace in notes').click());expect(button('Replace all').disabled).toBe(true);
 await field('Find in notes','missing');expect(button('Replace').disabled).toBe(true);expect(document.body.textContent).toContain('No matches');expect(input().value).toBe('Keep my notes');
});
test('copy Markdown reports success or failure without changing notes, and empty notes have no reading time',async()=>{
 await render('');expect(document.body.textContent).toContain('0 words · 0 min read');
 const clipboard=navigator.clipboard,original=clipboard.writeText;let copied;
 try{clipboard.writeText=async value=>{copied=value;};await act(async()=>button('Copy notes as Markdown').click());expect(copied).toBe('');expect(document.body.textContent).toContain('Markdown copied.');
 clipboard.writeText=async()=>{throw new Error('Blocked');};await act(async()=>button('Copy notes as Markdown').click());expect(document.body.textContent).toContain('Could not copy');expect(input().value).toBe('');
 }finally{clipboard.writeText=original;}
});
