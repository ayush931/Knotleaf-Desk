import {test,expect} from 'bun:test';
import {markdownLineStarts,markdownCaret,markdownMatches,replaceMarkdownMatches,normalizeMarkdownWorkspace,markdownWords,markdownAnchor} from '../lib/markdownWorkspace.ts';
test('line positions and literal Unicode searches preserve source offsets',()=>{
 const value='First\n日本語 **line**\nLast';const starts=markdownLineStarts(value);
 expect(starts).toEqual([0,6,19]);expect(markdownCaret(starts,7)).toEqual({line:2,column:2});
 expect(markdownMatches('a.b A.B [x]','a.b').matches).toEqual([{start:0,end:3},{start:4,end:7}]);
 expect(markdownMatches(value,'**line**').matches[0]).toEqual({start:10,end:18});expect(markdownWords(' one  two\nthree ')).toBe(3);
});
test('search caps retained matches and replacement checks size before building output',()=>{
 const result=markdownMatches('a'.repeat(100000),'a');expect(result.matches).toHaveLength(1000);expect(result.truncated).toBe(true);
 const matches=markdownMatches('one one','one').matches;
 expect(replaceMarkdownMatches('one one',matches,'$&')).toBe('$& $&');
 expect(()=>replaceMarkdownMatches('one one',matches,'too long',10)).toThrow('fill this section');
});
test('reader settings validate values and keep the application theme independent',()=>{
 expect(normalizeMarkdownWorkspace({mode:'split',theme:'paper',size:100,width:'wide',wrap:false})).toMatchObject({mode:'split',theme:'paper',size:24,width:'wide',wrap:false});
 expect(normalizeMarkdownWorkspace({mode:'script',theme:'invalid',size:NaN})).toMatchObject({mode:'source',theme:'dark',size:17});
 expect(markdownAnchor('Hello 世界!')).toBe('hello-世界');
});
