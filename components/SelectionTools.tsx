"use client";
import type { CanvasElement } from '@/draw/types';
import { arrangementTargets, type Arrangement } from '@/draw/arrangement';
const actions: [Arrangement, string][] = [['left','Align left'],['center','Align center'],['right','Align right'],['top','Align top'],['middle','Align middle'],['bottom','Align bottom'],['horizontal','Space horizontally'],['vertical','Space vertically']];
export function SelectionTools({ selection, onArrange, onConnect, onUndo, onRedo }: { selection: CanvasElement[]; onArrange: (mode: Arrangement) => void; onConnect: () => void; onUndo?: () => void; onRedo?: () => void }) {
  const count = arrangementTargets(selection).length;
  const connectable = selection.filter(el => !['arrow','line','pencil','frame'].includes(el.type)).length;
  return <div onKeyDown={event => {
    if (event.nativeEvent.isComposing || !(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    const action = key === 'z' ? (event.shiftKey ? onRedo : onUndo) : key === 'y' ? onRedo : undefined;
    if (action) { event.preventDefault(); event.stopPropagation(); action(); }
  }} role="toolbar" aria-label="Arrange selection" className="absolute bottom-16 left-2 z-30 w-[min(580px,calc(100%-1rem))] max-h-[50%] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-xs text-neutral-700 dark:text-neutral-300 shadow-sm">
    <div className="mb-1 flex items-center justify-between gap-2"><span className="px-1 text-neutral-500 dark:text-neutral-400">Arrange · {count} objects</span><button type="button" disabled={connectable < 2} onClick={onConnect} className="rounded px-2 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40">Connect selected</button></div>
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{actions.map(([mode,label]) => <button type="button" key={mode} disabled={count < (mode === 'horizontal' || mode === 'vertical' ? 3 : 2)} onClick={() => onArrange(mode)} className="rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40">{label}</button>)}</div>
  </div>;
}
