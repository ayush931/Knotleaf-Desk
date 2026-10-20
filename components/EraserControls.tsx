"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

export type EraserMode = "all" | "drawings" | "objects";

export function EraserControls({ size, mode, top, onChange }: { size:number; mode:EraserMode; top:number; onChange:(size:number,mode:EraserMode)=>void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const apply = (value:number) => {
    if (!Number.isFinite(value) || value<=0) { setError("Enter a size greater than zero."); return; }
    setError("");
    if (input.current) input.current.value=String(value);
    onChange(value,mode);
  };
  return <div role="group" aria-label="Eraser options" style={{top}} className="absolute left-1/2 z-30 w-[min(340px,calc(100%-24px))] -translate-x-1/2 max-sm:left-14 max-sm:right-3 max-sm:w-auto max-sm:translate-x-0 rounded-xl border border-neutral-700 bg-[#18181b] p-2 text-xs text-neutral-300 shadow-sm">
    <div className="flex items-center gap-2">
      <label htmlFor="eraser-size" className="shrink-0">Size</label>
      <button type="button" aria-label="Decrease eraser size" className="note-tool" onClick={()=>apply(size/1.25)}><Minus className="h-3.5 w-3.5"/></button>
      <input ref={input} id="eraser-size" aria-describedby={error?"eraser-error":"eraser-help"} aria-invalid={!!error} type="number" min="0" step="any" defaultValue={size} className="min-w-0 w-16 rounded border border-neutral-600 bg-neutral-950 p-1 text-white" onBlur={e=>apply(e.target.valueAsNumber)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();apply(e.currentTarget.valueAsNumber);}}}/>
      <span>px</span>
      <button type="button" aria-label="Increase eraser size" className="note-tool" onClick={()=>apply(size*1.25)}><Plus className="h-3.5 w-3.5"/></button>
      <select aria-label="Erase" value={mode} onChange={e=>onChange(size,e.target.value as EraserMode)} className="min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-950 p-1 text-white"><option value="all">All elements</option><option value="drawings">Lines & freehand</option><option value="objects">Shapes & cards</option></select>
    </div>
    {error?<p id="eraser-error" role="alert" className="mt-1 text-blue-300">{error}</p>:<p id="eraser-help" className="mt-1 text-[10px] text-neutral-400">Removes touched elements. Undo restores them.</p>}
  </div>;
}
