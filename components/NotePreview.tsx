"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { loadPreferences } from "@/lib/preferences";
import { fontCssStack } from "@/draw/fonts";
import { notesToSafeHtml } from "@/lib/richNotes";
import { highlightCode } from "@/lib/code";
import { readNoteHref, type NoteAppearance } from "@/lib/notesDocument";
import { markdownAnchor, type PreviewHeading } from "@/lib/markdownWorkspace";

export function NotePreview({value,onOpenNote,highlight=true,enhanced=false,headingPrefix='markdown',onOutline,onNotice,query='',matchCase=false,appearanceOverride}: {
  value:string;onOpenNote?:(id:string)=>boolean;highlight?:boolean;enhanced?:boolean;headingPrefix?:string;
  onOutline?:(headings:PreviewHeading[])=>void;onNotice?:(message:string)=>void;query?:string;matchCase?:boolean;appearanceOverride?:Partial<NoteAppearance>;
}) {
  const [savedAppearance]=useState(()=>loadPreferences().noteAppearance);
  const appearance={...savedAppearance,...appearanceOverride};
  const root=useRef<HTMLElement>(null);
  const prepared=useMemo(()=>{
    const template=document.createElement('template');
    template.innerHTML=notesToSafeHtml(value||'*Your Markdown preview will appear here once you start writing.*',{deferImages:enhanced});
    template.content.querySelectorAll('pre code').forEach(code=>{
      const language=code.className.replace('language-','')||'auto';
      if(highlight){code.innerHTML=highlightCode(code.textContent||'',language).html;code.classList.add('hljs');}
      if(enhanced&&code.parentElement?.tagName==='PRE'){
        const pre=code.parentElement,wrapper=document.createElement('div'),bar=document.createElement('div'),label=document.createElement('span'),button=document.createElement('button');
        wrapper.className='markdown-code-block';bar.className='markdown-code-toolbar';label.textContent=language==='auto'?'Code':language;
        button.type='button';button.textContent='Copy code';button.setAttribute('aria-label','Copy code block');button.setAttribute('data-markdown-copy','true');bar.append(label,button);
        pre.replaceWith(wrapper);wrapper.append(bar,pre);
      }
    });
    template.content.querySelectorAll('input[type="checkbox"]').forEach(input=>input.setAttribute('disabled',''));
    template.content.querySelectorAll('a').forEach(anchor=>{anchor.target='_blank';anchor.rel='noopener noreferrer';});
    const headings:PreviewHeading[]=[],anchors=new Map<string,number>();
    if(enhanced){
      template.content.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading,index)=>{
        const text=heading.textContent||'Section',slug=markdownAnchor(text),count=anchors.get(slug)||0;anchors.set(slug,count+1);
        const anchor=count?`${slug}-${count}`:slug,id=`${headingPrefix}-${index}`;
        heading.id=id;heading.setAttribute('data-markdown-anchor',anchor);headings.push({id,text,level:Number(heading.tagName.slice(1))});
      });
      template.content.querySelectorAll('img').forEach(image=>{
        const src=image.getAttribute('data-markdown-image-src')||image.getAttribute('src');if(!src)return;
        let allowed=false;try{const url=new URL(src,window.location.href);allowed=['http:','https:','blob:'].includes(url.protocol)||/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i.test(src);}catch{/* Invalid image addresses stay inert. */}
        if(!allowed){image.removeAttribute('src');return;}
        const figure=document.createElement('figure'),bar=document.createElement('div'),button=document.createElement('button'),label=document.createElement('span');
        figure.className='markdown-image';bar.className='markdown-code-toolbar';label.textContent=image.alt||'Image';
        image.removeAttribute('src');image.setAttribute('data-markdown-image-src',src);image.loading='lazy';image.decoding='async';image.hidden=true;
        button.type='button';button.textContent='Load image';button.setAttribute('data-markdown-load-image','true');button.setAttribute('aria-label',`Load image: ${image.alt||'Markdown image'}`);
        bar.append(label,button);image.replaceWith(figure);figure.append(bar,image);
      });
      template.content.querySelectorAll('table').forEach(table=>{const wrap=document.createElement('div');wrap.className='markdown-table-scroll';wrap.setAttribute('tabindex','0');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Markdown table');table.replaceWith(wrap);wrap.append(table);});
    }
    return {html:template.innerHTML,headings};
  },[value,highlight,enhanced,headingPrefix]);
  useEffect(()=>{onOutline?.(prepared.headings);},[prepared,onOutline]);
  // Search decorates the sanitized DOM without reparsing Markdown on every search keystroke.
  useEffect(()=>{
    const article=root.current;if(!article)return;
    article.querySelectorAll('mark[data-markdown-search]').forEach(mark=>mark.replaceWith(document.createTextNode(mark.textContent||'')));
    article.normalize();if(!query)return;
    const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
    while(walker.nextNode()){const node=walker.currentNode as Text;if(!node.parentElement?.closest('button,.markdown-code-toolbar'))nodes.push(node);}
    const pattern=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matchCase?'gu':'giu');let count=0;
    for(const node of nodes){
      if(count>=500)break;const text=node.data,fragment=document.createDocumentFragment();let offset=0;
      for(const match of text.matchAll(pattern)){if(count++>=500)break;fragment.append(document.createTextNode(text.slice(offset,match.index)));const mark=document.createElement('mark');mark.dataset.markdownSearch='true';mark.textContent=match[0];fragment.append(mark);offset=match.index+match[0].length;}
      if(offset){fragment.append(document.createTextNode(text.slice(offset)));node.replaceWith(fragment);}
    }
  },[prepared,query,matchCase]);
  return <article ref={root} className="notes-rich mx-auto" style={{maxWidth:appearance.width==='full'?'none':appearance.width==='wide'?1080:768,'--note-font-family':fontCssStack(appearance.font),'--note-font-size':`${appearance.size}px`,'--note-line-height':appearance.lineHeight} as CSSProperties} onErrorCapture={event=>{if((event.target as HTMLElement).tagName==='IMG')onNotice?.('This image could not load. Use Reload image or check its address.');}} onClick={event=>{
    const target=event.target as HTMLElement,copy=target.closest('button[data-markdown-copy]');
    if(copy){const code=copy.closest('.markdown-code-block')?.querySelector('code')?.textContent||'';void(async()=>{try{await navigator.clipboard.writeText(code);onNotice?.('Code copied.');}catch{onNotice?.('Could not copy. Select the code and copy it manually.');}})();return;}
    const load=target.closest('button[data-markdown-load-image]');
    if(load){const image=load.closest('figure')?.querySelector('img'),src=image?.getAttribute('data-markdown-image-src');if(image&&src){image.src=src;image.hidden=false;load.textContent='Reload image';}return;}
    const anchor=target.closest('a'),href=anchor?.getAttribute('href')||'',id=readNoteHref(href);
    if(id&&onOpenNote){event.preventDefault();onOpenNote(id);return;}
    if(enhanced&&href.startsWith('#')){event.preventDefault();let fragment=href.slice(1);try{fragment=decodeURIComponent(fragment);}catch{/* Keep the literal fragment. */}const heading=[...root.current?.querySelectorAll('[data-markdown-anchor]')||[]].find(item=>item.getAttribute('data-markdown-anchor')===fragment);heading?.scrollIntoView?.({block:'start'});}
  }}><div className="tiptap" dangerouslySetInnerHTML={{__html:prepared.html}}/></article>;
}
