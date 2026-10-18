'use client';
import type { FillStyle } from '@/draw/types';
import { backgroundFillCss } from '@/draw/backgroundFill';

export type BackgroundPattern = 'solid' | 'hachure' | 'crosshatch' | 'dots';
const patterns: [BackgroundPattern, string][] = [['solid', 'Solid'], ['hachure', 'Hatch'], ['crosshatch', 'Crosshatch'], ['dots', 'Dots']];

export function BackgroundStylePicker({ value, onChange, label = 'Background style' }: { value: FillStyle; onChange: (value: BackgroundPattern) => void; label?: string }) {
  return <div role="group" aria-label={label} className="grid grid-cols-2 gap-1">
    {patterns.map(([id, name]) => <button type="button" key={id} aria-label={`${label}: ${name}`} aria-pressed={value === id} onClick={() => onChange(id)} className={`flex min-h-8 items-center gap-2 rounded-md border px-2 py-1 text-[11px] ${value === id ? 'border-blue-500/60 bg-blue-500/10 text-blue-200' : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'}`}>
      <span aria-hidden="true" className="h-4 w-6 shrink-0 rounded-sm" style={backgroundFillCss({ fill: '#92989e', fillStyle: id })} />{name}
    </button>)}
  </div>;
}
