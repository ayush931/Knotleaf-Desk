import {test,expect} from 'bun:test';
import {TEMPLATES} from '../draw/templatesData.ts';
import {DEFAULT_STYLE} from '../draw/types.ts';
import {sceneFontFamilies} from '../draw/fonts.ts';
test('built-in drawing-board content uses the handwriting font and preloads it for exports',()=>{
 expect(DEFAULT_STYLE.fontFamily).toBe('hand');expect(sceneFontFamilies([])).toContain('hand');
 const lettering=TEMPLATES.flatMap(t=>t.elements).filter(el=>el.type==='text'&&!el.isCodeCard||el.type==='sticky');
 expect(lettering.length).toBeGreaterThan(20);expect(lettering.every(el=>el.fontFamily==='hand')).toBe(true);
});
