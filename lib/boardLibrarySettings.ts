import type { BoardSummary, Workspace } from '@/draw/types';
export interface BoardLibrarySettings {
  scope: 'workspace' | 'all';
  sort: 'updated' | 'title' | 'created';
  pinnedIds: string[];
}
export function normalizeBoardLibrary(value: unknown): BoardLibrarySettings {
  const data=value && typeof value==='object'?value as Partial<BoardLibrarySettings>:{};
  return {scope:data.scope==='all'?'all':'workspace',sort:data.sort==='title'||data.sort==='created'?data.sort:'updated',
    pinnedIds:Array.isArray(data.pinnedIds)?[...new Set(data.pinnedIds.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=128))].slice(0,2000):[]};
}
const fold=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en');
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function searchBoards(boards:BoardSummary[],workspaces:Workspace[],workspaceId:string,query:string,settings:BoardLibrarySettings):BoardSummary[]{
  const names=new Map(workspaces.map(w=>[w.id,w.name])),pins=new Set(settings.pinnedIds),terms=fold(query.trim()).split(/\s+/).filter(Boolean);
  return boards.filter(board=>{
    if(settings.scope==='workspace'&&(board.workspaceId||'personal')!==workspaceId)return false;
    const title=fold(`${board.title||'Untitled board'} ${settings.scope==='all'?names.get(board.workspaceId||'personal')||'':''}`);
    return terms.every(term=>title.includes(term));
  }).sort((a,b)=>Number(pins.has(b.id))-Number(pins.has(a.id))||
    (settings.sort==='title'?collator.compare(a.title,b.title):settings.sort==='created'?b.createdAt-a.createdAt:b.updatedAt-a.updatedAt)||collator.compare(a.title,b.title)||a.id.localeCompare(b.id));
}
