export type MarkdownView = 'source' | 'preview' | 'split';
export interface MarkdownWorkspaceSettings {
  mode: MarkdownView;
  theme: 'dark' | 'paper';
  size: number;
  width: 'reading' | 'wide' | 'full';
  wrap: boolean;
  syncScroll: boolean;
}
export const DEFAULT_MARKDOWN_WORKSPACE: MarkdownWorkspaceSettings = { mode:'source', theme:'dark', size:17, width:'reading', wrap:false, syncScroll:true };
export function normalizeMarkdownWorkspace(input: unknown): MarkdownWorkspaceSettings {
  const value = input && typeof input === 'object' ? input as Partial<MarkdownWorkspaceSettings> : {};
  return {
    mode: ['source','preview','split'].includes(value.mode!) ? value.mode! : 'source',
    theme: value.theme === 'paper' ? 'paper' : 'dark',
    size: typeof value.size === 'number' && Number.isFinite(value.size) ? Math.max(14,Math.min(24,Math.round(value.size))) : 17,
    width: ['reading','wide','full'].includes(value.width!) ? value.width! : 'reading',
    wrap: typeof value.wrap === 'boolean' ? value.wrap : false,
    syncScroll: typeof value.syncScroll === 'boolean' ? value.syncScroll : true,
  };
}
export function markdownLineStarts(value: string) {
  const starts=[0];
  for(let index=0;index<value.length;index++) if(value.charCodeAt(index)===10) starts.push(index+1);
  return starts;
}
export function markdownCaret(starts: number[], position: number) {
  let low=0, high=starts.length-1;
  while(low<high){const middle=Math.ceil((low+high)/2);if(starts[middle]<=position)low=middle;else high=middle-1;}
  return {line:low+1,column:Math.max(1,position-starts[low]+1)};
}
export function markdownWords(value: string) { let count=0;for(const _word of value.matchAll(/\S+/gu)){void _word;count++;}return count; }
export interface MarkdownMatch { start:number;end:number }
/** Literal Unicode search with a bounded result set, including a truncation signal. */
export function markdownMatches(value:string,query:string,matchCase=false,limit=1000) {
  const matches:MarkdownMatch[]=[];
  if(!query)return {matches,truncated:false};
  const pattern=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matchCase?'gu':'giu');
  for(const match of value.matchAll(pattern)) {
    if(matches.length===limit)return {matches,truncated:true};
    matches.push({start:match.index,end:match.index+match[0].length});
  }
  return {matches,truncated:false};
}
export function replaceMarkdownMatches(value:string,matches:MarkdownMatch[],replacement:string,maxLength=128*1024) {
  const size=value.length+matches.reduce((total,match)=>total+replacement.length-(match.end-match.start),0);
  if(size>maxLength)throw new Error('The replacement would fill this section. Use a shorter replacement or a more specific search.');
  const parts:string[]=[];let offset=0;
  for(const match of matches){parts.push(value.slice(offset,match.start),replacement);offset=match.end;}
  parts.push(value.slice(offset));return parts.join('');
}
export interface PreviewHeading { id:string;text:string;level:number }
export function markdownAnchor(text:string) {
  return text.trim().toLocaleLowerCase().replace(/[\s]+/g,'-').replace(/[^\w\u00c0-\uffff-]/g,'') || 'section';
}
