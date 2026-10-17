"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { highlightNotesSource } from "@/lib/code";
import { continueNoteList, formatNotes, indentNotes, noteHeadings, type NoteEdit, type NoteFormat } from "@/lib/notesEditing";
import { HighlightedCode } from "./CodeEditor";
import remarkGfm from "remark-gfm";
import { Heading1, List, CheckSquare, Code, Quote, Download, Eye, Edit3, Bold, Italic, ListTree, X } from "lucide-react";

interface DocEditorProps {
  value: string; onChange: (value: string) => void; onExportMarkdown: () => void;
  theme: "dark" | "light";
  focusRange?: { start: number; end: number };
}
const tools: {label:string;icon:typeof Bold;format:NoteFormat;shortcut?:string}[] = [
  {label:"Heading",icon:Heading1,format:"heading"},
  {label:"Bold (Ctrl/Cmd+B)",icon:Bold,format:"bold",shortcut:"Control+b Meta+b"},
  {label:"Italic (Ctrl/Cmd+I)",icon:Italic,format:"italic",shortcut:"Control+i Meta+i"},
  {label:"Bullet list",icon:List,format:"bullet"},
  {label:"Checklist",icon:CheckSquare,format:"checklist"},
  {label:"Code block",icon:Code,format:"code"},
  {label:"Quote",icon:Quote,format:"quote"},
];
export function DocEditor({ value, onChange, onExportMarkdown, focusRange }: DocEditorProps) {
  const textarea=useRef<HTMLTextAreaElement>(null),sourcePreview=useRef<HTMLPreElement>(null);
  const selection=useRef({start:0,end:0,scroll:0}),pending=useRef<{start:number;end:number}|null>(null);
  const [preview,setPreview]=useState(false),[outline,setOutline]=useState(false);
  const sourceHtml=useMemo(()=>highlightNotesSource(value)+"\n",[value]);
  const headings=useMemo(()=>noteHeadings(value),[value]);
  const syncSource=()=>{const input=textarea.current,painted=sourcePreview.current;if(input&&painted){painted.style.width=`${input.clientWidth}px`;painted.style.height=`${input.clientHeight}px`;painted.scrollTop=input.scrollTop;painted.scrollLeft=input.scrollLeft;}};
  useEffect(()=>{
    const input=textarea.current;if(!input)return;
    const observer=new ResizeObserver(syncSource);observer.observe(input);syncSource();return()=>observer.disconnect();
  },[preview]);
  useLayoutEffect(()=>{
    const input=textarea.current;if(!input)return;
    if(pending.current){input.focus();input.setSelectionRange(pending.current.start,pending.current.end);pending.current=null;}
    syncSource();
  },[value,preview]);
  useEffect(()=>{
    if(!focusRange)return;
    const frame=requestAnimationFrame(()=>{pending.current=focusRange;setPreview(false);const input=textarea.current;if(input){input.focus();input.setSelectionRange(focusRange.start,focusRange.end);pending.current=null;syncSource();}});
    return()=>cancelAnimationFrame(frame);
  },[focusRange]);
  const apply=(edit:NoteEdit)=>{
    pending.current={start:edit.start,end:edit.end};
    if(edit.value===value){textarea.current?.focus();textarea.current?.setSelectionRange(edit.start,edit.end);pending.current=null;}
    else onChange(edit.value);
  };
  const format=(kind:NoteFormat)=>{const input=textarea.current;if(input)apply(formatNotes(value,input.selectionStart,input.selectionEnd,kind));};
  const togglePreview=()=>{
    const input=textarea.current;
    if(input)selection.current={start:input.selectionStart,end:input.selectionEnd,scroll:input.scrollTop};
    if(preview)pending.current=selection.current;
    setPreview(!preview);
  };
  useLayoutEffect(()=>{if(!preview&&textarea.current){textarea.current.scrollTop=selection.current.scroll;syncSource();}},[preview]);
  const words=value.trim()?value.trim().split(/\s+/u).length:0;
  return <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#18181b] text-neutral-200">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
      <h2 className="text-xs font-semibold">Notes</h2>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Show note outline" aria-pressed={outline} title="Outline" onClick={()=>setOutline(!outline)} className={`note-tool ${outline?"text-blue-400":""}`}><ListTree className="h-4 w-4"/></button>
        <button type="button" onClick={togglePreview} aria-pressed={preview} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">{preview?<Edit3 className="h-3.5 w-3.5"/>:<Eye className="h-3.5 w-3.5"/>}{preview?"Edit":"Preview"}</button>
        <button type="button" aria-label="Download notes as Markdown" title="Download Markdown" onClick={onExportMarkdown} className="note-tool"><Download className="h-4 w-4"/></button>
      </div>
    </div>
    {!preview&&<div role="toolbar" aria-label="Note formatting" className="flex shrink-0 flex-wrap gap-0.5 border-b border-neutral-800 px-2 py-1">{tools.map(t=><button type="button" key={t.format} className="note-tool" title={t.label} aria-label={t.label} aria-keyshortcuts={t.shortcut} onMouseDown={e=>e.preventDefault()} onClick={()=>format(t.format)}><t.icon className="h-4 w-4"/></button>)}</div>}
    {outline&&<nav aria-label="Note outline" style={{maxHeight:"min(160px, 25%)"}} className="shrink-0 overflow-y-auto border-b border-neutral-800 px-3 py-2"><div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">Outline<button type="button" aria-label="Close outline" onClick={()=>setOutline(false)} className="note-tool"><X className="h-3 w-3"/></button></div>{headings.length?headings.map(h=><button type="button" key={h.start} className="block w-full truncate rounded py-1 pr-2 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white" style={{paddingLeft:8+(h.level-1)*10}} onClick={()=>{pending.current=h;setPreview(false);const input=textarea.current;if(input){input.focus();input.setSelectionRange(h.start,h.end);pending.current=null;}}}>{h.text}</button>):<p className="py-2 text-xs text-neutral-500">Add headings with # to organize your notes.</p>}</nav>}
    <div className={`min-h-0 min-w-0 flex-1 ${preview?"overflow-y-auto overflow-x-hidden":"overflow-hidden"}`}>
      {preview?<article className="note-preview mx-auto max-w-3xl break-words p-5"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{code:({children,className,...props})=>className||String(children).includes("\n")?<HighlightedCode code={String(children).replace(/\n$/,"")} language={className?.replace("language-","")||"auto"}/>:<code {...props}>{children}</code>,a:({children,...props})=><a {...props} target="_blank" rel="noopener noreferrer">{children}</a>}}>{value||"*Your notes will appear here. Switch to Edit to start writing.*"}</ReactMarkdown></article>:<div className="notes-source relative mx-auto h-full min-h-0 w-full max-w-3xl overflow-hidden"><pre ref={sourcePreview} aria-hidden="true" className="hljs pointer-events-none absolute inset-0 m-0 overflow-hidden" dangerouslySetInnerHTML={{__html:sourceHtml}}/><textarea ref={textarea} aria-label="Board notes in Markdown" value={value} onChange={e=>onChange(e.target.value)} onScroll={syncSource} placeholder={"Capture your thinking…\n\n# Project notes\n\n- Ideas, decisions, and next steps\n- [ ] Your first task\n\nUse Markdown for headings, tables, links, and code."} spellCheck autoCapitalize="sentences" className="relative block h-full min-h-0 w-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-white placeholder:text-neutral-600 focus:outline-none selection:bg-blue-500/30" onKeyDown={e=>{
        if(e.nativeEvent.isComposing)return;
        const input=e.currentTarget,mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
        if(mod&&(key==='b'||key==='i')){e.preventDefault();format(key==='b'?'bold':'italic');return;}
        if(e.key==='Tab'&&!mod&&!e.altKey){e.preventDefault();apply(indentNotes(value,input.selectionStart,input.selectionEnd,e.shiftKey));return;}
        if(e.key==='Enter'&&!e.shiftKey&&!mod&&!e.altKey){const edit=continueNoteList(value,input.selectionStart,input.selectionEnd);if(edit){e.preventDefault();apply(edit);}}
      }}/></div>}
    </div>
    <div className="flex shrink-0 justify-between border-t border-neutral-800 px-3 py-2 text-[10px] text-neutral-500"><span>Markdown</span><span>{words} {words===1?"word":"words"} · {Math.max(1,Math.ceil(words/200))} min read</span></div>
  </div>;
}
