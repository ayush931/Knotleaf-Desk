'use client';
import { cardBackground } from '@/draw/cardAppearance';
import { backgroundFillCss, type BackgroundFill } from '@/draw/backgroundFill';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Copy } from 'lucide-react';
import { CODE_LANGUAGES, highlightCode } from '@/lib/code';
export function HighlightedCode({ code, language = 'auto' }: { code: string; language?: string }) {
  const result = useMemo(() => highlightCode(code, language), [code, language]);
  return <code className="hljs" data-language={result.language} dangerouslySetInnerHTML={{ __html: result.html }} />;
}
export function CodeEditor({ value, language, onChange, onClose, x, y, width, height, zoom, fontSize, background }: { value: string; language: string; onChange: (code: string, language: string) => void; onClose: () => void; x: number; y: number; width: number; height: number; zoom: number; fontSize: number; background?: BackgroundFill }) {
  const input = useRef<HTMLTextAreaElement>(null), preview = useRef<HTMLPreElement>(null);
  const [notice, setNotice] = useState('');
  const detected = useMemo(() => highlightCode(value, language).language, [value, language]);
  useEffect(() => { const frame = requestAnimationFrame(() => input.current?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const replace = (text: string, start: number, end: number) => { onChange(value.slice(0, start) + text + value.slice(end), language); requestAnimationFrame(() => input.current?.setSelectionRange(start + text.length, start + text.length)); };
  return <div aria-label="Inline code editor" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) onClose(); }} style={{ position: 'absolute', left: x, top: y, width: width + 32, minHeight: height + 32, transform: `scale(${zoom})`, transformOrigin: 'top left', zIndex: 35, padding: 15, ...backgroundFillCss(cardBackground({...background || {fill:'#10151e',fillStyle:'solid' as const},isCodeCard:true})), border: '1px solid #334155', borderRadius: 10 }}>
    <div className="flex h-7 items-start gap-2 text-[11px] text-slate-400"><select aria-label="Code language" value={language} onChange={e => onChange(value, e.target.value)} className="mr-auto max-w-40 bg-transparent text-[11px]">{CODE_LANGUAGES.map(l => <option key={l} value={l} className="bg-neutral-900">{l === 'auto' ? `Auto · ${detected}` : l}</option>)}</select><button title="Copy code" aria-label="Copy code" onMouseDown={e => e.preventDefault()} onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice('Copied'); } catch { setNotice('Select and copy the code'); } }}><Copy className="h-3 w-3" /></button><button aria-label="Finish editing code" title="Finish · Escape or Ctrl/Cmd+Enter" onClick={onClose}><X className="h-3 w-3" /></button></div>
    <div className="code-source relative overflow-hidden font-mono" style={{ height: Math.max(60, height - 28), maxHeight: `calc(70dvh / ${zoom})`, fontSize, lineHeight: 1.5, tabSize: 2, fontVariantLigatures: 'none', letterSpacing: 0 }}>
      <pre ref={preview} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-0 font-mono" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}><HighlightedCode code={value} language={language} /></pre>
      <textarea ref={input} aria-label="Code source" placeholder="Write your code here…" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={value} maxLength={100000} onChange={e => onChange(e.target.value, language)} onScroll={e => { if (preview.current) { preview.current.scrollTop = e.currentTarget.scrollTop; preview.current.scrollLeft = e.currentTarget.scrollLeft; } }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onClose(); return; } if (e.key === 'Tab') { e.preventDefault(); replace('  ', e.currentTarget.selectionStart, e.currentTarget.selectionEnd); } if (e.key === 'Enter') { e.preventDefault(); const start = e.currentTarget.selectionStart; const line = value.slice(value.lastIndexOf('\n', start - 1) + 1, start); replace('\n' + (line.match(/^\s*/)?.[0] || '') + (/[{[(]\s*$/.test(line) ? '  ' : ''), start, e.currentTarget.selectionEnd); } }} wrap="off" className="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent p-0 font-mono text-transparent caret-white placeholder:text-slate-500 outline-none selection:bg-blue-500/30" style={{ fontSize: 'inherit', lineHeight: 'inherit', tabSize: 2 }} />
    </div>{notice && <p role="status" className="text-[10px] text-slate-400">{notice}</p>}
  </div>;
}
