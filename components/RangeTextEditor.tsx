"use client";
import React, {useLayoutEffect,useRef,useImperativeHandle,useState} from 'react';
import {rangeStyleAt, type TextRange} from '@/draw/textRanges';
import {neutralInk} from "@/draw/canvasAppearance";
import {fontCssStack} from '@/draw/fonts';
import {editableText,textEdit,type TextEdit,type TextChange} from '@/lib/editableText';
// Keep the existing editing commands and selection API backed by a native DOM range.
export function RangeTextEditor({textRanges, fontScale=1, light=false, normalWeight=500, onHistory, onBeforeEdit, ...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{ref:React.Ref<HTMLTextAreaElement>;textRanges?:TextRange[];fontScale?:number;light?:boolean;normalWeight?:number;onHistory?:(redo:boolean)=>void;onBeforeEdit?:(start:number,end:number,changes?:TextChange[])=>void}){
 const root=useRef<HTMLDivElement>(null), saved=useRef({start:0,end:0}), composing=useRef(false);
 const [compositionVersion,setCompositionVersion]=useState(0);
 const text=String(props.value||''),baseDecoration=String(props.style?.textDecoration||'');
 const selection=()=>{
  const el=root.current,sel=window.getSelection();if(!el||document.activeElement!==el||!sel?.rangeCount||!el.contains(sel.anchorNode)||!el.contains(sel.focusNode))return saved.current;
  const r=sel.getRangeAt(0),a=r.cloneRange(),b=r.cloneRange();a.selectNodeContents(el);a.setEnd(r.startContainer,r.startOffset);b.selectNodeContents(el);b.setEnd(r.endContainer,r.endOffset);
  return saved.current={start:editableText(a.cloneContents(),true).length,end:editableText(b.cloneContents(),true).length};
 };
 const restore=(start:number,end:number)=>{
  const el=root.current;if(!el)return;const length=editableText(el).length;start=Math.max(0,Math.min(length,Number.isFinite(start)?Math.trunc(start):0));end=Math.max(start,Math.min(length,Number.isFinite(end)?Math.trunc(end):0));const walker=document.createTreeWalker(el,window.NodeFilter.SHOW_TEXT);const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
  if(!nodes.length){el.insertBefore(document.createTextNode(''),el.firstChild);nodes.push(el.firstChild as Text);}
  const point=(offset:number):[Node,number]=>{for(const n of nodes){if(offset<=n.length)return[n,Math.max(0,offset)];offset-=n.length;}return[nodes.at(-1)!,nodes.at(-1)!.length];};
  const range=document.createRange();range.setStart(...point(start));range.setEnd(...point(end));const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range);saved.current={start,end};
 };
 const applyEdit=(edit:TextEdit)=>{
  const el=root.current;if(!el)return;
  const before=selection();onBeforeEdit?.(before.start,before.end,edit.changes);
  el.textContent=edit.text;restore(edit.start,edit.end);
  props.onChange?.({target:el,currentTarget:el} as unknown as React.ChangeEvent<HTMLTextAreaElement>);
 };
 const insertText=(insert:string)=>{
  const el=root.current;if(!el)return;insert=insert.replace(/\r\n?/g,'\n');
  const {start,end}=selection(),value=editableText(el),caret=start+insert.length;
  applyEdit({text:value.slice(0,start)+insert+value.slice(end),start:caret,end:caret});
 };
 const command=(kind:'enter'|'indent'|'outdent',soft=false)=>{
  const el=root.current;if(!el)return;const {start,end}=selection();applyEdit(textEdit(editableText(el),start,end,kind,soft));
 };
 useLayoutEffect(()=>{
  const el=root.current!;if(composing.current)return; const active=document.activeElement===el;const old=selection();el.replaceChildren();
  const cuts=[...new Set([0,text.length,...(textRanges||[]).flatMap(r=>[r.start,r.end])])].filter(n=>n>=0&&n<=text.length).sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
   const span=document.createElement('span'),s=rangeStyleAt(textRanges,cuts[i]);span.textContent=text.slice(cuts[i],cuts[i+1]);
   Object.assign(span.style,{fontSize:s.fontSize?`${s.fontSize*fontScale}px`:'',fontFamily:s.fontFamily?fontCssStack(s.fontFamily):'',color:s.color?neutralInk(s.color,light):'',fontWeight:s.bold===undefined?'':s.bold?'700':String(normalWeight),fontStyle:s.italic===undefined?'':s.italic?'italic':'normal',textDecoration:[(s.underline??baseDecoration.includes('underline'))&&'underline',(s.strikethrough??baseDecoration.includes('line-through'))&&'line-through'].filter(Boolean).join(' ')});el.appendChild(span);
  }
  if(!text || text.endsWith("\n")){const caret=document.createElement("br");caret.setAttribute("data-editor-caret","true");el.appendChild(caret);}
  if(active)restore(old.start,old.end);
 },[text,textRanges,fontScale,baseDecoration,light,normalWeight,compositionVersion]);
 useLayoutEffect(()=>{
  const el=root.current!;Object.defineProperties(el,{value:{configurable:true,get:()=>editableText(el)},selectionStart:{configurable:true,get:()=>selection().start,set:v=>restore(v,selection().end)},selectionEnd:{configurable:true,get:()=>selection().end,set:v=>restore(selection().start,v)}});
  Object.assign(el,{setSelectionRange:restore,select:()=>restore(0,editableText(el).length)});
  const beforeInput=(event:InputEvent)=>{
   if(composing.current||event.isComposing)return;
   if(!event.cancelable){const before=selection();onBeforeEdit?.(before.start,before.end);return;}
   if(onHistory&&['historyUndo','historyRedo'].includes(event.inputType)){event.preventDefault();onHistory(event.inputType==='historyRedo');return;}
   const {start,end}=selection();onBeforeEdit?.(start,end);
   if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();command('enter',event.inputType==='insertLineBreak');}
   else if(['insertText','insertReplacementText'].includes(event.inputType)&&event.data&&/[\r\n]/.test(event.data)){
    const target=event.getTargetRanges?.()[0];
    if(target&&el.contains(target.startContainer)&&el.contains(target.endContainer)){
     const prefix=document.createRange();prefix.selectNodeContents(el);prefix.setEnd(target.startContainer,target.startOffset);const start=editableText(prefix.cloneContents(),true).length;prefix.setEnd(target.endContainer,target.endOffset);const end=editableText(prefix.cloneContents(),true).length;restore(start,end);
    }
    event.preventDefault();insertText(event.data);
   }
  };
  el.addEventListener('beforeinput',beforeInput);
  return()=>el.removeEventListener('beforeinput',beforeInput);

 });
 useImperativeHandle(props.ref,()=>root.current as unknown as HTMLTextAreaElement);
 const {ref:ignoredRef,value,onChange,onKeyDown,onBlur,onScroll,onSelect,wrap,spellCheck,placeholder,style,...rest}=props;void ignoredRef;void value;
 return <div {...rest as React.HTMLAttributes<HTMLDivElement>} ref={root} role="textbox" aria-multiline="true" contentEditable suppressContentEditableWarning spellCheck={spellCheck} data-placeholder={placeholder} data-empty={!text} style={{...style,textDecoration:'none',whiteSpace:wrap==='off'?'pre':'pre-wrap',overflowWrap:wrap==='off'?'normal':'break-word',wordBreak:'normal',fontKerning:'none',fontVariantLigatures:'none'}} onCompositionStart={()=>{const before=selection();onBeforeEdit?.(before.start,before.end);composing.current=true;}} onCompositionEnd={e=>{composing.current=false;setCompositionVersion(value=>value+1);selection();onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);}} onInput={e=>{selection();if(composing.current||(e.nativeEvent as InputEvent).isComposing)return;onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);}} onKeyDown={e=>{if(composing.current||e.nativeEvent.isComposing||e.nativeEvent.keyCode===229)return;onKeyDown?.(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>);if(e.defaultPrevented||e.metaKey||e.ctrlKey)return;if(e.key==='Enter'){e.preventDefault();command('enter',e.shiftKey);}else if(e.key==='Tab'){e.preventDefault();command(e.shiftKey?'outdent':'indent');}}} onBlur={e=>{if(composing.current){composing.current=false;setCompositionVersion(value=>value+1);onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);}selection();onBlur?.(e as unknown as React.FocusEvent<HTMLTextAreaElement>);}} onScroll={e=>onScroll?.(e as unknown as React.UIEvent<HTMLTextAreaElement>)} onPaste={e=>{e.preventDefault();insertText(e.clipboardData.getData('text/plain'));}} onMouseUp={e=>{selection();onSelect?.(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);}} onKeyUp={e=>{selection();onSelect?.(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);}}/>;
}
