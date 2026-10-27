"use client";
import React, { useEffect, useRef, useState } from 'react';
import { getMarkdownFile, readMarkdownSection, saveMarkdownPage, type MarkdownFileInfo } from '@/lib/markdownFiles';
const Preview = React.lazy(() => import('./NotePreview').then(module => ({ default: module.NotePreview })));

export function LargeMarkdownNotes({ fileId, onDownload }: { fileId: string; onDownload: () => void | Promise<void> }) {
  const [info,setInfo]=useState<MarkdownFileInfo>(), [page,setPage]=useState(0), [text,setText]=useState('');
  const [preview,setPreview]=useState(false), [busy,setBusy]=useState(true), [status,setStatus]=useState('Loading section…'), [error,setError]=useState(''), [retry,setRetry]=useState(0);
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
  const navigate=async(next:number)=>{if(busy||next===page)return;try{await flush();setBusy(true);setError('');setText('');setPreview(false);setStatus('Loading section…');setPage(next);}catch{/* Retain the section and recovery action. */}};
  const pages=info?info.offsets.length-1:0;
  const percent=info&&info.size?Math.round((info.offsets[page+1]||0)/info.size*100):100;
  return <div className="flex h-full min-h-0 flex-col bg-[#18181b] text-neutral-200">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 p-3 text-xs">
      <button type="button" className="note-tool" disabled={busy||page===0} onClick={()=>void navigate(page-1)}>Previous section</button>
      <span>{pages?`Section ${page+1} of ${pages} · ${percent}% through file`:'Opening Markdown…'}</span>
      <button type="button" className="note-tool" disabled={busy||page+1>=pages} onClick={()=>void navigate(page+1)}>Next section</button>
      <form noValidate onSubmit={event=>{event.preventDefault();const field=new FormData(event.currentTarget).get('section');const next=Number(field);if(Number.isInteger(next)&&next>=1&&next<=pages)void navigate(next-1);}} className="flex items-center gap-1">
        <label>Section <input name="section" aria-label="Go to Markdown section" type="number" min={1} max={pages||1} defaultValue={1} className="w-20 rounded border border-neutral-700 bg-neutral-950 p-1" /></label><button type="submit" disabled={busy} className="note-tool">Go</button>
      </form>
      <button type="button" className="note-tool" aria-pressed={preview} disabled={busy} onClick={()=>setPreview(!preview)}>{preview?'Edit source':'Preview section'}</button>
      <button type="button" className="note-tool text-blue-400" onClick={()=>void flush().then(onDownload).catch(reason=>setError(reason instanceof Error?reason.message:'Download failed.'))}>Download Markdown</button>
      <span role="status" className="text-neutral-400">{status}</span>
    </div>
    <p className="shrink-0 px-3 py-2 text-xs text-neutral-400">Large-file mode loads one section at a time. Edits save locally; section previews may start inside a Markdown block. Uploads expire after 7 days without use unless kept in Uploaded Markdown.</p>
    {error&&<div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-sm text-rose-300"><p>{error}</p><button type="button" className="note-tool" onClick={()=>{const blob=new Blob([text],{type:'text/markdown'});void import('@/lib/markdownFiles').then(module=>module.downloadMarkdownBlob(blob,`section-${page+1}.md`));}}>Download current section</button><button type="button" className="note-tool" onClick={()=>{if(!info){setBusy(true);setError('');setRetry(value=>value+1);}else void flush().catch(()=>undefined);}}>{info?'Retry save':'Retry loading'}</button></div>}
    {busy?<div role="status" className="p-4 text-sm text-neutral-400">Loading section…</div>:preview?<div className="min-h-0 flex-1 overflow-y-auto p-4"><React.Suspense fallback={<p role="status">Preparing section preview…</p>}><Preview value={text} highlight={false}/></React.Suspense></div>:<textarea aria-label="Large Markdown section" value={text} disabled={!info||!!error&&!text} spellCheck={false} className="min-h-0 w-full flex-1 resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-6 text-neutral-100 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500" onChange={event=>{const next=event.target.value;if(next.length>128*1024){setError('This section is full. Put additional content into another file.');return;}setText(next);draft.current={page,text:next,dirty:true};setStatus('Unsaved changes');clearTimeout(timer.current);timer.current=setTimeout(()=>void flushRef.current().catch(()=>undefined),600);}}/>}
  </div>;
}
