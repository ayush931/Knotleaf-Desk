"use client";
import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
/** One bounded row for both uploaded-file and legacy inline-note sections. */
export function MarkdownSectionNavigation({page,pages,disabled=false,progress,onNavigate,help}:{page:number;pages:number;disabled?:boolean;progress?:number;onNavigate:(page:number)=>void;help:string}) {
  const menu=useRef<HTMLDetailsElement>(null),trigger=useRef<HTMLElement>(null);
  const close=()=>{if(menu.current)menu.current.open=false;trigger.current?.focus();};
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(menu.current?.open&&event.target instanceof window.Node&&!menu.current.contains(event.target))menu.current.open=false;};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[]);
  return <nav aria-label="Markdown sections" className="markdown-section-navigation relative flex h-8 shrink-0 items-center justify-center gap-2 px-2 text-xs" onKeyDown={event=>{if(event.key==='Escape'&&menu.current?.open&&!event.nativeEvent.isComposing){event.preventDefault();event.stopPropagation();close();}}}>
    <button type="button" aria-label="Previous section" title="Previous section" disabled={disabled||page===0} className="note-tool" onClick={()=>onNavigate(page-1)}><ChevronLeft className="h-3.5 w-3.5"/><span className="sr-only">Previous section</span></button>
    <details ref={menu}>
      <summary ref={trigger} aria-label="Markdown section navigation options" title="Go to section" className="flex cursor-pointer list-none items-center gap-1 rounded px-2 py-1 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500"><span>{pages?`Section ${page+1} of ${pages}`:'Opening Markdown…'}</span><ChevronDown className="h-3 w-3"/></summary>
      <div className="markdown-section-options absolute left-2 right-2 top-full z-30 mx-auto mt-1 w-72 max-w-[calc(100%-1rem)] space-y-3 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
        <div className="flex items-center justify-between"><span>Go to section</span><button type="button" aria-label="Close section options" className="note-tool" onClick={close}><X className="h-3.5 w-3.5"/></button></div>
        <form noValidate className="flex items-end gap-2" onSubmit={event=>{event.preventDefault();const next=Number(new FormData(event.currentTarget).get('section'));if(!disabled&&Number.isInteger(next)&&next>=1&&next<=pages){onNavigate(next-1);close();}}}>
          <label className="min-w-0 flex-1">Section<input name="section" aria-label="Go to Markdown section" type="number" min={1} max={pages||1} defaultValue={page+1} key={page} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 p-1.5"/></label><button type="submit" disabled={disabled||!pages} className="note-tool">Go</button>
        </form>
        <p className="text-neutral-400">{help}</p>
      </div>
    </details>
    <button type="button" aria-label="Next section" title="Next section" disabled={disabled||page+1>=pages} className="note-tool" onClick={()=>onNavigate(page+1)}><ChevronRight className="h-3.5 w-3.5"/><span className="sr-only">Next section</span></button>
    {progress!==undefined&&<span className="markdown-section-progress text-[10px] text-neutral-400">{progress}%</span>}
  </nav>;
}
