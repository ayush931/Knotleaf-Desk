import {test,expect} from 'bun:test';
import {linkedNoteIds,noteHref,readNoteHref,normalizeNoteAppearance,normalizeNoteColor,NOTE_TEMPLATES} from '../lib/notesDocument.ts';
test('note links and backlinks recognize Markdown and styled HTML and ignore code examples',()=>{
 const markdown='[One](#note=page-a) and <a href="#note=page-b">Two</a> and [again](#note=page-a)\n\n```md\n[example](#note=not-a-link)\n```\n\n`[inline](#note=not-a-link)`';
 expect(linkedNoteIds(markdown)).toEqual(['page-a','page-b']);expect(readNoteHref(noteHref('a b/汉字'))).toBe('a b/汉字');expect(readNoteHref('https://example.com')).toBeNull();expect(readNoteHref('#note=%zz')).toBeNull();
});
test('document appearance and content colors reject malformed settings',()=>{
 expect(normalizeNoteAppearance({font:'serif',size:20,lineHeight:2.1,width:'wide'})).toEqual({font:'serif',size:20,lineHeight:2.1,width:'wide'});
 expect(normalizeNoteAppearance({font:'url(bad)',size:Infinity,lineHeight:-1,width:'bad'})).toEqual(normalizeNoteAppearance(null));
 expect(normalizeNoteColor('rgb(125, 211, 252)')).toBe('#7dd3fc');expect(normalizeNoteColor('url(bad)')).toBeNull();expect(normalizeNoteColor('rgb(999,0,0)')).toBeNull();
 expect(NOTE_TEMPLATES).toHaveLength(6);expect(new Set(NOTE_TEMPLATES.map(t=>t.id)).size).toBe(6);
});
