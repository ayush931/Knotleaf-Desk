import type { FontFamily, TextFormatting } from './types';
export type RangeStyle = Omit<TextFormatting, 'textRanges'> & { fontSize?: number; fontFamily?: FontFamily; color?: string };
export interface TextRange { start: number; end: number; style: RangeStyle }
export function rangeStyleAt(ranges: TextRange[] | undefined, index: number): RangeStyle {
  return Object.assign({}, ...(ranges || []).filter(r => r.start <= index && index < r.end).map(r => r.style));
}
export function formatRange(text: string, ranges: TextRange[] | undefined, start: number, end: number, style: RangeStyle): TextRange[] {
  start = Math.max(0, Math.min(text.length, start)); end = Math.max(start, Math.min(text.length, end));
  const cuts = [...new Set([0, text.length, start, end, ...(ranges || []).flatMap(r => [r.start, r.end])])].filter(n => n >= 0 && n <= text.length).sort((a,b)=>a-b);
  const result: TextRange[] = [];
  for (let i=0;i<cuts.length-1;i++) {
    const a=cuts[i], b=cuts[i+1], value={...rangeStyleAt(ranges,a), ...(a>=start&&b<=end?style:{})};
    if (!Object.keys(value).length || a===b) continue;
    const previous=result.at(-1);
    if(previous?.end===a&&JSON.stringify(previous.style)===JSON.stringify(value))previous.end=b;
    else result.push({start:a,end:b,style:value});
  }
  return result;
}
export function editRanges(before: string, after: string, ranges?: TextRange[]): TextRange[] | undefined {
  if (!ranges?.length || before===after) return ranges;
  let start=0; while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let tail=0;while(tail<before.length-start&&tail<after.length-start&&before[before.length-1-tail]===after[after.length-1-tail])tail++;
  const oldEnd=before.length-tail,newEnd=after.length-tail,delta=newEnd-oldEnd;
  const result:TextRange[]=[];
  for(const r of ranges){
    if(r.start<start)result.push({...r,end:Math.min(r.end,start)});
    if(r.end>oldEnd)result.push({...r,start:Math.max(r.start,oldEnd)+delta,end:r.end+delta});
  }
  if(newEnd>start){const style=rangeStyleAt(ranges,Math.max(0,start-1));if(Object.keys(style).length)result.push({start,end:newEnd,style});}
  return result.filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start);
}
/** A whole-object change replaces only the changed properties in existing ranges. */
export function clearRangeOverrides(ranges:TextRange[]|undefined,style:RangeStyle):TextRange[]|undefined {
 if(!ranges)return ranges;
 const keys=Object.keys(style);
 return ranges.map(r=>({...r,style:Object.fromEntries(Object.entries(r.style).filter(([key])=>!keys.includes(key)))})).filter(r=>Object.keys(r.style).length);
}
