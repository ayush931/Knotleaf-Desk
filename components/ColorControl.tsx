'use client';
import { useState } from 'react';
export function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value), [previous, setPrevious] = useState(value), [error, setError] = useState(false);
  if (previous !== value) { setPrevious(value); setDraft(value); setError(false); }
  const valid = /^#[\da-f]{6}$/i.test(value) ? value : '#ffffff';
  const commit = () => { if (draft === value) { setError(false); return; } if (/^#[\da-f]{6}$/i.test(draft)) { onChange(draft); setError(false); } else setError(true); };
  const id = `color-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return <div className="space-y-1"><label htmlFor={id} className="text-[10px] text-neutral-400">{label}</label><div className="flex items-center gap-2">
    <input aria-label={`Choose ${label.toLowerCase()}`} type="color" value={valid} onChange={e => { onChange(e.target.value); setDraft(e.target.value); setError(false); }} className="h-7 w-8 cursor-pointer rounded border border-neutral-700 bg-neutral-900" />
    <input id={id} value={draft} onChange={e => { setDraft(e.target.value); setError(false); }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined} spellCheck={false} className="min-w-0 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 focus-visible:outline-2 focus-visible:outline-blue-500" />
  </div>{error && <p id={`${id}-error`} className="text-xs text-rose-400">Use a color such as #3b82f6.</p>}</div>;
}
