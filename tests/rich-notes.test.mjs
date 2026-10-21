import { test, expect, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import { Editor } from '@tiptap/core';
import { richNotesExtensions, richNoteMatches, safeNoteLink, insertStickyNote } from '../lib/richNotes.ts';
let browser;const previous=new Map();
beforeAll(()=>{
 browser=new Window({url:'https://desk.example/'});
 for(const [key,value]of Object.entries({window:browser,document:browser.document,navigator:browser.navigator,HTMLElement:browser.HTMLElement,Node:browser.Node,DOMParser:browser.DOMParser,MutationObserver:browser.MutationObserver,getComputedStyle:browser.getComputedStyle.bind(browser),requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser)})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
});
afterAll(()=>{browser.close();for(const[key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
const create=value=>new Editor({element:document.createElement('div'),extensions:richNotesExtensions(),content:value,contentType:'markdown'});
test('normal Notes hides syntax while retaining headings, lists, tasks, tables, links, images and code in portable storage',()=>{
 const markdown='# Meeting\n\n**Bold** and *italic* and ~~done~~.\n\n- First\n- Second\n\n1. One\n2. Two\n\n- [x] Finished\n- [ ] Next\n\n> **Sticky note**\n>\n> Remember this.\n\n| Name | Status |\n| --- | --- |\n| Item | Ready |\n\n[Reference](https://example.com)\n\n![Image](https://example.com/image.png)\n\n```js\nconst x = 1;\n```';
 const editor=create(markdown);try{
  const html=editor.getHTML();for(const tag of ['<h1>','<strong>','<em>','<s>','data-type="taskList"','<table','<blockquote','<a ','<img ','<pre>'])expect(html).toContain(tag);
  const serialized=editor.getMarkdown();const restored=create(serialized);try{expect(restored.getJSON()).toEqual(editor.getJSON());}finally{restored.destroy();}
 }finally{editor.destroy();}
});
test('visual search spans formatting marks and replace-all is undoable without stripping surrounding formatting',()=>{
 const editor=create('cat **cat** and *keep*');try{
  const matches=richNoteMatches(editor.state.doc,'cat');expect(matches).toHaveLength(2);
  const tr=editor.state.tr;for(const match of [...matches].reverse())tr.insertText('dog',match.from,match.to);editor.view.dispatch(tr);
  expect(editor.getMarkdown()).toBe('dog **dog** and *keep*');editor.commands.undo();expect(editor.getMarkdown()).toBe('cat **cat** and *keep*');
  expect(richNoteMatches(editor.state.doc,'CAT',true)).toHaveLength(0);expect(richNoteMatches(editor.state.doc,'CAT')).toHaveLength(2);
 }finally{editor.destroy();}
});
test('new visual notes start empty without publishing a normalization write, and link input accepts only safe protocols',()=>{
 const editor=create('');try{expect(editor.isEmpty).toBe(true);editor.commands.insertContent('Write normally');expect(editor.getMarkdown()).toBe('Write normally');}finally{editor.destroy();}
 expect(safeNoteLink('example.com')).toBe('https://example.com/');expect(safeNoteLink('mailto:teacher@example.com')).toBe('mailto:teacher@example.com');for(const value of ['javascript:alert(1)','data:text/html,hi','file:///etc/passwd'])expect(safeNoteLink(value)).toBeNull();
});

test('inserting a sticky note keeps selected writing and places the caret inside its empty body',()=>{
 const editor=create('Keep this writing.');try{
  editor.commands.setTextSelection({from:6,to:10});insertStickyNote(editor);
  expect(editor.state.doc.firstChild.textContent).toBe('Keep this writing.');
  expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');expect(editor.state.selection.$from.node(-1).type.name).toBe('blockquote');
  editor.commands.insertContent('Remember the demo');expect(editor.getMarkdown()).toContain('> Remember the demo');expect(editor.getMarkdown()).toContain('Keep this writing.');
 }finally{editor.destroy();}
});
