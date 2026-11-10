'use client';
import { isLightBackground } from '@/lib/background.mjs';
import { cardBackground } from '@/draw/cardAppearance';
import { backgroundFillCss, type BackgroundFill } from '@/draw/backgroundFill';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CODE_COLORS, codeTokenColor } from '@/lib/codePalette';
import { X, Copy } from 'lucide-react';
import { highlightCode } from '@/lib/code';
export function HighlightedCode({ code, language = 'auto', light = false }: { code: string; language?: string; light?: boolean }) {
  const result = useMemo(() => highlightCode(code, language), [code, language]);
  const html = useMemo(() => result.html.replace(/<span class="([^"]*)">/g, (tag, classes: string) => {
    const color = codeTokenColor(classes, light);
    return color ? `<span class="${classes}" style="color:${color}">` : tag;
  }), [result, light]);
  return <code className="hljs" style={{color:light?CODE_COLORS.light.text:CODE_COLORS.dark.text}} dangerouslySetInnerHTML={{ __html: html }} />;
}
export function CodeEditor({ value, language, onChange, onClose, x, y, width, height, zoom, fontSize, background }: { value: string; language: string; onChange: (code: string, language: string) => void; onClose: () => void; x: number; y: number; width: number; height: number; zoom: number; fontSize: number; background?: BackgroundFill }) {
  const surface = cardBackground({...background || {fill:'#10151e',fillStyle:'solid' as const},isCodeCard:true});
  const light = isLightBackground({...surface,fillStyle:'solid',fillOpacity:surface.fillOpacity ?? 1});
  const input = useRef<HTMLTextAreaElement>(null), preview = useRef<HTMLPreElement>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { const frame = requestAnimationFrame(() => input.current?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const replace = (text: string, start: number, end: number) => { onChange(value.slice(0, start) + text + value.slice(end), language); requestAnimationFrame(() => input.current?.setSelectionRange(start + text.length, start + text.length)); };
  return <div aria-label="Inline code editor" data-light={light} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) onClose(); }} style={{ position: 'absolute', left: x, top: y, width: width + 32, minHeight: height + 32, transform: `scale(${zoom})`, transformOrigin: 'top left', zIndex: 35, padding: 15, ...backgroundFillCss(surface), border: light ? '1px solid #d4d4d8' : '1px solid #334155', borderRadius: 10 }}>
    <div role="group" aria-label="Code actions" style={y < 32 * zoom ? {bottom:-32} : {top:-32}} className="absolute right-0 flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-1 text-neutral-400"><button type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" title="Copy code" aria-label="Copy code" onMouseDown={e => e.preventDefault()} onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice('Copied'); } catch { setNotice('Select and copy the code'); } }}><Copy className="h-3 w-3" /></button><button type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" aria-label="Finish editing code" title="Finish · Escape or Ctrl/Cmd+Enter" onClick={onClose}><X className="h-3 w-3" /></button></div>
    <div className="code-source relative overflow-hidden font-mono" style={{ height: Math.max(60, height), maxHeight: `calc(70dvh / ${zoom})`, fontSize, lineHeight: 1.5, tabSize: 2, fontVariantLigatures: 'none', letterSpacing: 0 }}>
      <pre ref={preview} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-0 font-mono" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}><HighlightedCode code={value} language={language} light={light} /></pre>
      <textarea ref={input} aria-label="Code source" placeholder="Write your code here…" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={value} maxLength={100000} onChange={e => onChange(e.target.value, language)} onScroll={e => { if (preview.current) { preview.current.scrollTop = e.currentTarget.scrollTop; preview.current.scrollLeft = e.currentTarget.scrollLeft; } }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onClose(); return; } if (e.key === 'Tab') { e.preventDefault(); replace('  ', e.currentTarget.selectionStart, e.currentTarget.selectionEnd); } if (e.key === 'Enter') { e.preventDefault(); const start = e.currentTarget.selectionStart; const line = value.slice(value.lastIndexOf('\n', start - 1) + 1, start); replace('\n' + (line.match(/^\s*/)?.[0] || '') + (/[{[(]\s*$/.test(line) ? '  ' : ''), start, e.currentTarget.selectionEnd); } }} wrap="off" className="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent p-0 font-mono text-transparent caret-white placeholder:text-slate-500 outline-none selection:bg-blue-500/30" style={{ fontSize: 'inherit', lineHeight: 'inherit', tabSize: 2, caretColor:light?CODE_COLORS.light.text:CODE_COLORS.dark.text }} />
    </div>{notice && <p role="status" className="text-[10px] text-slate-400">{notice}</p>}
  </div>;
}
