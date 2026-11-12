'use client';
import { isLightBackground } from '@/lib/background.mjs';
import { cardBackground, CODE_CARD_FILL, MIN_CODE_HEIGHT } from '@/draw/cardAppearance';
import { backgroundFillCss, type BackgroundFill } from '@/draw/backgroundFill';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CODE_FONT_WEIGHT, CODE_LINE_HEIGHT, type CodeViewState } from '@/draw/codeLayout';
import { CODE_COLORS, codeTokenColor } from '@/lib/codePalette';
import { textSizeShortcut } from '@/lib/textShortcuts';
import { RangeTextEditor } from './RangeTextEditor';
import { codeTextRanges } from '@/draw/codeText';
import { fontCssStack } from '@/draw/fonts';
import { DEFAULT_STYLE } from '@/draw/types';
import type { TextElement } from '@/draw/types';
import type { RangeStyle } from '@/draw/textRanges';
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
export function CodeEditor({ value, language, onChange, onClose, x, y, width, height, zoom, fontSize, background, initialView, onViewChange, formatting, onFormat, onHistory, onResizeText }: { value: string; language: string; onChange: (code: string, language: string) => void; onClose: () => void; x: number; y: number; width: number; height: number; zoom: number; fontSize: number; background?: BackgroundFill; initialView?: CodeViewState; onViewChange?: (view: CodeViewState) => void; formatting?:TextElement; onFormat?:(style:RangeStyle)=>void; onHistory?:(redo:boolean)=>void;onResizeText?:(delta:number)=>void }) {
  const surface = cardBackground({...background || {fill:CODE_CARD_FILL,fillStyle:'solid' as const},isCodeCard:true});
  const light = isLightBackground({...surface,fillStyle:'solid',fillOpacity:surface.fillOpacity ?? 1});
  const ranges=codeTextRanges({...formatting,stroke:formatting?.stroke||CODE_COLORS.dark.text,text:value,codeLanguage:language},light);
  const input=useRef<HTMLTextAreaElement>(null);
  const [notice,setNotice]=useState('');
  const initial=useRef(initialView);
  const publishView = () => { const element=input.current;if(element)onViewChange?.({scrollLeft:element.scrollLeft,scrollTop:element.scrollTop,selectionStart:element.selectionStart,selectionEnd:element.selectionEnd}); };
  useLayoutEffect(() => {
    const element=input.current;if(!element)return;
    const view=initial.current;
    element.setSelectionRange(view?.selectionStart || 0,view?.selectionEnd || 0);
    element.focus({preventScroll:true});
    element.scrollLeft=view?.scrollLeft || 0;element.scrollTop=view?.scrollTop || 0;
  }, []);
  const replace = (text:string,start:number,end:number)=>{const next=value.slice(0,start)+text+value.slice(end),editor=input.current;if(editor){editor.textContent=next;editor.setSelectionRange(start+text.length,start+text.length);}onChange(next,language);publishView();};
  return <div aria-label="Inline code editor" data-light={light} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget) && !(e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest("[data-text-controls]"))) { publishView(); onClose(); } }} style={{ position: 'absolute', left: x, top: y, width: width + 32, minHeight: height + 32, transform: `scale(${zoom})`, transformOrigin: 'top left', zIndex:35,opacity:formatting?.opacity??1,padding:15, ...backgroundFillCss(surface), border: light ? '1px solid #d4d4d8' : '1px solid #334155', borderRadius: 10 }}>
    <div role="group" aria-label="Code actions" style={y < 32 * zoom ? {bottom:-32} : {top:-32}} className="absolute right-0 flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-1 text-neutral-400"><button data-ui-tone="info" type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" title="Copy code" aria-label="Copy code" onMouseDown={e => e.preventDefault()} onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice('Copied'); } catch { setNotice('Select and copy the code'); } }}><Copy className="h-3 w-3" /></button><button type="button" className="flex h-6 w-7 items-center justify-center rounded hover:bg-neutral-800 hover:text-white" aria-label="Finish editing code" title="Finish · Escape or Ctrl/Cmd+Enter" onClick={()=>{publishView();onClose();}}><X className="h-3 w-3" /></button></div>
    <div className="code-source relative overflow-hidden" style={{ height: Math.max(MIN_CODE_HEIGHT, height), fontSize, lineHeight: CODE_LINE_HEIGHT, fontWeight:formatting?.bold?700:CODE_FONT_WEIGHT, fontStyle:formatting?.italic?'italic':'normal',textDecoration:'none',fontFamily:fontCssStack(formatting?.fontFamily||DEFAULT_STYLE.fontFamily),textAlign:formatting?.textAlign||'left', fontKerning:"none", tabSize: 2, fontVariantLigatures: 'none', letterSpacing: 0 }}>
      <RangeTextEditor ref={input} light={light} textRanges={ranges} normalWeight={400} onHistory={onHistory} aria-label="Code source" placeholder="Write your code here…" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={value} maxLength={100000} onChange={e => onChange(e.target.value.slice(0,100000), language)} onSelect={publishView} onScroll={() => { publishView(); }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; e.stopPropagation();const sizeDelta=textSizeShortcut(e.nativeEvent);if(sizeDelta&&onResizeText){e.preventDefault();onResizeText(sizeDelta);return;} if((e.metaKey||e.ctrlKey)&&['z','y'].includes(e.key.toLowerCase())&&onHistory){e.preventDefault();onHistory(e.key.toLowerCase()==='y'||e.shiftKey);return;} if((e.metaKey||e.ctrlKey)&&onFormat){const mark=e.shiftKey&&e.key.toLowerCase()==='x'?'strikethrough':({b:'bold',i:'italic',u:'underline'} as const)[e.key.toLowerCase() as 'b'|'i'|'u'];if(mark){e.preventDefault();onFormat({[mark]:!formatting?.[mark]});return;}} if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); publishView(); onClose(); return; } if (e.key === 'Tab') { e.preventDefault(); replace('  ', e.currentTarget.selectionStart, e.currentTarget.selectionEnd); } if (e.key === 'Enter') { e.preventDefault(); const start = e.currentTarget.selectionStart; const line = value.slice(value.lastIndexOf('\n', start - 1) + 1, start); replace('\n' + (line.match(/^\s*/)?.[0] || '') + (/[{[(]\s*$/.test(line) ? '  ' : ''), start, e.currentTarget.selectionEnd); } }} wrap="off" className="absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent p-0 caret-white placeholder:text-neutral-500 outline-none selection:bg-neutral-500/30" style={{ fontSize:'inherit',fontFamily:'inherit',fontWeight:'inherit',fontStyle:'inherit',textDecoration:[formatting?.underline&&'underline',formatting?.strikethrough&&'line-through'].filter(Boolean).join(' '),textAlign:'inherit',height:'100%',overflow:'auto',lineHeight:'inherit',tabSize:2,caretColor:light?CODE_COLORS.light.text:CODE_COLORS.dark.text }} />
    </div>{notice && <p role="status" className="text-[10px] text-neutral-400">{notice}</p>}
  </div>;
}
