import {test,expect} from 'bun:test';
import {normalizeBoardLibrary,searchBoards} from '../lib/boardLibrarySettings.ts';
const workspaces=[{id:'personal',name:'Personal'},{id:'work',name:'Product team'}];
const boards=[{id:'a',title:'Résumé 10',createdAt:1,updatedAt:9,workspaceId:'personal'},{id:'b',title:'Résumé 2',createdAt:4,updatedAt:2,workspaceId:'personal'},{id:'c',title:'Planning roadmap',createdAt:3,updatedAt:6,workspaceId:'work'}];
test('board library searches all terms and accents across titles and optional workspaces without changing the index',()=>{
 const before=JSON.stringify(boards),settings=normalizeBoardLibrary(undefined);
 expect(searchBoards(boards,workspaces,'personal','  resume   2 ',settings).map(b=>b.id)).toEqual(['b']);
 expect(searchBoards(boards,workspaces,'personal','planning',settings)).toEqual([]);
 expect(searchBoards(boards,workspaces,'personal','product planning',{...settings,scope:'all'}).map(b=>b.id)).toEqual(['c']);
 expect(searchBoards(boards,workspaces,'personal','not there',{...settings,scope:'all'})).toEqual([]);expect(JSON.stringify(boards)).toBe(before);
});
test('pins stay first within the chosen scope and natural title, recent, and creation sorting work',()=>{
 const settings={...normalizeBoardLibrary(undefined),scope:'all'};
 expect(searchBoards(boards,workspaces,'personal','',settings).map(b=>b.id)).toEqual(['a','c','b']);
 expect(searchBoards(boards,workspaces,'personal','',{...settings,sort:'title'}).map(b=>b.id)).toEqual(['c','b','a']);
 expect(searchBoards(boards,workspaces,'personal','',{...settings,sort:'created',pinnedIds:['a','missing']}).map(b=>b.id)).toEqual(['a','b','c']);
 expect(searchBoards(boards,workspaces,'personal','',{...settings,scope:'workspace',pinnedIds:['c']}).map(b=>b.id)).toEqual(['a','b']);
});
test('malformed library preferences recover without unbounded or duplicate pin IDs',()=>{
 expect(normalizeBoardLibrary({scope:'bad',sort:'bad',pinnedIds:['a','a',null,'','x'.repeat(129)]})).toEqual({scope:'workspace',sort:'updated',pinnedIds:['a']});
 expect(normalizeBoardLibrary({pinnedIds:Array.from({length:3000},(_,i)=>String(i))}).pinnedIds).toHaveLength(2000);
});
