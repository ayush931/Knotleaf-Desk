"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { findNoteMatches, replaceAllNoteMatches } from "@/lib/notesSearch";
import { highlightNotesSource } from "@/lib/code";
import { continueNoteList, formatNotes, indentNotes, noteHeadings, type NoteEdit, type NoteFormat } from "@/lib/notesEditing";
import { HighlightedCode } from "./CodeEditor";
import remarkGfm from "remark-gfm";
import { Heading1, List, CheckSquare, Code, Quote, Download, Eye, Edit3, Bold, Italic, ListTree, X, Search, Copy, ArrowUp, ArrowDown } from "lucide-react";

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
  const textarea=useRef<HTMLTextAreaElement>(null),sourcePreview=useRef<HTMLPreElement>(null),searchPreview=useRef<HTMLPreElement>(null);
  const selection=useRef({start:0,end:0,scroll:0}),pending=useRef<{start:number;end:number}|null>(null);
  const [preview,setPreview]=useState(false),[outline,setOutline]=useState(false);
  const [findOpen,setFindOpen]=useState(false),[query,setQuery]=useState(""),[replacement,setReplacement]=useState(""),[matchCase,setMatchCase]=useState(false),[matchIndex,setMatchIndex]=useState(-1),[notice,setNotice]=useState("");
  const findInput=useRef<HTMLInputElement>(null);
  const [undoReplacement,setUndoReplacement]=useState<{before:string;after:string;start:number;end:number}|null>(null);
  const matches=useMemo(()=>findNoteMatches(value,query,matchCase),[value,query,matchCase]);
  const activeIndex=matches.length?Math.max(0,Math.min(matchIndex,matches.length-1)):0;
  useEffect(()=>{if(findOpen)findInput.current?.focus();},[findOpen]);
  const sourceHtml=useMemo(()=>highlightNotesSource(value)+"\n",[value]);
  const headings=useMemo(()=>noteHeadings(value),[value]);
  const syncSource=()=>{const input=textarea.current;if(input)for(const painted of [sourcePreview.current,searchPreview.current])if(painted){painted.style.width=`${input.clientWidth}px`;painted.style.height=`${input.clientHeight}px`;painted.scrollTop=input.scrollTop;painted.scrollLeft=input.scrollLeft;}};
  useEffect(()=>{
    const input=textarea.current;if(!input)return;
    const observer=new ResizeObserver(syncSource);observer.observe(input);syncSource();return()=>observer.disconnect();
  },[preview]);
  useLayoutEffect(()=>{
    const input=textarea.current;if(!input)return;
    if(pending.current){input.focus();input.setSelectionRange(pending.current.start,pending.current.end);pending.current=null;}
    syncSource();
    const mark=searchPreview.current?.querySelector("mark");
    if(findOpen&&matchIndex>=0&&mark){const bounds=input.getBoundingClientRect(),match=mark.getBoundingClientRect();if(match.top<bounds.top+20||match.bottom>bounds.bottom-20){input.scrollTop=Math.max(0,input.scrollTop+match.top-bounds.top-input.clientHeight/3);syncSource();}}
  },[value,preview,findOpen,query,activeIndex,matchIndex]);
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
  const openFind=()=>{
    const input=textarea.current,selected=input?.value.slice(input.selectionStart,input.selectionEnd);
    if(selected&&!selected.includes("\n")){setQuery(selected);setMatchIndex(-1);}
    setPreview(false);setFindOpen(true);findInput.current?.focus();
  };
  const closeFind=()=>{setFindOpen(false);textarea.current?.focus();};
  const jump=(direction:number)=>{
    if(!matches.length)return;
    const index=matchIndex<0?(direction<0?matches.length-1:0):(activeIndex+(direction||1)+matches.length)%matches.length;setMatchIndex(index);
    const match=matches[index];pending.current=match;setPreview(false);
    const input=textarea.current;if(input){input.setSelectionRange(match.start,match.end);pending.current=null;syncSource();}
  };
  const replaceMatch=(all=false)=>{
    if(!matches.length)return;
    const match=matches[activeIndex];
    const next=all?replaceAllNoteMatches(value,query,replacement,matchCase):{value:value.slice(0,match.start)+replacement+value.slice(match.end),count:1};
    const position=all?matches[0].start:match.start;
    setUndoReplacement({before:value,after:next.value,start:match.start,end:match.end});
    apply({value:next.value,start:position,end:position+replacement.length});
    if(all)setMatchIndex(-1);else if(next.value===value)setMatchIndex((activeIndex+1)%matches.length);
    setNotice(`Replaced ${next.count} ${next.count===1?"match":"matches"}.`);
  };
  const copyNotes=async()=>{
    try{await navigator.clipboard.writeText(value);setNotice("Markdown copied.");}catch{setNotice("Could not copy. Select your notes or download Markdown.");}
  };
  const words=value.trim()?value.trim().split(/\s+/u).length:0;
  return <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#18181b] text-neutral-200" onKeyDown={event=>{
      if(event.nativeEvent.isComposing)return;
      if((event.ctrlKey||event.metaKey)&&["f","h"].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();openFind();}
      else if(findOpen&&event.key==="F3"){event.preventDefault();event.stopPropagation();jump(event.shiftKey?-1:1);}
      else if(findOpen&&event.key==="Escape"){event.preventDefault();event.stopPropagation();closeFind();}
    }}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
      <h2 className="text-xs font-semibold">Notes</h2>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Find and replace in notes" aria-expanded={findOpen} aria-keyshortcuts="Control+f Meta+f Control+h Meta+h" title="Find and replace · Ctrl/Cmd+F" onClick={openFind} className="note-tool"><Search className="h-4 w-4"/></button>
        <button type="button" aria-label="Copy notes as Markdown" title="Copy Markdown" onClick={()=>void copyNotes()} className="note-tool"><Copy className="h-4 w-4"/></button>
        <button type="button" aria-label="Show note outline" aria-pressed={outline} title="Outline" onClick={()=>setOutline(!outline)} className={`note-tool ${outline?"text-blue-400":""}`}><ListTree className="h-4 w-4"/></button>
        <button type="button" onClick={togglePreview} aria-pressed={preview} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">{preview?<Edit3 className="h-3.5 w-3.5"/>:<Eye className="h-3.5 w-3.5"/>}{preview?"Edit":"Preview"}</button>
        <button type="button" aria-label="Download notes as Markdown" title="Download Markdown" onClick={onExportMarkdown} className="note-tool"><Download className="h-4 w-4"/></button>
      </div>
    </div>
    {!preview&&<div role="toolbar" aria-label="Note formatting" className="flex shrink-0 flex-wrap gap-0.5 border-b border-neutral-800 px-2 py-1">{tools.map(t=><button type="button" key={t.format} className="note-tool" title={t.label} aria-label={t.label} aria-keyshortcuts={t.shortcut} onMouseDown={e=>e.preventDefault()} onClick={()=>format(t.format)}><t.icon className="h-4 w-4"/></button>)}</div>}
    {findOpen&&<div role="search" aria-label="Find and replace notes" className="shrink-0 space-y-2 border-b border-neutral-800 bg-neutral-900/60 p-2 text-xs">
      <div className="flex min-w-0 items-center gap-1">
        <input ref={findInput} type="search" aria-label="Find in notes" placeholder="Find in notes…" value={query} onChange={event=>{setQuery(event.target.value);setMatchIndex(-1);setNotice("");}} onKeyDown={event=>{if(event.key==="Enter"&&!event.nativeEvent.isComposing){event.preventDefault();jump(event.shiftKey?-1:0);}}} className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-neutral-200"/>
        <button type="button" aria-label="Previous note match" title="Previous match" disabled={!matches.length} onClick={()=>jump(-1)} className="note-tool"><ArrowUp className="h-3.5 w-3.5"/></button>
        <button type="button" aria-label="Next note match" title="Next match" disabled={!matches.length} onClick={()=>jump(1)} className="note-tool"><ArrowDown className="h-3.5 w-3.5"/></button>
        <button type="button" aria-label="Close note search" onClick={closeFind} className="note-tool"><X className="h-3.5 w-3.5"/></button>
      </div>
      <input aria-label="Replace in notes" placeholder="Replace with…" value={replacement} onChange={event=>setReplacement(event.target.value)} className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-neutral-200"/>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-neutral-400"><input type="checkbox" checked={matchCase} onChange={event=>{setMatchCase(event.target.checked);setMatchIndex(-1);}}/>Match case</label>
        <button type="button" disabled={!matches.length} onClick={()=>replaceMatch()} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800 disabled:opacity-40">Replace</button>
        <button type="button" disabled={!matches.length} onClick={()=>replaceMatch(true)} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800 disabled:opacity-40">Replace all</button>
        {undoReplacement&&<button type="button" disabled={value!==undoReplacement.after} onClick={()=>{apply({value:undoReplacement.before,start:undoReplacement.start,end:undoReplacement.end});setUndoReplacement(null);setNotice("Replacement undone.");}} className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800 disabled:opacity-40">Undo replace</button>}
        <span role="status" className="text-[10px] text-neutral-500">{query?matches.length?matchIndex<0?`${matches.length} matches`:`${activeIndex+1} / ${matches.length}`:"No matches":"Type to search"}</span>
      </div>
    </div>}
    {outline&&<nav aria-label="Note outline" style={{maxHeight:"min(160px, 25%)"}} className="shrink-0 overflow-y-auto border-b border-neutral-800 px-3 py-2"><div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">Outline<button type="button" aria-label="Close outline" onClick={()=>setOutline(false)} className="note-tool"><X className="h-3 w-3"/></button></div>{headings.length?headings.map(h=><button type="button" key={h.start} className="block w-full truncate rounded py-1 pr-2 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white" style={{paddingLeft:8+(h.level-1)*10}} onClick={()=>{pending.current=h;setPreview(false);const input=textarea.current;if(input){input.focus();input.setSelectionRange(h.start,h.end);pending.current=null;}}}>{h.text}</button>):<p className="py-2 text-xs text-neutral-500">Add headings with # to organize your notes.</p>}</nav>}
    <div className={`min-h-0 min-w-0 flex-1 ${preview?"overflow-y-auto overflow-x-hidden":"overflow-hidden"}`}>
      {preview?<article className="note-preview mx-auto max-w-3xl break-words p-5"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{code:({children,className,...props})=>className||String(children).includes("\n")?<HighlightedCode code={String(children).replace(/\n$/,"")} language={className?.replace("language-","")||"auto"}/>:<code {...props}>{children}</code>,a:({children,...props})=><a {...props} target="_blank" rel="noopener noreferrer">{children}</a>}}>{value||"*Your notes will appear here. Switch to Edit to start writing.*"}</ReactMarkdown></article>:<div className="notes-source relative mx-auto h-full min-h-0 w-full max-w-3xl overflow-hidden"><pre ref={sourcePreview} aria-hidden="true" className="hljs pointer-events-none absolute inset-0 m-0 overflow-hidden" dangerouslySetInnerHTML={{__html:sourceHtml}}/>{findOpen&&matches[activeIndex]&&<pre ref={searchPreview} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden text-transparent">{value.slice(0,matches[activeIndex].start)}<mark className="bg-amber-400/25 text-transparent">{value.slice(matches[activeIndex].start,matches[activeIndex].end)}</mark>{value.slice(matches[activeIndex].end)}{"\n"}</pre>}<textarea ref={textarea} aria-label="Board notes in Markdown" value={value} onChange={e=>onChange(e.target.value)} onScroll={syncSource} placeholder={"Capture your thinking…\n\n# Project notes\n\n- Ideas, decisions, and next steps\n- [ ] Your first task\n\nUse Markdown for headings, tables, links, and code."} spellCheck autoCapitalize="sentences" className="relative block h-full min-h-0 w-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-white placeholder:text-neutral-600 focus:outline-none selection:bg-blue-500/30" onKeyDown={e=>{
        if(e.nativeEvent.isComposing)return;
        const input=e.currentTarget,mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
        if(mod&&(key==='b'||key==='i')){e.preventDefault();format(key==='b'?'bold':'italic');return;}
        if(e.key==='Tab'&&!mod&&!e.altKey){e.preventDefault();apply(indentNotes(value,input.selectionStart,input.selectionEnd,e.shiftKey));return;}
        if(e.key==='Enter'&&!e.shiftKey&&!mod&&!e.altKey){const edit=continueNoteList(value,input.selectionStart,input.selectionEnd);if(edit){e.preventDefault();apply(edit);}}
      }}/></div>}
    </div>
    <div className="flex shrink-0 justify-between border-t border-neutral-800 px-3 py-2 text-[10px] text-neutral-500"><span role="status">{notice||"Markdown"}</span><span className="shrink-0">{words} {words===1?"word":"words"} · {Math.ceil(words/200)} min read</span></div>
  </div>;
}
