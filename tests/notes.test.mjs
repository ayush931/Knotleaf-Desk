import {test,expect} from 'bun:test';
import {findNoteMatches,replaceAllNoteMatches} from '../lib/notesSearch.ts';
import {formatNotes,indentNotes,continueNoteList,noteHeadings} from '../lib/notesEditing.ts';
test('note formatting uses whole lines and never inserts sample text',()=>{
 expect(formatNotes('hello world',6,11,'heading').value).toBe('# hello world');
 expect(formatNotes('',0,0,'bold')).toEqual({value:'****',start:2,end:2});
 expect(formatNotes('**hello**',2,7,'bold')).toEqual({value:'hello',start:0,end:5});
 expect(formatNotes('one\ntwo\nthree',0,8,'bullet').value).toBe('- one\n- two\nthree');
 expect(formatNotes('- one\n- two',0,11,'bullet').value).toBe('one\ntwo');
 expect(formatNotes('- one',3,3,'heading').value).toBe('# one');
 expect(formatNotes('',0,0,'code')).toEqual({value:'```\n\n```',start:4,end:4});
 expect(formatNotes('\nhello',0,0,'heading').value).toBe('# \nhello');
});
test('indent and outdent preserve selected content and list continuation resets checked tasks',()=>{
 expect(indentNotes('one\ntwo\nthree',0,8).value).toBe('  one\n  two\nthree');
 expect(indentNotes('  one\n  two',0,11,true)).toEqual({value:'one\ntwo',start:0,end:7});
 expect(continueNoteList('- [x] done',10,10).value).toBe('- [x] done\n- [ ] ');
 expect(continueNoteList('9. done',7,7).value).toBe('9. done\n10. ');
 expect(continueNoteList('- ',2,2)).toEqual({value:'',start:0,end:0});
 expect(continueNoteList('paragraph',9,9)).toBe(null);
});
test('outline excludes fenced code and retains correct source offsets',()=>{
 const text='# Intro\n```python\n# a comment\n```\n## Next';
 expect(noteHeadings(text)).toEqual([{text:'Intro',start:0,end:7,level:1},{text:'Next',start:34,end:41,level:2}]);
});

test('notes search is literal, case-aware, Unicode-safe and replaces dollar signs verbatim',()=>{
 expect(findNoteMatches('a.b aXb A.B','a.b')).toEqual([{start:0,end:3},{start:8,end:11}]);
 expect(findNoteMatches('a.b aXb A.B','a.b',true)).toEqual([{start:0,end:3}]);
 expect(findNoteMatches('😀 note 😀 note','note')).toEqual([{start:3,end:7},{start:11,end:15}]);
 expect(replaceAllNoteMatches('[a].* [a].*','[a].*','$&')).toEqual({value:'$& $&',count:2});
 expect(replaceAllNoteMatches('keep','', 'x')).toEqual({value:'keep',count:0});
 expect(replaceAllNoteMatches('foo FOO','foo','')).toEqual({value:' ',count:2});
});
