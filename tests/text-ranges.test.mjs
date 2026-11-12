import {test,expect} from 'bun:test';
import {rangeFormattingState, formatRange,editRanges,rangeStyleAt} from '../draw/textRanges';
test('formatting only changes the selected substring and preserves independent marks',()=>{
 let ranges=formatRange('hello world',undefined,6,11,{bold:true,color:'#ff0000'});
 ranges=formatRange('hello world',ranges,8,10,{italic:true});
 expect(rangeStyleAt(ranges,0)).toEqual({});
 expect(rangeStyleAt(ranges,6)).toEqual({bold:true,color:'#ff0000'});
 expect(rangeStyleAt(ranges,9)).toEqual({bold:true,color:'#ff0000',italic:true});
 ranges=formatRange('hello world',ranges,8,10,{bold:false});
 expect(rangeStyleAt(ranges,9).bold).toBe(false);expect(rangeStyleAt(ranges,7).bold).toBe(true);
 expect(JSON.parse(JSON.stringify(ranges))).toEqual(ranges);
});
test('editing moves ranges with their text, removes deleted formatting, and inherits inserted style',()=>{
 const ranges=formatRange('hello world',undefined,6,11,{fontSize:32});
 const moved=editRanges('hello world','say hello world',ranges);
 expect(rangeStyleAt(moved,10).fontSize).toBe(32);expect(rangeStyleAt(moved,6)).toEqual({});
 const inserted=editRanges('hello world','hello worlds',ranges);expect(rangeStyleAt(inserted,11).fontSize).toBe(32);
 expect(editRanges('hello world','hello ',ranges)).toEqual([]);
});

test('replacing a formatted selection keeps its appearance without affecting surrounding text',()=>{
 const ranges=formatRange('hello world',undefined,6,11,{fontFamily:'manrope',fontSize:28,bold:true});
 const next=editRanges('hello world','hello team',ranges);
 expect(rangeStyleAt(next,0)).toEqual({});expect(rangeStyleAt(next,6)).toEqual({fontFamily:'manrope',fontSize:28,bold:true});
});
test('continued typing coalesces equal formatting instead of accumulating a range per keystroke',()=>{
 let text='x',ranges=formatRange(text,undefined,0,1,{bold:true});
 for(let i=0;i<100;i++){const next=text+'x';ranges=editRanges(text,next,ranges);text=next;}
 expect(ranges).toEqual([{start:0,end:101,style:{bold:true}}]);
});


test('formatting summary includes gaps and explicit false marks across a passage',()=>{
 const ranges=[{start:2,end:4,style:{bold:false,italic:true}}];
 expect(rangeFormattingState('abcdef',ranges,{bold:true},0,6)).toMatchObject({bold:'mixed',italic:'mixed',underline:false,strikethrough:false});
 expect(rangeFormattingState('abcdef',ranges,{bold:true},2,4)).toMatchObject({bold:false,italic:true});
 expect(rangeFormattingState('abcdef',ranges,{bold:true},6,6).bold).toBe(true);
});
