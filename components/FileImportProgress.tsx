"use client";
import { createPortal } from 'react-dom';
import type { FileProgress } from '@/lib/markdownFiles';
export interface ImportNotice extends FileProgress { name: string; state: 'busy'|'success'|'error'|'cancelled' }
export function FileImportProgress({notice,onCancel,onDismiss}:{notice:ImportNotice|null;onCancel:()=>void;onDismiss:()=>void}) {
  if(!notice||typeof document==='undefined')return null;
  return createPortal(<div role={notice.state==='error'?'alert':'status'} aria-live={notice.state==='error'?'assertive':'polite'} className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-100 shadow-xl">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{notice.name}</p><p className="mt-1 text-xs text-neutral-300">{notice.phase}{notice.percent!==undefined?` · ${notice.percent}%`:''}</p></div>{notice.state==='busy'?<button type="button" className="note-tool shrink-0 text-blue-400" onClick={onCancel}>Cancel import</button>:<button type="button" aria-label="Dismiss import message" className="note-tool shrink-0" onClick={onDismiss}>Close</button>}</div>
    {notice.state==='busy'&&<progress aria-label={notice.phase} max={100} value={notice.percent} className="mt-3 h-2 w-full accent-blue-500"/>}
  </div>,document.body);
}
