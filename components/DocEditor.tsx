"use client";

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Bold, Italic, Strikethrough, List, ListOrdered, CheckSquare, Quote, Code, Minus, Table2, StickyNote, Link2, Undo2, Redo2, Search, X, ArrowUp, ArrowDown, Download, Copy, ListTree, Code2 } from 'lucide-react';
import { MarkdownNotesEditor } from './MarkdownNotesEditor';
import { richNotesExtensions, richNoteMatches, noteSearchKey, safeNoteLink, insertStickyNote } from '@/lib/richNotes';

interface DocEditorProps {
  value: string; onChange: (value: string) => void; onExportMarkdown: () => void;
  theme: 'dark' | 'light'; focusRange?: { start: number; end: number };
}
export function DocEditor(props: DocEditorProps) {
  const [source, setSource] = useState(false);
  return <div className="flex h-full min-h-0 min-w-0 flex-col">
    {source ? <><div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-[#18181b] px-3 py-2 text-xs text-neutral-400"><span>Markdown source</span><button type="button" className="rounded px-2 py-1 text-blue-400 hover:bg-neutral-800" onClick={() => setSource(false)}>Back to writing</button></div><div className="min-h-0 flex-1"><MarkdownNotesEditor {...props}/></div></> : <RichNotesEditor {...props} onSource={() => setSource(true)}/>}
  </div>;
}
function RichNotesEditor({ value, onChange, onExportMarkdown, focusRange, onSource }: DocEditorProps & { onSource: () => void }) {
  const change = useRef(onChange), latest = useRef(value), published = useRef(value);
  useEffect(() => { change.current=onChange; latest.current=value; },[onChange,value]);
  const [extensions] = useState(richNotesExtensions);
  const [find, setFind] = useState(false), [query, setQuery] = useState(''), [replacement, setReplacement] = useState(''), [matchCase, setMatchCase] = useState(false), [active, setActive] = useState(-1);
  const [outline, setOutline] = useState(false), [linkOpen, setLinkOpen] = useState(false), [link, setLink] = useState(''), [linkError, setLinkError] = useState(''), [notice, setNotice] = useState('');
  const findInput = useRef<HTMLInputElement>(null), linkInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions, content: value, contentType: 'markdown', immediatelyRender: false,
    editorProps: { attributes: { 'aria-label': 'Board notes', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' } },
    onUpdate: ({ editor }) => { const next = editor.getMarkdown(); published.current = next; change.current(next); },
  });
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), strike: editor.isActive('strike'), bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), task: editor.isActive('taskList'), quote: editor.isActive('blockquote'), code: editor.isActive('codeBlock'), table: editor.isActive('table'), link: editor.isActive('link'),
    heading: editor.isActive('heading') ? String(editor.getAttributes('heading').level) : '0', undo: editor.can().undo(), redo: editor.can().redo(),
    text: editor.getText(), headings: (() => { const result: { pos: number; text: string; level: number }[] = []; editor.state.doc.descendants((node,pos) => { if(node.type.name==='heading')result.push({pos,text:node.textContent,level:node.attrs.level}); }); return result; })(),
    matches: richNoteMatches(editor.state.doc, query, matchCase),
  } : null });
  const matches = state?.matches ?? [], index = matches.length ? Math.min(Math.max(active,0),matches.length-1) : -1;
  useEffect(() => {
    if (!editor || value === published.current) return;
    const selection = editor.state.selection;
    editor.chain().setMeta('addToHistory',false).setContent(value, { contentType: 'markdown', emitUpdate: false }).run();
    const end = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(selection.from,end), to: Math.min(selection.to,end) });
    published.current = value;
  }, [editor,value]);
  useEffect(() => { if(editor)editor.view.dispatch(editor.state.tr.setMeta(noteSearchKey,{query:find?query:'',matchCase,active:index})); }, [editor,query,find,matchCase,index]);
  useEffect(() => { if(find)findInput.current?.focus(); },[find]);
  useEffect(() => { if(linkOpen)linkInput.current?.focus(); },[linkOpen]);
  useEffect(() => { if(!notice)return;const timer=setTimeout(()=>setNotice(''),2000);return()=>clearTimeout(timer); },[notice]);
  useEffect(() => {
    if(!editor||!focusRange)return;
    // Board search uses Markdown offsets. Find the selected readable text in the visual document.
    const needle=latest.current.slice(focusRange.start,focusRange.end).replace(/^#{1,6}\s+/,'');
    const match=richNoteMatches(editor.state.doc,needle)[0];
    if(match)editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  },[editor,focusRange]);
  const openFind=()=>{setFind(true);findInput.current?.focus();};
  const jump=(direction=1)=>{
    if(!editor||!matches.length)return;
    const next=active<0?(direction<0?matches.length-1:0):(index+direction+matches.length)%matches.length;
    setActive(next);editor.chain().setTextSelection(matches[next]).scrollIntoView().run();
  };
  const replace=(all=false)=>{
    if(!editor||!matches.length)return;
    const targets=all?matches:[matches[Math.max(0,index)]];
    const tr=editor.state.tr;for(const match of [...targets].reverse()){if(replacement)tr.insertText(replacement,match.from,match.to);else tr.delete(match.from,match.to);}
    editor.view.dispatch(tr);setActive(-1);setNotice(`Replaced ${targets.length} ${targets.length===1?'match':'matches'}.`);
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(editor?.getText()||'');setNotice('Notes copied.');}catch{setNotice('Could not copy. Select your notes and copy again.');}};
  const closeLink=()=>{setLinkOpen(false);editor?.commands.focus();};
  const applyLink=()=>{const href=safeNoteLink(link);if(!href){setLinkError('Enter a valid https, http or email link.');return;}editor?.chain().focus().extendMarkRange('link').setLink({href}).run();closeLink();};
  const words=state?.text.trim()?state.text.trim().split(/\s+/u).length:0;
  const tools=[
    {label:'Bold',icon:Bold,active:state?.bold,run:()=>editor?.chain().focus().toggleBold().run()},
    {label:'Italic',icon:Italic,active:state?.italic,run:()=>editor?.chain().focus().toggleItalic().run()},
    {label:'Strikethrough',icon:Strikethrough,active:state?.strike,run:()=>editor?.chain().focus().toggleStrike().run()},
    {label:'Bullet list',icon:List,active:state?.bullet,run:()=>editor?.chain().focus().toggleBulletList().run()},
    {label:'Numbered list',icon:ListOrdered,active:state?.ordered,run:()=>editor?.chain().focus().toggleOrderedList().run()},
    {label:'Checklist',icon:CheckSquare,active:state?.task,run:()=>editor?.chain().focus().toggleTaskList().run()},
    {label:'Quote',icon:Quote,active:state?.quote,run:()=>editor?.chain().focus().toggleBlockquote().run()},
    {label:'Code block',icon:Code,active:state?.code,run:()=>editor?.chain().focus().toggleCodeBlock().run()},
    {label:'Insert sticky note',icon:StickyNote,run:()=>{if(editor)insertStickyNote(editor);}},
    {label:'Insert table',icon:Table2,run:()=>editor?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()},
    {label:'Insert divider',icon:Minus,run:()=>editor?.chain().focus().setHorizontalRule().run()},
    {label:'Add or edit link',icon:Link2,active:state?.link,run:()=>{setLink(editor?.getAttributes('link').href||'');setLinkError('');setLinkOpen(true);}},
  ];
  return <section aria-label="Notes editor" className="flex h-full min-h-0 min-w-0 flex-col bg-[#18181b] text-neutral-200" onKeyDown={event=>{
    if(event.nativeEvent.isComposing)return;
    if((event.ctrlKey||event.metaKey)&&['f','h'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();openFind();}
    else if(find&&event.key==='F3'){event.preventDefault();event.stopPropagation();jump(event.shiftKey?-1:1);}
    else if(event.key==='Escape'&&(find||linkOpen)){event.preventDefault();event.stopPropagation();setFind(false);closeLink();}
  }}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b border-neutral-800 px-3 py-2"><h2 className="text-xs font-semibold">Notes</h2><div className="flex items-center gap-0.5">
      <button type="button" className="note-tool" title="Find and replace" aria-label="Find and replace in notes" aria-expanded={find} onClick={openFind}><Search className="h-4 w-4"/></button>
      <button type="button" className="note-tool" title="Outline" aria-label="Show note outline" aria-pressed={outline} onClick={()=>setOutline(!outline)}><ListTree className="h-4 w-4"/></button>
      <button type="button" className="note-tool" title="Copy notes" aria-label="Copy notes" onClick={()=>void copy()}><Copy className="h-4 w-4"/></button>
      <button type="button" className="note-tool" title="Download Markdown" aria-label="Download notes as Markdown" onClick={onExportMarkdown}><Download className="h-4 w-4"/></button>
      <button type="button" className="note-tool" title="Optional Markdown source" aria-label="Edit Markdown source" onClick={onSource}><Code2 className="h-4 w-4"/></button>
    </div></header>
    <div role="toolbar" aria-label="Note formatting" className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-neutral-800 px-2 py-1">
      <select aria-label="Paragraph style" className="mr-1 min-w-0 max-w-28 rounded border border-neutral-700 bg-neutral-900 p-1.5 text-xs" value={state?.heading||'0'} onChange={e=>{const level=Number(e.target.value);if(level)editor?.chain().focus().toggleHeading({level:level as 1|2|3|4|5|6}).run();else editor?.chain().focus().setParagraph().run();}}><option value="0">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option><option value="4">Heading 4</option><option value="5">Heading 5</option><option value="6">Heading 6</option></select>
      {tools.map(t=><button key={t.label} type="button" title={t.label} aria-label={t.label} aria-pressed={t.active} disabled={!editor} className={`note-tool ${t.active?'bg-blue-500/15 text-blue-400':''}`} onMouseDown={e=>e.preventDefault()} onClick={t.run}><t.icon className="h-4 w-4"/></button>)}
      <button type="button" className="note-tool" title="Undo" aria-label="Undo notes" disabled={!state?.undo} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().undo().run()}><Undo2 className="h-4 w-4"/></button>
      <button type="button" className="note-tool" title="Redo" aria-label="Redo notes" disabled={!state?.redo} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().redo().run()}><Redo2 className="h-4 w-4"/></button>
    </div>
    {state?.table&&<div role="toolbar" aria-label="Table options" className="flex shrink-0 flex-wrap gap-2 border-b border-neutral-800 px-3 py-2 text-xs">{[['Add row',()=>editor?.chain().focus().addRowAfter().run()],['Add column',()=>editor?.chain().focus().addColumnAfter().run()],['Delete row',()=>editor?.chain().focus().deleteRow().run()],['Delete column',()=>editor?.chain().focus().deleteColumn().run()],['Delete table',()=>editor?.chain().focus().deleteTable().run()]].map(([label,run])=><button key={label as string} type="button" onMouseDown={e=>e.preventDefault()} onClick={run as ()=>void} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800">{label as string}</button>)}</div>}
    {linkOpen&&<form noValidate aria-label="Edit note link" className="shrink-0 space-y-2 border-b border-neutral-800 p-3 text-xs" onSubmit={e=>{e.preventDefault();applyLink();}}><label htmlFor="note-link" className="block text-neutral-400">Link address</label><input id="note-link" ref={linkInput} value={link} onChange={e=>{setLink(e.target.value);setLinkError('');}} aria-invalid={!!linkError} aria-describedby={linkError?'note-link-error':undefined} className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5" placeholder="https://example.com"/>{linkError&&<p id="note-link-error" role="alert" className="text-rose-400">{linkError}</p>}<div className="flex gap-2"><button className="rounded bg-blue-600 px-3 py-1">Apply link</button><button type="button" onClick={()=>{editor?.chain().focus().extendMarkRange('link').unsetLink().run();closeLink();}} className="rounded px-2 py-1 hover:bg-neutral-800">Remove link</button><button type="button" onClick={closeLink} className="rounded px-2 py-1 hover:bg-neutral-800">Cancel</button></div></form>}
    {find&&<div role="search" aria-label="Find and replace notes" className="shrink-0 space-y-2 border-b border-neutral-800 p-2 text-xs"><div className="flex items-center gap-1"><input ref={findInput} aria-label="Find in notes" placeholder="Find in notes…" value={query} onChange={e=>{setQuery(e.target.value);setActive(-1);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();jump(e.shiftKey?-1:1);}}} className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"/>{query&&<button type="button" aria-label="Clear note search" className="note-tool" onClick={()=>{setQuery('');setActive(-1);findInput.current?.focus();}}><X className="h-3 w-3"/></button>}<button type="button" aria-label="Previous note match" disabled={!matches.length} className="note-tool" onClick={()=>jump(-1)}><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" aria-label="Next note match" disabled={!matches.length} className="note-tool" onClick={()=>jump(1)}><ArrowDown className="h-3.5 w-3.5"/></button><button type="button" aria-label="Close note search" className="note-tool" onClick={()=>{setFind(false);editor?.commands.focus();}}><X className="h-3.5 w-3.5"/></button></div><input aria-label="Replace in notes" value={replacement} placeholder="Replace with…" onChange={e=>setReplacement(e.target.value)} className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"/><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1"><input type="checkbox" checked={matchCase} onChange={e=>{setMatchCase(e.target.checked);setActive(-1);}}/>Match case</label><button type="button" disabled={!matches.length} className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40" onClick={()=>replace()}>Replace</button><button type="button" disabled={!matches.length} className="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40" onClick={()=>replace(true)}>Replace all</button><span role="status" className="text-neutral-500">{query?matches.length?`${index+1} / ${matches.length}`:'No matches':'Type to search'}</span></div></div>}
    {outline&&<nav aria-label="Note outline" className="max-h-36 shrink-0 overflow-auto border-b border-neutral-800 p-2">{state?.headings.length?state.headings.map(h=><button type="button" key={h.pos} className="block w-full truncate rounded py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800" style={{paddingLeft:8+(h.level-1)*10}} onClick={()=>editor?.chain().focus().setTextSelection(h.pos+1).scrollIntoView().run()}>{h.text||'Untitled heading'}</button>):<p className="p-2 text-xs text-neutral-500">Use a heading style to organize your notes.</p>}</nav>}
    <div onMouseDown={event=>{if(!(event.target as HTMLElement).closest('[contenteditable="true"]')){event.preventDefault();editor?.commands.focus('end');}}} className="notes-rich min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"><EditorContent editor={editor} className="mx-auto min-h-full max-w-3xl"/></div>
    <footer className="flex min-h-10 shrink-0 items-center justify-between gap-2 border-t border-neutral-800 py-2 pl-28 pr-3 text-[10px] text-neutral-500"><span role="status">{notice}</span><span className="shrink-0">{words} {words===1?'word':'words'}</span></footer>
  </section>;
}
