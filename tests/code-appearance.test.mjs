import {test,expect} from 'bun:test';
import {codeTextRanges,layoutCodeText} from '../draw/codeText.ts';
import {rangeStyleAt} from '../draw/textRanges.ts';
import {CODE_COLORS} from '../lib/codePalette.ts';
const card={text:'const count = 42;\n\tcount++;',codeLanguage:'javascript',stroke:'#ffffff',fontSize:14,fontFamily:'mono'};
test('code syntax remains separate from selected user formatting across lines and tabs',()=>{
 const ranges=codeTextRanges({...card,textRanges:[{start:6,end:11,style:{bold:true,fontFamily:'sketch',underline:true}}]});
 expect(rangeStyleAt(ranges,0).color).toBe(CODE_COLORS.dark.keyword);
 expect(rangeStyleAt(ranges,6)).toMatchObject({bold:true,fontFamily:'sketch',underline:true});
 expect(rangeStyleAt(ranges,12).bold).toBeUndefined();
 expect(rangeStyleAt(ranges,card.text.indexOf('42')).color).toBe(CODE_COLORS.dark.number);
 expect(rangeStyleAt(ranges,card.text.lastIndexOf('count')).bold).toBeUndefined();
});
test('explicit code colors override syntax only at the requested scope',()=>{
 const partial=codeTextRanges({...card,textRanges:[{start:0,end:5,style:{color:'#123456'}}]},true);
 expect(rangeStyleAt(partial,0).color).toBe('#123456');expect(rangeStyleAt(partial,card.text.indexOf('42')).color).toBe(CODE_COLORS.light.number);
 const whole=codeTextRanges({...card,codeColorCustom:true,stroke:'#654321'},true);
 expect(whole.every(range=>range.style.color==='#654321')).toBe(true);
 expect(codeTextRanges({...card,codeColorCustom:true},true).every(range=>range.style.color==='#000000')).toBe(true);
});
test('code layout retains selected weight, size and decoration and measures every line',()=>{
 const ctx={measureText(text){return {width:text.length*this.size,fontBoundingBoxAscent:this.size*.8,fontBoundingBoxDescent:this.size*.2}}};
 const setFont=(ctx,size)=>{ctx.size=size};
 const layout=layoutCodeText(ctx,{...card,textRanges:[{start:6,end:11,style:{fontSize:24,bold:true,italic:true,strikethrough:true}}]},setFont);
 expect(layout.lines).toHaveLength(2);expect(layout.lines[0].height).toBe(36);expect(layout.lines[0].glyphs.find(run=>run.text==='count')).toMatchObject({size:24,weight:700,italic:true,strikethrough:true});
 expect(layout.lines[1].glyphs.find(run=>run.text.startsWith('count'))).toMatchObject({size:14,weight:400});expect(layout.width).toBeGreaterThan(0);
});
