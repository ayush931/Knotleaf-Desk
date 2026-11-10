'use client';
import { isLightBackground } from '@/lib/background.mjs';
import { cardBackground, CODE_CARD_FILL, MIN_CODE_HEIGHT } from '@/draw/cardAppearance';
import { backgroundFillCss, type BackgroundFill } from '@/draw/backgroundFill';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CODE_FONT_WEIGHT, CODE_LINE_HEIGHT, type CodeViewState } from '@/draw/codeLayout';
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
export function CodeEditor({ value, language, onChange, onClose, x, y, width, height, zoom, fontSize, background, initialView, onViewChange }: { value: string; language: string; onChange: (code: string, language: string) => void; onClose: () => void; x: number; y: number; width: number; height: number; zoom: number; fontSize: number; background?: BackgroundFill; initialView?: CodeViewState; onViewChange?: (view: CodeViewState) => void }) {
  const surface = cardBackground({...background || {fill:CODE_CARD_FILL,fillStyle:'solid' as const},isCodeCard:true});
  const light = isLightBackground({...surface,fillStyle:'solid',fillOpacity:surface.fillOpacity ?? 1});
  const input = useRef<HTMLTextAreaElement>(null), preview = useRef<HTMLPreElement>(null);
  const [notice, setNotice] = useState('');
  const initial = useRef(initialView);
  const syncPreview = useCallback(() => {
    const element=input.current, layer=preview.current;if(!element||!layer)return;
    // Match the input's usable viewport, excluding native scrollbar gutters.
    if(element.clientWidth>0)layer.style.width=`${element.clientWidth}px`;
    if(element.clientHeight>0)layer.style.height=`${element.clientHeight}px`;
    layer.scrollLeft=element.scrollLeft;layer.scrollTop=element.scrollTop;
  }, []);
  const publishView = () => { const element=input.current;if(element)onViewChange?.({scrollLeft:element.scrollLeft,scrollTop:element.scrollTop,selectionStart:element.selectionStart,selectionEnd:element.selectionEnd}); };
  useLayoutEffect(() => {
    const element=input.current;if(!element)return;
    const view=initial.current;
    element.setSelectionRange(view?.selectionStart || 0,view?.selectionEnd || 0);
    element.focus({preventScroll:true});
    element.scrollLeft=view?.scrollLeft || 0;element.scrollTop=view?.scrollTop || 0;
    if(preview.current){preview.current.scrollLeft=element.scrollLeft;preview.current.scrollTop=element.scrollTop;}
  }, []);
  useLayoutEffect(() => {
    syncPreview();document.fonts?.addEventListener("loadingdone",syncPreview);
    return()=>document.fonts?.removeEventListener("loadingdone",syncPreview);
  }, [syncPreview,value,width,height,fontSize,zoom]);
  const replace = (text: string, start: number, end: number) => { onChange(value.slice(0, start) + text + value.slice(end), language); requestAnimationFrame(() => input.current?.setSelectionRange(start + text.length, start + text.length)); };
  return <div aria-label="Inline code editor" data-light={light} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { publishView(); onClose(); } }} style={{ position: 'absolute', left: x, top: y, width: width + 32, minHeight: height + 32, transform: `scale(${zoom})`, transformOrigin: 'top left', zIndex: 35, padding: 15, ...backgroundFillCss(surface), border: light ? '1px solid #d4d4d8' : '1px solid #334155', borderRadius: 10 }}>
    <div role="group" aria-label="Code actions" style={y < 32 * zoom ? {bottom:-32} : {top:-32}} className="absolute right-0 flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-1 text-neutral-400"><button type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" title="Copy code" aria-label="Copy code" onMouseDown={e => e.preventDefault()} onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice('Copied'); } catch { setNotice('Select and copy the code'); } }}><Copy className="h-3 w-3" /></button><button type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" aria-label="Finish editing code" title="Finish · Escape or Ctrl/Cmd+Enter" onClick={()=>{publishView();onClose();}}><X className="h-3 w-3" /></button></div>
    <div className="code-source relative overflow-hidden font-mono" style={{ height: Math.max(MIN_CODE_HEIGHT, height), fontSize, lineHeight: CODE_LINE_HEIGHT, fontWeight:CODE_FONT_WEIGHT, fontKerning:"none", tabSize: 2, fontVariantLigatures: 'none', letterSpacing: 0 }}>
      <pre ref={preview} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-0 font-mono" style={{ fontSize: 'inherit', lineHeight: 'inherit' }}><HighlightedCode code={value} language={language} light={light} /></pre>
      <textarea ref={input} aria-label="Code source" placeholder="Write your code here…" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={value} maxLength={100000} onChange={e => onChange(e.target.value, language)} onSelect={publishView} onScroll={() => { publishView(); syncPreview(); }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); publishView(); onClose(); return; } if (e.key === 'Tab') { e.preventDefault(); replace('  ', e.currentTarget.selectionStart, e.currentTarget.selectionEnd); } if (e.key === 'Enter') { e.preventDefault(); const start = e.currentTarget.selectionStart; const line = value.slice(value.lastIndexOf('\n', start - 1) + 1, start); replace('\n' + (line.match(/^\s*/)?.[0] || '') + (/[{[(]\s*$/.test(line) ? '  ' : ''), start, e.currentTarget.selectionEnd); } }} wrap="off" className="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent p-0 font-mono text-transparent caret-white placeholder:text-neutral-500 outline-none selection:bg-neutral-500/30" style={{ fontSize: 'inherit', lineHeight: 'inherit', tabSize: 2, caretColor:light?CODE_COLORS.light.text:CODE_COLORS.dark.text }} />
    </div>{notice && <p role="status" className="text-[10px] text-neutral-400">{notice}</p>}
  </div>;
}
