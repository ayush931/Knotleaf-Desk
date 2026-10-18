'use client';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { STROKE_SHADES, BACKGROUND_SHADES } from '@/lib/colorPalettes';

export function ColorPalette({ kind, presets, value, onChange }: { kind: 'stroke' | 'background'; presets: readonly string[]; value: string; onChange: (color: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId(), name = kind === 'stroke' ? 'Stroke' : 'Background';
  const shades = kind === 'stroke' ? STROKE_SHADES : BACKGROUND_SHADES;
  const swatch = (color: string) => <button type="button" key={color} aria-label={`${kind === 'stroke' ? 'Color' : 'Background'} ${color}`} title={color} aria-pressed={value.toLowerCase() === color.toLowerCase()} onClick={() => onChange(color)} style={{ backgroundColor: color }} className={`h-6 w-6 shrink-0 rounded-md border border-neutral-600 transition-colors hover:border-neutral-300 ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-neutral-900' : ''}`} />;
  return <div className="space-y-2">
    <div role="group" aria-label={`${name} colors`} className="flex flex-wrap gap-1.5">{presets.map(swatch)}</div>
    <button type="button" aria-label={`More ${kind} colors`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(open => !open)} className="flex min-h-7 items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200">{expanded ? 'Fewer colors' : 'More colors'}<ChevronDown aria-hidden="true" className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
    {expanded && <div id={id} role="group" aria-label={`${name} color shades`} className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-950/40 p-2"><p className="text-[10px] text-neutral-500">50 {kind === 'stroke' ? 'drawing' : 'background'} shades</p><div className="grid grid-cols-8 gap-1">{shades.map(swatch)}</div></div>}
  </div>;
}
