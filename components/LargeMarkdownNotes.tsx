"use client";
import React, { useEffect, useRef, useState } from 'react';
import { MarkdownWorkspace } from './MarkdownWorkspace';
import type { MarkdownView } from '@/lib/markdownWorkspace';
import { getMarkdownFile, readMarkdownSection, saveMarkdownPage, type MarkdownFileInfo } from '@/lib/markdownFiles';

export function LargeMarkdownNotes({ fileId, onDownload, initialView, viewToken }: { fileId: string; onDownload: () => void | Promise<void>; initialView?: MarkdownView; viewToken?:number }) {
  const [info,setInfo]=useState<MarkdownFileInfo>(), [page,setPage]=useState(0), [text,setText]=useState('');
  const [busy,setBusy]=useState(true), [status,setStatus]=useState('Loading section…'), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const draft=useRef<{page:number;text:string;dirty:boolean}>({page:0,text:'',dirty:false});
  const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined), saving=useRef<Promise<void>>(Promise.resolve());
  const mounted=useRef(true), sequence=useRef(0), pendingSaves=useRef(0), revisions=useRef(new Map<number,number>());
  const flush=async()=>{
    clearTimeout(timer.current);
    const current=draft.current;
    if(!current.dirty) return saving.current;
    const version=++sequence.current, snapshot={...current};
    current.dirty=false;
    if(mounted.current)setStatus('Saving section…');
    pendingSaves.current++;
    const job=saving.current.catch(()=>undefined).then(()=>saveMarkdownPage(fileId,snapshot.page,snapshot.text,revisions.current.get(snapshot.page))).then(revision=>{revisions.current.set(snapshot.page,revision);});
    saving.current=job;
    try { await job; if(mounted.current&&version===sequence.current&&!draft.current.dirty&&draft.current.text===snapshot.text){setStatus('Saved on this device');setError('');} }
    catch(reason) { if(draft.current.page===snapshot.page&&draft.current.text===snapshot.text)draft.current.dirty=true; if(mounted.current)setError(reason instanceof Error?reason.message:'Could not save. Download this section before leaving.'); throw reason; } finally { pendingSaves.current--; }
  };
  const flushRef=useRef(flush);
  useEffect(()=>{flushRef.current=flush;});
  useEffect(()=>{
    mounted.current=true;
    const warn=(event:BeforeUnloadEvent)=>{if(draft.current.dirty||pendingSaves.current){event.preventDefault();event.returnValue='';}};
    const hide=()=>{if(document.visibilityState==='hidden')void flushRef.current().catch(()=>undefined);};
    window.addEventListener('beforeunload',warn); document.addEventListener('visibilitychange',hide);
    return()=>{mounted.current=false;clearTimeout(timer.current);void flushRef.current().catch(()=>undefined);window.removeEventListener('beforeunload',warn);document.removeEventListener('visibilitychange',hide);};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      const metadata=await getMarkdownFile(fileId);
      if(!metadata)throw new Error('This uploaded file was deleted or expired. Import it again to reopen it.');
      const section=await readMarkdownSection(fileId,page,controller.signal);
      const content=section.text;revisions.current.set(page,section.revision);
      if(controller.signal.aborted)return;
      setInfo(metadata);setText(content);draft.current={page,text:content,dirty:false};setStatus('Saved on this device');
    })().catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Could not load this file.');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[fileId,page,retry]);
  const navigate=async(next:number)=>{if(busy||next===page)return;try{await flush();setBusy(true);setError('');setText('');setStatus('Loading section…');setPage(next);}catch{/* Retain the section and recovery action. */}};
  const pages=info?info.offsets.length-1:0;
  const percent=info&&info.size?Math.round((info.offsets[page+1]||0)/info.size*100):100;
  return <MarkdownWorkspace title={info?.name||'Markdown file'} value={text} documentKey={`${fileId}:${page}`} initialView={initialView} viewToken={viewToken} sourceLabel="Large Markdown section" scopeLabel={pages>1?`Section ${page+1} of ${pages}`:'Document'} status={status} busy={busy} lightweight onDownload={()=>flush().then(onDownload)} navigation={<>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 p-3 text-xs">
      <button type="button" className="note-tool" disabled={busy||page===0} onClick={()=>void navigate(page-1)}>Previous section</button>
      <span>{pages?`Section ${page+1} of ${pages} · ${percent}% through file`:'Opening Markdown…'}</span>
      <button type="button" className="note-tool" disabled={busy||page+1>=pages} onClick={()=>void navigate(page+1)}>Next section</button>
      <form noValidate onSubmit={event=>{event.preventDefault();const field=new FormData(event.currentTarget).get('section');const next=Number(field);if(Number.isInteger(next)&&next>=1&&next<=pages)void navigate(next-1);}} className="flex items-center gap-1">
        <label>Section <input name="section" aria-label="Go to Markdown section" type="number" min={1} max={pages||1} defaultValue={1} className="w-20 rounded border border-neutral-700 bg-neutral-950 p-1" /></label><button type="submit" disabled={busy} className="note-tool">Go</button>
      </form>
    </div>
    <p className="shrink-0 px-3 py-2 text-xs text-neutral-400">Preview covers the current section. A Markdown block may continue in another section.</p>
    {error&&<div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-sm text-rose-300"><p>{error}</p><button type="button" className="note-tool" onClick={()=>{const blob=new Blob([text],{type:'text/markdown'});void import('@/lib/markdownFiles').then(module=>module.downloadMarkdownBlob(blob,`section-${page+1}.md`));}}>Download current section</button><button type="button" className="note-tool" onClick={()=>{if(!info){setBusy(true);setError('');setRetry(value=>value+1);}else void flush().catch(()=>undefined);}}>{info?'Retry save':'Retry loading'}</button></div>}
</>} onChange={next=>{setText(next);draft.current={page,text:next,dirty:true};setStatus('Unsaved changes');clearTimeout(timer.current);timer.current=setTimeout(()=>void flushRef.current().catch(()=>undefined),600);}}/>;
}
