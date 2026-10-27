"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FileText, Code2, Eye, Columns2, ListTree, Search, MoreHorizontal, Copy, Download, Maximize2, X, ArrowUp, ArrowDown, Bold, Italic, Heading1, List, Quote, Braces, CheckSquare } from 'lucide-react';
import { MarkdownPreviewBoundary } from './MarkdownPreviewBoundary';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { continueNoteList, formatNotes, indentNotes, noteHeadings, type NoteEdit, type NoteFormat } from '@/lib/notesEditing';
import { markdownCaret, markdownLineStarts, markdownMatches, markdownWords, replaceMarkdownMatches, type MarkdownView, type MarkdownWorkspaceSettings, type PreviewHeading } from '@/lib/markdownWorkspace';
const Preview=React.lazy(()=>import('./NotePreview').then(module=>({default:module.NotePreview})));
const LINE_HEIGHT=22;
const formats:{label:string;format:NoteFormat;icon:typeof Bold}[]=[{label:'Heading',format:'heading',icon:Heading1},{label:'Bold',format:'bold',icon:Bold},{label:'Italic',format:'italic',icon:Italic},{label:'Bullet list',format:'bullet',icon:List},{label:'Checklist',format:'checklist',icon:CheckSquare},{label:'Quote',format:'quote',icon:Quote},{label:'Code block',format:'code',icon:Braces}];
export interface MarkdownWorkspaceProps {
  value:string;onChange:(value:string)=>void;title?:string;documentKey?:string;initialView?:MarkdownView;viewToken?:number;
  navigation?:React.ReactNode;footerActions?:React.ReactNode;onDownload?:()=>void|Promise<void>;onWriting?:()=>void;sourceLabel?:string;status?:string;scopeLabel?:string;busy?:boolean;lightweight?:boolean;maxLength?:number;
}
export function MarkdownWorkspace({value,onChange,title='Markdown notes',documentKey='notes',initialView,viewToken,navigation,footerActions,onDownload,onWriting,sourceLabel='Markdown source',status='Markdown',scopeLabel='Document',busy=false,lightweight=false,maxLength=128*1024}:MarkdownWorkspaceProps) {
  const [settings,setSettings]=useState<MarkdownWorkspaceSettings>(()=>({...loadPreferences().markdownWorkspace,...(initialView?{mode:initialView}:{})}));
  const [appliedViewToken,setAppliedViewToken]=useState(viewToken);
  if(viewToken!==undefined&&viewToken!==appliedViewToken){setAppliedViewToken(viewToken);if(initialView)setSettings(previous=>({...previous,mode:initialView}));}
  const [outline,setOutline]=useState(false),[findOpen,setFindOpen]=useState(false),[query,setQuery]=useState(''),[replacement,setReplacement]=useState(''),[matchCase,setMatchCase]=useState(false),[matchIndex,setMatchIndex]=useState(0),[notice,setNotice]=useState('');
  const [undo,setUndo]=useState<{key:string;before:string;after:string}|null>(null),[previewHeadings,setPreviewHeadings]=useState<PreviewHeading[]>([]);
  const [snapshot,setSnapshot]=useState({key:documentKey,text:value}),[cursor,setCursor]=useState(0),[sourceScroll,setSourceScroll]=useState({top:0,height:400}),[fullScreen,setFullScreen]=useState(false);
  const [activeDocument,setActiveDocument]=useState(documentKey);
  if(activeDocument!==documentKey){setActiveDocument(documentKey);setCursor(0);setSourceScroll(previous=>({...previous,top:0}));setMatchIndex(0);setPreviewHeadings([]);setNotice('');}
  const options=useRef<HTMLDetailsElement>(null),optionsTrigger=useRef<HTMLElement>(null);
  const root=useRef<HTMLDivElement>(null),source=useRef<HTMLTextAreaElement>(null),preview=useRef<HTMLDivElement>(null),findInput=useRef<HTMLInputElement>(null);
  const scrollLock=useRef<'source'|'preview'|null>(null),unlockFrame=useRef<number|null>(null),selectionFrame=useRef<number|null>(null);
  const headingPrefix=useId().replace(/:/g,'');
  const lines=useMemo(()=>markdownLineStarts(value),[value]),words=useMemo(()=>markdownWords(value),[value]);
  const location=markdownCaret(lines,Math.min(cursor,value.length));
  const search=useMemo(()=>markdownMatches(value,findOpen?query:'',matchCase),[value,query,matchCase,findOpen]);
  const activeMatch=search.matches.length?Math.min(matchIndex,search.matches.length-1):0;
  const sourceHeadings=useMemo(()=>outline?noteHeadings(value):[],[value,outline]);
  const appearance=useMemo(()=>({size:settings.size,width:settings.width,lineHeight:1.85}),[settings.size,settings.width]);
  const hasSource=settings.mode!=='preview',hasPreview=settings.mode!=='source';
  const updateSettings=(patch:Partial<MarkdownWorkspaceSettings>)=>{const next={...settings,...patch};setSettings(next);savePreferences({markdownWorkspace:next});};
  useEffect(()=>{
    if(!hasPreview||busy)return;
    const timer=setTimeout(()=>setSnapshot({key:documentKey,text:value}),250);
    return()=>clearTimeout(timer);
  },[value,documentKey,hasPreview,busy]);
  useEffect(()=>{if(findOpen)findInput.current?.focus();},[findOpen]);
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(options.current?.open&&event.target instanceof window.Node&&!options.current.contains(event.target))options.current.open=false;};
    document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);
  },[]);
  const closeOptions=()=>{if(options.current)options.current.open=false;optionsTrigger.current?.focus();};
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),2500);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{
    const update=()=>setFullScreen(document.fullscreenElement===root.current);
    document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);
  },[]);
  useEffect(()=>()=>{if(unlockFrame.current!==null)cancelAnimationFrame(unlockFrame.current);if(selectionFrame.current!==null)cancelAnimationFrame(selectionFrame.current);},[]);
  useEffect(()=>{
    const input=source.current;if(!input||typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(()=>setSourceScroll({top:input.scrollTop,height:input.clientHeight||400}));observer.observe(input);return()=>observer.disconnect();
  },[settings.mode,settings.wrap]);
  useEffect(()=>{source.current?.scrollTo?.({top:0});preview.current?.scrollTo?.({top:0});},[documentKey]);
  const selectSource=(start:number,end=start,focus=true)=>{
    if(settings.mode==='preview')setSettings(previous=>({...previous,mode:'split'}));
    if(selectionFrame.current!==null)cancelAnimationFrame(selectionFrame.current);
    selectionFrame.current=requestAnimationFrame(()=>{
      const input=source.current;if(!input)return;
      if(focus)input.focus({preventScroll:true});input.setSelectionRange(start,end);setCursor(start);
      // Native textarea scrolling has no hidden syntax mirror or document-sized DOM.
      const line=markdownCaret(markdownLineStarts(input.value),start).line;
      input.scrollTop=Math.max(0,(line-1)*LINE_HEIGHT-input.clientHeight/3);
      setSourceScroll({top:input.scrollTop,height:input.clientHeight||400});
      if(!focus)findInput.current?.focus({preventScroll:true});
    });
  };
  const apply=(edit:NoteEdit)=>{if(edit.value.length>maxLength){setNotice('This section is full. Use a shorter edit.');return;}onChange(edit.value);selectSource(edit.start,edit.end);};
  const format=(kind:NoteFormat)=>{const input=source.current;if(input)apply(formatNotes(value,input.selectionStart,input.selectionEnd,kind));};
  const sync=(from:'source'|'preview')=>{
    if(!settings.syncScroll||settings.mode!=='split'||scrollLock.current&&scrollLock.current!==from)return;
    const a=from==='source'?source.current:preview.current,b=from==='source'?preview.current:source.current;if(!a||!b)return;
    const maximum=a.scrollHeight-a.clientHeight;if(maximum<=0)return;
    const top=a.scrollTop/maximum*Math.max(0,b.scrollHeight-b.clientHeight);if(Math.abs(b.scrollTop-top)<1)return;
    scrollLock.current=from;b.scrollTop=top;
    if(unlockFrame.current!==null)cancelAnimationFrame(unlockFrame.current);
    unlockFrame.current=requestAnimationFrame(()=>{scrollLock.current=null;});
  };
  const jumpMatch=(direction:number)=>{
    if(!search.matches.length)return;const index=(activeMatch+direction+search.matches.length)%search.matches.length;setMatchIndex(index);
    const match=search.matches[index];selectSource(match.start,match.end,false);
  };
  const replace=(all=false)=>{
    if(!search.matches.length)return;if(all&&search.truncated){setNotice('Refine the search before replacing more than 1,000 matches.');return;}
    const matches=all?search.matches:[search.matches[activeMatch]];
    try{const next=replaceMarkdownMatches(value,matches,replacement,maxLength);setUndo({key:documentKey,before:value,after:next});onChange(next);selectSource(matches[0].start,matches[0].start+replacement.length,false);setNotice(`Replaced ${matches.length} ${matches.length===1?'match':'matches'}.`);}catch(reason){setNotice(reason instanceof Error?reason.message:'Could not replace this text.');}
  };
  const jumpHeading=(index:number)=>{
    const heading=sourceHeadings[index];
    if(hasPreview){const target=preview.current?.querySelectorAll('h1,h2,h3,h4,h5,h6')[index] as HTMLElement|undefined;if(target&&preview.current){let details=target.closest('details');while(details){details.open=true;details=details.parentElement?.closest('details')||null;}const container=preview.current;container.scrollTop+=target.getBoundingClientRect().top-container.getBoundingClientRect().top-24;}}
    if(settings.mode==='source'&&heading)selectSource(heading.start,heading.end);
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(value);setNotice('Markdown copied.');}catch{setNotice('Copy is unavailable. Select the source or download Markdown.');}};
  const toggleFullScreen=async()=>{try{if(document.fullscreenElement===root.current)await document.exitFullscreen();else if(root.current?.requestFullscreen)await root.current.requestFullscreen();else throw new Error('Full screen is unavailable in this browser.');}catch(reason){setNotice(reason instanceof Error?reason.message:'Could not open full screen.');}};
  const visibleStart=Math.max(0,Math.floor(sourceScroll.top/LINE_HEIGHT)-2),visibleEnd=Math.min(lines.length,visibleStart+Math.min(200,Math.ceil(sourceScroll.height/LINE_HEIGHT)+6));
  const headings=settings.mode==='source'?sourceHeadings.map((heading,index)=>({id:String(index),text:heading.text,level:heading.level})):previewHeadings;
  const previewCurrent=snapshot.key===documentKey;
  return <div ref={root} className="markdown-workspace flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#18181b] text-neutral-200" onKeyDown={event=>{
    if(event.nativeEvent.isComposing)return;
    if(event.key==='Escape'&&options.current?.open){event.preventDefault();event.stopPropagation();closeOptions();return;}
    if(event.key==='Escape'&&outline){event.preventDefault();event.stopPropagation();setOutline(false);root.current?.querySelector<HTMLButtonElement>('[aria-label="Markdown outline"]')?.focus();return;}
    if((event.metaKey||event.ctrlKey)&&['f','h'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();setFindOpen(true);findInput.current?.focus();}
    else if(event.key==='Escape'&&findOpen){event.preventDefault();setFindOpen(false);source.current?.focus();}
    else if(event.key==='F3'&&findOpen){event.preventDefault();jumpMatch(event.shiftKey?-1:1);}
  }}>
    <header className="markdown-workspace-header relative flex h-10 shrink-0 items-center gap-2 border-b border-neutral-800 px-2">
      <div className="markdown-document-title flex min-w-0 flex-1 items-center gap-2"><FileText aria-hidden className="h-4 w-4 shrink-0 text-blue-400"/><span className="min-w-0 truncate text-xs font-medium" title={title}>{title}</span><span className="markdown-scope rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400">{scopeLabel}</span></div>
      <div className="flex shrink-0 items-center gap-0.5">
        <div role="group" aria-label="Markdown view" className="flex rounded-lg border border-neutral-700 bg-neutral-950 p-0.5">{([{mode:'source',label:'Source',icon:Code2},{mode:'preview',label:'Preview',icon:Eye},{mode:'split',label:'Split',icon:Columns2}] as const).map(item=><button key={item.mode} type="button" aria-label={`Markdown ${item.mode} view`} aria-pressed={settings.mode===item.mode} title={`${item.label} view`} onClick={()=>updateSettings({mode:item.mode})} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${settings.mode===item.mode?'bg-neutral-800 text-white':'text-neutral-400 hover:text-white'}`}><item.icon aria-hidden className="h-3.5 w-3.5"/><span className="markdown-view-label">{item.label}</span></button>)}</div>
        <button type="button" aria-label="Markdown outline" aria-pressed={outline} title="Heading outline" className="note-tool" onClick={()=>setOutline(!outline)}><ListTree className="h-4 w-4"/></button>
        <button type="button" aria-label="Find in Markdown" title="Find and replace · Ctrl/Cmd+F" className="note-tool" onClick={()=>setFindOpen(!findOpen)}><Search className="h-4 w-4"/></button>
        <details ref={options} className="markdown-options"><summary ref={optionsTrigger} aria-label="Markdown options" title="Markdown options" className="note-tool list-none cursor-pointer"><MoreHorizontal className="h-4 w-4"/></summary><div aria-label="Markdown options panel" className="markdown-settings absolute right-0 top-full z-30 mt-1 w-72 space-y-3 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-xl">
          <div className="flex items-center justify-between"><h3 className="font-medium">Markdown options</h3><button type="button" aria-label="Close Markdown options" className="note-tool" onClick={closeOptions}><X className="h-4 w-4"/></button></div>
          <div className="markdown-file-actions grid grid-cols-2 gap-1 border-b border-neutral-800 pb-3">
        <button type="button" aria-label="Copy Markdown source" disabled={busy} title="Copy Markdown source" className="note-tool" onClick={()=>{closeOptions();void copy();}}><Copy className="h-4 w-4"/>Copy source</button>
        {onDownload&&<button type="button" aria-label="Download Markdown file" title="Download Markdown" className="note-tool" onClick={()=>{closeOptions();void Promise.resolve().then(onDownload).catch(reason=>setNotice(reason instanceof Error?reason.message:'Download failed.'));}}><Download className="h-4 w-4"/>Download</button>}
        <button type="button" aria-label={fullScreen?'Exit Markdown full screen':'Markdown full screen'} title="Full screen" className="note-tool" onClick={()=>{closeOptions();void toggleFullScreen();}}><Maximize2 className="h-4 w-4"/>{fullScreen?'Exit full screen':'Full screen'}</button>
        {onWriting&&<button type="button" className="note-tool text-xs text-blue-400" onClick={onWriting}>Back to writing</button>}
          </div>
          {hasSource&&<div role="group" aria-label="Markdown formatting" className="flex flex-wrap gap-1 border-b border-neutral-800 pb-3">{formats.map(tool=><button key={tool.format} type="button" aria-label={`Markdown ${tool.label.toLowerCase()}`} title={tool.label} disabled={busy} className="note-tool" onMouseDown={event=>event.preventDefault()} onClick={()=>{format(tool.format);if(options.current)options.current.open=false;}}><tool.icon className="h-3.5 w-3.5"/></button>)}</div>}
          <label className="block">Page theme<select aria-label="Markdown page theme" value={settings.theme} onChange={event=>updateSettings({theme:event.target.value as 'dark'|'paper'})} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1.5"><option value="dark">Charcoal</option><option value="paper">Paper</option></select></label>
          <label className="block">Reading size · {settings.size}px<input aria-label="Markdown reading size" type="range" min={14} max={24} value={settings.size} onChange={event=>updateSettings({size:Number(event.target.value)})} className="mt-1 w-full accent-blue-500"/></label>
          <label className="block">Page width<select aria-label="Markdown page width" value={settings.width} onChange={event=>updateSettings({width:event.target.value as MarkdownWorkspaceSettings['width']})} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1.5"><option value="reading">Comfortable</option><option value="wide">Wide</option><option value="full">Full width</option></select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.wrap} onChange={event=>updateSettings({wrap:event.target.checked})}/>Wrap source lines</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.syncScroll} onChange={event=>updateSettings({syncScroll:event.target.checked})}/>Link source and preview scrolling</label>
          <form noValidate className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();const line=Number(new FormData(event.currentTarget).get('line'));if(Number.isInteger(line)&&line>=1&&line<=lines.length){closeOptions();selectSource(lines[line-1]);}}}><label className="min-w-0 flex-1">Go to line<input aria-label="Markdown go to line" name="line" type="number" min={1} max={lines.length} defaultValue={1} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1.5"/></label><button type="submit" className="note-tool">Go</button></form>
        </div></details>
      </div>
    </header>
    {navigation&&<div className="shrink-0 border-b border-neutral-800">{navigation}</div>}
    {findOpen&&<div role="search" aria-label="Search Markdown source" className="shrink-0 space-y-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2 text-xs"><div className="flex flex-wrap items-center gap-1"><input ref={findInput} type="search" aria-label="Find Markdown text" maxLength={256} placeholder="Find in Markdown…" value={query} onChange={event=>{setQuery(event.target.value);setMatchIndex(0);}} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();jumpMatch(event.shiftKey?-1:0);}}} className="min-w-32 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"/>{query&&<button type="button" aria-label="Clear Markdown search" className="note-tool" onClick={()=>{setQuery('');findInput.current?.focus();}}>Clear</button>}<button type="button" aria-label="Previous Markdown match" disabled={!search.matches.length} className="note-tool" onClick={()=>jumpMatch(-1)}><ArrowUp className="h-3.5 w-3.5"/></button><button type="button" aria-label="Next Markdown match" disabled={!search.matches.length} className="note-tool" onClick={()=>jumpMatch(1)}><ArrowDown className="h-3.5 w-3.5"/></button><span role="status" className="text-neutral-400">{query?search.matches.length?`${activeMatch+1} / ${search.matches.length}${search.truncated?'+':''}`:'No matches':'Search this document or section'}</span><button type="button" aria-label="Close Markdown search" className="note-tool" onClick={()=>{setFindOpen(false);source.current?.focus();}}><X className="h-3.5 w-3.5"/></button></div><div className="flex flex-wrap items-center gap-2"><input aria-label="Markdown replacement" placeholder="Replace with…" maxLength={1000} value={replacement} onChange={event=>setReplacement(event.target.value)} className="min-w-32 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5"/><label className="flex items-center gap-1"><input type="checkbox" checked={matchCase} onChange={event=>{setMatchCase(event.target.checked);setMatchIndex(0);}}/>Match case</label><button type="button" disabled={!search.matches.length||busy} className="note-tool" onClick={()=>replace()}>Replace</button><button type="button" disabled={!search.matches.length||search.truncated||busy} className="note-tool" onClick={()=>replace(true)}>Replace all</button>{undo&&undo.key===documentKey&&<button type="button" disabled={value!==undo.after} className="note-tool text-blue-400" onClick={()=>{onChange(undo.before);setUndo(null);setNotice('Replacement undone.');}}>Undo replace</button>}</div>{search.truncated&&<p className="text-neutral-400">Refine this search to replace more than 1,000 matches.</p>}</div>}
    <div className="markdown-workspace-body relative flex min-h-0 flex-1">
      {outline&&<aside aria-label={`Markdown outline · ${scopeLabel}`} className="markdown-outline absolute inset-y-0 left-0 z-20 w-60 overflow-y-auto border-r border-neutral-700 bg-neutral-900 p-3 shadow-lg"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{scopeLabel} outline</h3><button type="button" className="note-tool" aria-label="Close Markdown outline" onClick={()=>{setOutline(false);root.current?.querySelector<HTMLButtonElement>('[aria-label="Markdown outline"]')?.focus();}}><X className="h-3.5 w-3.5"/></button></div>{!headings.length?<p className="text-xs text-neutral-400">No headings in this {scopeLabel==='Document'?'document':'section'}.</p>:<nav aria-label="Markdown headings" className="space-y-1">{headings.slice(0,200).map((heading,index)=><button key={heading.id} type="button" className="block w-full truncate rounded py-1.5 pr-2 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white" style={{paddingLeft:Math.min(heading.level-1,3)*10+4}} title={heading.text} onClick={()=>jumpHeading(index)}>{heading.text}</button>)}</nav>}{headings.length>200&&<p className="mt-3 text-xs text-neutral-400">First 200 headings shown. Use Find for more.</p>}</aside>}
      <div className={`markdown-panes flex min-h-0 min-w-0 flex-1 ${settings.mode==='split'?'markdown-panes-split':''}`}>
        {hasSource&&<section aria-label="Markdown source pane" className="markdown-source-pane flex min-h-0 min-w-0 flex-1 flex-col bg-[#141416]"><div className="relative min-h-0 flex-1 overflow-hidden">{!settings.wrap&&<div aria-hidden data-markdown-line-numbers className="pointer-events-none absolute bottom-0 left-0 top-0 w-12 overflow-hidden border-r border-neutral-800 bg-neutral-900/50 font-mono text-[11px] text-neutral-400">{Array.from({length:Math.max(0,visibleEnd-visibleStart)},(_,index)=>{const line=visibleStart+index;return <span key={line} className="absolute left-0 right-2 text-right" style={{top:16+line*LINE_HEIGHT-sourceScroll.top,lineHeight:`${LINE_HEIGHT}px`}}>{line+1}</span>;})}</div>}<textarea ref={source} aria-label={sourceLabel} value={value} disabled={busy} wrap={settings.wrap?'soft':'off'} spellCheck={false} className="h-full min-h-0 w-full resize-none overflow-auto bg-transparent p-4 text-[13px] text-neutral-200 outline-none selection:bg-blue-500/30 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500" style={{fontFamily:'var(--font-fira), monospace',lineHeight:`${LINE_HEIGHT}px`,tabSize:2,paddingLeft:settings.wrap?16:60}} onChange={event=>{if(event.target.value.length>maxLength){setNotice('This section is full. Put additional content in another section or file.');return;}onChange(event.target.value);setCursor(event.target.selectionStart);}} onSelect={event=>setCursor(event.currentTarget.selectionStart)} onScroll={event=>{setSourceScroll({top:event.currentTarget.scrollTop,height:event.currentTarget.clientHeight||400});sync('source');}} onKeyDown={event=>{
          if(event.nativeEvent.isComposing)return;const input=event.currentTarget,mod=event.metaKey||event.ctrlKey;
          if(mod&&['b','i'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();format(event.key.toLowerCase()==='b'?'bold':'italic');}
          else if(event.key==='Tab'&&!mod&&!event.altKey){event.preventDefault();apply(indentNotes(value,input.selectionStart,input.selectionEnd,event.shiftKey));}
          else if(event.key==='Enter'&&!event.shiftKey&&!mod&&!event.altKey){const edit=continueNoteList(value,input.selectionStart,input.selectionEnd);if(edit){event.preventDefault();apply(edit);}}
        }}/></div></section>}
        {hasPreview&&<section aria-label="Markdown preview pane" data-theme={settings.theme} className="markdown-reader flex min-h-0 min-w-0 flex-1 flex-col"><div ref={preview} aria-label="Rendered Markdown" tabIndex={0} onScroll={()=>sync('preview')} className="markdown-preview-scroll min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500">{busy||!previewCurrent?<p role="status" className="p-6 text-sm">Preparing preview…</p>:<MarkdownPreviewBoundary resetKey={snapshot.text} onSource={()=>updateSettings({mode:"source"})}><React.Suspense fallback={<p role="status" className="p-6 text-sm">Preparing preview…</p>}><Preview value={snapshot.text} enhanced headingPrefix={headingPrefix} highlight={!lightweight&&snapshot.text.length<32000} onOutline={setPreviewHeadings} onNotice={setNotice} query={findOpen?query:''} matchCase={matchCase} appearanceOverride={appearance}/></React.Suspense></MarkdownPreviewBoundary>}</div></section>}
      </div>
    </div>
    <footer className={`markdown-workspace-footer ${footerActions?'markdown-has-footer-actions':''} flex h-7 shrink-0 items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-900 px-3 py-1 text-[10px] text-neutral-400`}><div className="flex min-w-0 items-center gap-2">{footerActions}<span role="status" className={`truncate ${notice?'text-blue-300':''}`} title={notice||status}>{notice||status}</span></div><div className="markdown-document-stats flex shrink-0 items-center gap-3">{hasSource&&<span>Ln {location.line}, Col {location.column}</span>}<span className="markdown-extra-stat">{lines.length.toLocaleString()} lines</span><span>{words.toLocaleString()} words</span><span className="markdown-extra-stat">{words?Math.max(1,Math.ceil(words/220)):0} min read</span><span role="status" className="markdown-extra-stat">{hasPreview&&(busy||!previewCurrent?'Preparing preview…':snapshot.text!==value?'Preview updating…':'Live preview')}</span></div></footer>
  </div>;
}
