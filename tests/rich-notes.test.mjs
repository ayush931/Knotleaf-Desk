import { test, expect, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import { Editor } from '@tiptap/core';
import { richNotesExtensions, richNoteMatches, safeNoteLink, insertStickyNote, serializeRichNotes, notesToSafeHtml } from '../lib/richNotes.ts';
let browser;const previous=new Map();
beforeAll(()=>{
 browser=new Window({url:'https://desk.example/'});
 for(const [key,value]of Object.entries({window:browser,document:browser.document,navigator:browser.navigator,Event:browser.Event,CustomEvent:browser.CustomEvent,HTMLElement:browser.HTMLElement,Node:browser.Node,DOMParser:browser.DOMParser,MutationObserver:browser.MutationObserver,getComputedStyle:browser.getComputedStyle.bind(browser),requestAnimationFrame:browser.requestAnimationFrame.bind(browser),cancelAnimationFrame:browser.cancelAnimationFrame.bind(browser)})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
});
afterAll(async()=>{await new Promise(resolve=>setTimeout(resolve,20));browser.close();for(const[key,descriptor]of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
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

test('fonts, sizes, colors, highlights, underline and alignment survive save/reload as safe HTML',()=>{
 const editor=create('Styled writing');try{
  editor.commands.setTextSelection({from:1,to:15});editor.chain().setFontFamily('serif').setFontSize('24px').setColor('#7dd3fc').setHighlight({color:'#4b3d64'}).toggleUnderline().setTextAlign('center').run();
  const markdown=editor.getMarkdown();const restored=create(markdown);try{expect(restored.getJSON()).toEqual(editor.getJSON());expect(restored.getHTML()).toContain('24px');expect(restored.getHTML()).toContain('text-align: center');}finally{restored.destroy();}
 }finally{editor.destroy();}
});
test('colored inline marks round-trip with bold, italic, links and surrounding normal text',()=>{
 const editor=create('First middle last');try{
  editor.commands.setTextSelection({from:7,to:13});editor.chain().setFontFamily('mono').setFontSize('20px').setColor('#fca5a5').setHighlight({color:'#665329'}).toggleBold().toggleItalic().run();
  const restored=create(serializeRichNotes(editor));try{expect(restored.getJSON()).toEqual(editor.getJSON());}finally{restored.destroy();}
 }finally{editor.destroy();}
});
test('collapsible sections preserve editable titles, nested content and collapsed state',()=>{
 const editor=create('');try{
  editor.commands.insertContent({type:'details',attrs:{open:true},content:[{type:'detailsSummary',content:[{type:'text',text:'More context'}]},{type:'detailsContent',content:[{type:'paragraph',content:[{type:'text',text:'Keep every detail.'}]}]}]});
  const restored=create(editor.getMarkdown());try{expect(restored.getJSON()).toEqual(editor.getJSON());}finally{restored.destroy();}
 }finally{editor.destroy();}
});

test('advanced formatting survives inside lists, sticky notes and table cells without exposed Markdown markers',()=>{
 for(const markdown of ['- **Important** item','> A *sticky* note','| Heading |\n| --- |\n| **Cell** |']){
  const editor=create(markdown);try{editor.commands.selectAll();editor.chain().setFontFamily('rounded').setColor('#86efac').setHighlight({color:'#324f42'}).run();
   const serialized=serializeRichNotes(editor),restored=create(serialized);try{expect(restored.getJSON()).toEqual(editor.getJSON());expect(notesToSafeHtml(serialized)).not.toContain('**');}finally{restored.destroy();}
  }finally{editor.destroy();}
 }
});
test('safe document rendering drops scripts, event handlers and arbitrary style properties',()=>{
 const html=notesToSafeHtml('<p onclick="alert(1)" style="position:fixed;text-align:center">Hello <span style="color:#7dd3fc;position:fixed;background-image:url(https://bad.example)">safe</span><script>alert(1)</script></p>');
 expect(html).toContain('Hello');expect(html).toContain('text-align: center');expect(html).not.toContain('onclick');expect(html).not.toContain('<script');expect(html).not.toContain('position:');expect(html).not.toContain('background-image');
});

test('templates append without replacing selected writing, block duplication and moves are undoable',async()=>{
 const {insertNoteTemplate,duplicateNoteBlock,moveNoteBlock}=await import('../lib/richNotes.ts');
 const editor=create('First block\n\nSecond block');try{
  editor.commands.setTextSelection({from:2,to:6});insertNoteTemplate(editor,'## Meeting notes\n\n- [ ] Follow up');expect(editor.state.doc.firstChild.textContent).toBe('First block');
  expect(editor.getText()).toContain('Second block');expect(editor.getText()).toContain('Meeting notes');
  editor.commands.setTextSelection(2);expect(duplicateNoteBlock(editor)).toBe(true);expect(editor.getText().match(/First block/g)).toHaveLength(2);
  editor.commands.undo();expect(editor.getText().match(/First block/g)).toHaveLength(1);
  expect(moveNoteBlock(editor,1)).toBe(true);expect(editor.state.doc.firstChild.textContent).toBe('Meeting notes');
  expect(moveNoteBlock(editor,-1)).toBe(true);expect(editor.state.doc.firstChild.textContent).toBe('First block');
 }finally{editor.destroy();}
});
test('styled collapsible sections and internal note links keep all content and safe attributes',async()=>{
 const {insertToggleSection,insertInternalNoteLink}=await import('../lib/richNotes.ts');
 const editor=create('Keep this.');try{
  editor.commands.setTextSelection({from:1,to:5});insertToggleSection(editor);expect(editor.state.doc.firstChild.textContent).toBe('Keep this.');
  editor.commands.selectAll();editor.commands.setColor('#7dd3fc');
  const saved=serializeRichNotes(editor),restored=create(saved);try{expect(restored.getJSON()).toEqual(editor.getJSON());}finally{restored.destroy();}
  editor.commands.setTextSelection(2);insertInternalNoteLink(editor,'page-a','Linked note');expect(serializeRichNotes(editor)).toContain('#note=page-a');
 }finally{editor.destroy();}
 expect(notesToSafeHtml('<p><a href="javascript:alert(1)">Unsafe</a></p>')).not.toContain('javascript:');
});

test('inserting a block into an empty paragraph does not leave automatic blank space',async()=>{
 const {insertNoteTemplate,insertToggleSection}=await import('../lib/richNotes.ts');
 for(const insert of [editor=>insertStickyNote(editor),editor=>insertToggleSection(editor),editor=>insertNoteTemplate(editor,'# Lesson plan\n\nWrite here')]){
  const editor=create('');try{insert(editor);expect(editor.state.doc.firstChild.type.name).not.toBe('paragraph');}finally{editor.destroy();}
 }
});
test('new note links preserve active typography and leave a space for continued writing',async()=>{
 const {insertInternalNoteLink}=await import('../lib/richNotes.ts');const editor=create('');try{
  editor.commands.setFontFamily('mono');insertInternalNoteLink(editor,'other-page','Related');
  expect(editor.getText()).toBe('Related ');expect(editor.state.doc.firstChild.firstChild.marks.some(mark=>mark.type.name==='textStyle'&&mark.attrs.fontFamily==='mono')).toBe(true);
  editor.commands.insertContent('More');expect(editor.getText()).toBe('Related More');expect(editor.state.doc.firstChild.lastChild.marks.some(mark=>mark.type.name==='link')).toBe(false);
 }finally{editor.destroy();}
});

test('incremental peer updates do not echo and local undo keeps a peer’s inserted writing',async()=>{
 const {applyRemoteNotes}=await import('../lib/richNotes.ts');const editor=create('Seed');let updates=0;editor.on('update',()=>updates++);
 try{editor.commands.insertContentAt(5,' local');expect(editor.getText()).toBe('Seed local');const count=updates;
  editor.commands.setTextSelection(2);applyRemoteNotes(editor,'Seed local peer');expect(updates).toBe(count);expect(editor.state.selection.from).toBe(2);
  editor.commands.undo();expect(editor.getText()).toBe('Seed peer');
  applyRemoteNotes(editor,'');expect(editor.isEmpty).toBe(true);
 }finally{editor.destroy();}
});

test('distinctive font families survive rich-note storage and safe preview rendering',()=>{
 for(const font of ['fredoka','bangers','lobster','marker','typewriter','space-mono','cormorant']){
  const editor=create('Distinctive writing');try{
   editor.commands.selectAll();editor.chain().setFontFamily(font).toggleBold().run();const saved=serializeRichNotes(editor),restored=create(saved);
   try{expect(restored.getJSON()).toEqual(editor.getJSON());expect(notesToSafeHtml(saved)).toContain(`data-note-font="${font}"`);}finally{restored.destroy();}
  }finally{editor.destroy();}
 }
});
