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
