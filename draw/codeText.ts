import { highlightCode } from '@/lib/code';
import { lightSyntaxColor as lightCodeInk } from '@/lib/codePalette';
import { rangeStyleAt, type TextRange } from './textRanges';
import type { TextElement } from './types';
import { neutralInk } from './canvasAppearance';
import { codeLineMetrics } from './codeLayout';

/** Syntax colors are presentation only; user formatting remains separately saved. */
export function codeTextRanges(element: Pick<TextElement,'text'|'codeLanguage'|'textRanges'|'codeColorCustom'|'stroke'>, light=false): TextRange[] {
 const result:TextRange[]=[];let offset=0;
 for(const line of highlightCode(element.text,element.codeLanguage).lines){
  for(const token of line){
   const end=offset+token.text.length;
   const cuts=[offset,...(element.textRanges||[]).flatMap(r=>[r.start,r.end]).filter(n=>n>offset&&n<end),end].sort((a,b)=>a-b);
   for(let i=0;i<cuts.length-1;i++)if(cuts[i]<cuts[i+1])result.push({start:cuts[i],end:cuts[i+1],style:{color:element.codeColorCustom?element.stroke:light?lightCodeInk(token.color):token.color,...rangeStyleAt(element.textRanges,cuts[i])}});
   offset=end;
  }
  offset++;
 }
 return light?result.map(range=>({...range,style:{...range.style,...(range.style.color?{color:neutralInk(range.style.color,true)}:{})}})):result;
}

export function layoutCodeText(ctx:CanvasRenderingContext2D,el:TextElement,setFont:(ctx:CanvasRenderingContext2D,size:number,family:TextElement['fontFamily'],weight:number,italic?:boolean)=>void,light=false){
 const ranges=codeTextRanges(el,light);let offset=0,y=0,maxWidth=0,index=0;
 const lines=el.text.split('\n').map(text=>{
  let x=0,height=el.fontSize*1.5,baseline=0;
  const glyphs=[];const end=offset+text.length;
  while(offset<end){
   while(index<ranges.length-1&&ranges[index].end<=offset)index++;
   const range=ranges[index],style=range?.start<=offset&&offset<range.end?range.style:{};
   const next=Math.min(end,range?.end>offset?range.end:end);
   const size=style.fontSize||el.fontSize,family=style.fontFamily||el.fontFamily||'mono';
   const weight=(style.bold??el.bold)?700:400,italic=style.italic??el.italic;
   setFont(ctx,size,family,weight,italic);const metrics=codeLineMetrics(ctx,size);height=Math.max(height,metrics.lineHeight);baseline=Math.max(baseline,metrics.baseline);
   for(const part of el.text.slice(offset,next).split(/(\t)/)){
    if(!part)continue;
    const tab=ctx.measureText(' ').width*2;
    const width=part==='\t'?tab-(x%tab):ctx.measureText(part).width;
    glyphs.push({text:part==='\t'?'':part,x,width,size,family,weight,italic,color:style.color,underline:style.underline??el.underline,strikethrough:style.strikethrough??el.strikethrough});x+=width;
   }
   offset=next;
  }
  offset++;const line={glyphs,width:x,y,height,baseline};y+=height;maxWidth=Math.max(maxWidth,x);return line;
 });return {lines,width:maxWidth,height:y};
}
