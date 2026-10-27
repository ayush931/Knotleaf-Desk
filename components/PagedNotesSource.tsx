"use client";
import { MarkdownSectionNavigation } from './MarkdownSectionNavigation';
import { MarkdownWorkspace } from './MarkdownWorkspace';
import type { MarkdownView } from '@/lib/markdownWorkspace';
import { useEffect, useRef, useState } from 'react';
const SECTION=64*1024;
/** Existing oversized inline notes avoid mounting a rich-document tree or syntax mirror. */
export function PagedNotesSource({value,onChange,onExportMarkdown,title,saveStatus}:{value:string;onChange:(value:string)=>void;onExportMarkdown:()=>void;initialView?:MarkdownView;title?:string;saveStatus?:string}) {
  const [page,setPage]=useState(0),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};const protect=(event:MouseEvent)=>{if(event.target instanceof HTMLElement&&!root.current?.contains(event.target)){event.preventDefault();event.stopPropagation();setError('Save or discard this section before leaving.');}};window.addEventListener('beforeunload',warn);document.addEventListener('click',protect,true);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',protect,true);};},[dirty]);
  const pages=Math.max(1,Math.ceil(value.length/SECTION)),index=Math.min(page,pages-1),start=index*SECTION;
  const navigation=<><MarkdownSectionNavigation page={index} pages={pages} disabled={dirty} onNavigate={setPage} help="Preview covers one section at a time. Save or discard changes before changing sections."/>{error&&<p role="alert" className="px-3 text-rose-300">{error}</p>}</>;
  return <div ref={root} className="flex h-full min-h-0 flex-col bg-neutral-900 text-neutral-200"><Section key={`${index}:${value.length}`} text={value.slice(start,start+SECTION)} title={title} navigation={navigation} onDownload={onExportMarkdown} saveStatus={saveStatus} scopeLabel={`Section ${index+1} of ${pages}`} onDirty={setDirty} onError={setError} onSave={text=>{setError('');try{onChange(value.slice(0,start)+text+value.slice(start+SECTION));setDirty(false);}catch(reason){setError(reason instanceof Error?reason.message:'Could not save this section.');}}}/></div>;
}
function Section({text,onSave,onDirty,onError,initialView,title,scopeLabel,saveStatus,navigation,onDownload}:{text:string;onSave:(text:string)=>void;onDirty:(dirty:boolean)=>void;onError:(message:string)=>void;initialView?:MarkdownView;title?:string;scopeLabel:string;saveStatus?:string;navigation:React.ReactNode;onDownload:()=>void}) {
  const [draft,setDraft]=useState(text),[previous,setPrevious]=useState(text);
  if(previous!==text){setPrevious(text);if(draft===previous)setDraft(text);}
  return <MarkdownWorkspace navigation={navigation} onDownload={onDownload} value={draft} initialView={initialView} title={title} scopeLabel={scopeLabel} lightweight sourceLabel="Large notes source section" status={draft===text?saveStatus||'Markdown':'Unsaved section changes'} onChange={next=>{onError('');setDraft(next);onDirty(next!==text);}} footerActions={<><button type="button" disabled={draft===text} className="note-tool text-blue-400" onClick={()=>onSave(draft)}>Save section</button><button type="button" disabled={draft===text} className="note-tool" onClick={()=>{setDraft(text);onDirty(false);}}>Discard section changes</button></>}/>;

}
