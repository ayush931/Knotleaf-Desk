"use client";
import React, {useLayoutEffect,useRef,useImperativeHandle} from 'react';
import {rangeStyleAt, type TextRange} from '@/draw/textRanges';
import {neutralInk} from "@/draw/canvasAppearance";
import {fontCssStack} from '@/draw/fonts';
// Keep the existing editing commands and selection API backed by a native DOM range.
export function RangeTextEditor({textRanges, fontScale=1, light=false, ...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{ref:React.Ref<HTMLTextAreaElement>;textRanges?:TextRange[];fontScale?:number;light?:boolean}){
 const root=useRef<HTMLDivElement>(null), saved=useRef({start:0,end:0}), composing=useRef(false);
 const text=String(props.value||''),baseDecoration=String(props.style?.textDecoration||'');
 const selection=()=>{
  const el=root.current,sel=window.getSelection();if(!el||!sel?.rangeCount||!el.contains(sel.anchorNode)||!el.contains(sel.focusNode))return saved.current;
  const r=sel.getRangeAt(0),a=r.cloneRange(),b=r.cloneRange();a.selectNodeContents(el);a.setEnd(r.startContainer,r.startOffset);b.selectNodeContents(el);b.setEnd(r.endContainer,r.endOffset);
  return saved.current={start:a.toString().length,end:b.toString().length};
 };
 const restore=(start:number,end:number)=>{
  const el=root.current;if(!el)return;const walker=document.createTreeWalker(el,window.NodeFilter.SHOW_TEXT);const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
  if(!nodes.length){el.appendChild(document.createTextNode(''));nodes.push(el.firstChild as Text);}
  const point=(offset:number):[Node,number]=>{for(const n of nodes){if(offset<=n.length)return[n,Math.max(0,offset)];offset-=n.length;}return[nodes.at(-1)!,nodes.at(-1)!.length];};
  const range=document.createRange();range.setStart(...point(start));range.setEnd(...point(end));const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range);saved.current={start,end};
 };
 useLayoutEffect(()=>{
  const el=root.current!; const active=document.activeElement===el;const old=selection();el.replaceChildren();
  const cuts=[...new Set([0,text.length,...(textRanges||[]).flatMap(r=>[r.start,r.end])])].filter(n=>n>=0&&n<=text.length).sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
   const span=document.createElement('span'),s=rangeStyleAt(textRanges,cuts[i]);span.textContent=text.slice(cuts[i],cuts[i+1]);
   Object.assign(span.style,{fontSize:s.fontSize?`${s.fontSize*fontScale}px`:'',fontFamily:s.fontFamily?fontCssStack(s.fontFamily):'',color:s.color?neutralInk(s.color,light):'',fontWeight:s.bold===undefined?'':s.bold?'700':'500',fontStyle:s.italic===undefined?'':s.italic?'italic':'normal',textDecoration:[(s.underline??baseDecoration.includes('underline'))&&'underline',(s.strikethrough??baseDecoration.includes('line-through'))&&'line-through'].filter(Boolean).join(' ')});el.appendChild(span);
  }
  if(active)restore(old.start,old.end);
 },[text,textRanges,fontScale,baseDecoration,light]);
 useLayoutEffect(()=>{
  const el=root.current!;Object.defineProperties(el,{value:{configurable:true,get:()=>el.textContent||''},selectionStart:{configurable:true,get:()=>selection().start,set:v=>restore(v,selection().end)},selectionEnd:{configurable:true,get:()=>selection().end,set:v=>restore(selection().start,v)}});
  Object.assign(el,{setSelectionRange:restore,select:()=>restore(0,(el.textContent||'').length)});

 });
 useImperativeHandle(props.ref,()=>root.current as unknown as HTMLTextAreaElement);
 const {ref:ignoredRef,value,onChange,onKeyDown,onBlur,onScroll,onSelect,wrap,spellCheck,placeholder,style,...rest}=props;void ignoredRef;void value;void wrap;
 return <div {...rest as React.HTMLAttributes<HTMLDivElement>} ref={root} role="textbox" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={spellCheck} data-placeholder={placeholder} style={{...style,textDecoration:'none',whiteSpace:'pre-wrap',overflowWrap:'break-word',fontKerning:'none',fontVariantLigatures:'none'}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={e=>{composing.current=false;selection();onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);}} onInput={e=>{selection();if(composing.current)return;onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);}} onKeyDown={e=>{onKeyDown?.(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>);if(!e.defaultPrevented&&!e.nativeEvent.isComposing&&e.key==='Enter'&&!e.metaKey&&!e.ctrlKey){e.preventDefault();document.execCommand('insertText',false,'\n');}}} onBlur={e=>{selection();onBlur?.(e as unknown as React.FocusEvent<HTMLTextAreaElement>);}} onScroll={e=>onScroll?.(e as unknown as React.UIEvent<HTMLTextAreaElement>)} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}} onMouseUp={e=>{selection();onSelect?.(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);}} onKeyUp={e=>{selection();onSelect?.(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);}}/>;
}
