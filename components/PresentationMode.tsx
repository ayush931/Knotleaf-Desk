'use client';
import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FrameElement, Theme } from '@/draw/types';
interface Props { isActive: boolean; onExit: () => void; title: string; theme: Theme; frames: FrameElement[]; index: number; onIndex: (index: number) => void }
export function PresentationMode(p: Props) {
  const index = Math.max(0, Math.min(p.index, Math.max(0, p.frames.length - 1)));
  useEffect(() => {
    if (!p.isActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.key === 'Escape') { event.preventDefault(); p.onExit(); }
      else if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); p.onIndex(Math.min(index + 1, Math.max(0, p.frames.length - 1))); }
      else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); p.onIndex(Math.max(0, index - 1)); }
      else if (event.key === 'Home') { event.preventDefault(); p.onIndex(0); }
      else if (event.key === 'End') { event.preventDefault(); p.onIndex(Math.max(0, p.frames.length - 1)); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [p, index]);
  if (!p.isActive) return null;
  return <div role="toolbar" aria-label="Presentation controls" className="fixed bottom-4 left-1/2 z-50 flex max-w-[94vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/95 p-2 text-neutral-100 shadow-xl">
    {p.frames.length > 0 && <><button aria-label="Previous slide" title="Previous (Left arrow)" disabled={!index} onClick={() => p.onIndex(index - 1)} className="rounded-lg p-2 hover:bg-neutral-800 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><select aria-label="Presentation frame" value={index} onChange={e => p.onIndex(Number(e.target.value))} className="max-w-[45vw] rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs">{p.frames.map((frame, i) => <option key={frame.id} value={i}>{i + 1}. {frame.title || 'Untitled frame'}</option>)}</select><span role="status" className="whitespace-nowrap text-xs text-neutral-400">{index + 1}/{p.frames.length}</span><button aria-label="Next slide" title="Next (Right arrow)" disabled={index === p.frames.length - 1} onClick={() => p.onIndex(index + 1)} className="rounded-lg p-2 hover:bg-neutral-800 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></>}
    {!p.frames.length && <p className="px-2 text-xs text-neutral-400">{p.title} · Read-only canvas</p>}
    <button aria-label="Exit presentation" title="Exit (Esc)" onClick={p.onExit} className="rounded-lg p-2 hover:bg-neutral-800"><X className="h-4 w-4" /></button>
  </div>;
}
