import { test, expect } from 'bun:test';
import { parseFillColor } from '../lib/fillColor.ts';
import { drawBackgroundFill, drawCanvasBackground } from '../draw/backgroundFill.ts';
import { drawElement } from '../draw/renderer.ts';
import { normalizeBackground, DEFAULT_BACKGROUND, isLightBackground } from '../lib/background.mjs';
import { serializeProject, readProjectPayload } from '../lib/projectFile.ts';
function context() {
  const stack = [], fills = [], strokes = [], clips = [], lines = [], dots = [];
  const target = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    measureText: (text) => ({ width: (text || '').length * 8 }),
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); }, restore() { Object.assign(this, stack.pop()); },
    fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
    fillRect() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
    fillText() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
    stroke() { strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha }); }, clip() { clips.push(true); }, lineTo(...p) { lines.push(p); }, arc(...p) { dots.push(p); }
  };
  return { ctx: new Proxy(target, { get: (o, k) => k in o ? o[k] : () => {} }), fills, strokes, clips, lines, dots };
}
const rect = { id: 'rect', type: 'rectangle', x: 0, y: 0, width: 100, height: 60, stroke: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', fill: '#3b82f6', fillStyle: 'solid', fillOpacity: 0.25, roundness: 'sharp', opacity: 0.8, zIndex: 0 };
test('fill opacity fades only the background, preserving stroke alpha and color', () => {
  const { ctx, fills, strokes } = context(); drawElement(ctx, rect, { theme: 'dark' });
  expect(fills).toContainEqual({ color: '#3b82f6', alpha: 0.2 }); expect(strokes).toContainEqual({ color: '#ffffff', alpha: 0.8 }); expect(ctx.globalAlpha).toBe(1);
});
test('zero fill opacity removes the background without removing the outline', () => {
  const { ctx, fills, strokes } = context(); drawElement(ctx, { ...rect, fillOpacity: 0 }, { theme: 'dark' }); expect(fills).toEqual([]); expect(strokes).toHaveLength(1); expect(strokes[0].alpha).toBe(0.8);
});
test('patterns clip to the shape, crosshatch adds a second direction, and dots stay bounded', () => {
  const counts = {};
  for (const style of ['hachure', 'crosshatch', 'dots']) {
    const { ctx, fills, strokes, clips, lines, dots } = context(); drawElement(ctx, { ...rect, fillStyle: style }, { theme: 'dark' }); expect(clips).toHaveLength(1); expect(strokes.at(-1)).toEqual({ color: '#ffffff', alpha: 0.8 });
    counts[style] = lines.length;
    if (style === 'dots') { expect(dots.length).toBeGreaterThan(0); expect(fills[0]).toEqual({ color: '#3b82f6', alpha: 0.2 }); }
  }
  expect(counts.crosshatch).toBeGreaterThan(counts.hachure);
});
test('legacy fills stay opaque and legacy semi fills retain their translucent appearance', () => {
  for (const [fillStyle, alpha] of [['solid', 1], ['semi', 0.35]]) { const { ctx, fills } = context(); drawBackgroundFill(ctx, { fill: '#ff0000', fillStyle }, () => {}, { x: 0, y: 0, width: 20, height: 20 }); expect(fills[0].alpha).toBe(alpha); }
});
test('canvas background normalization is bounded and portable files preserve both kinds of opacity', () => {
  const background = { fill: '#ec4899', fillStyle: 'crosshatch', fillOpacity: 0.4 };
  expect(normalizeBackground(JSON.stringify(background))).toEqual(background);
  for (const invalid of [null, '{bad', { ...background, fill: 'url(https://example.com)' }, { ...background, fillOpacity: 2 }]) expect(normalizeBackground(invalid)).toEqual(DEFAULT_BACKGROUND);
  const parsed = readProjectPayload(serializeProject({ title: 'Background', elements: [rect], background, markdownNotes: '' })); expect(parsed.background).toEqual(background); expect(parsed.elements[0].fillOpacity).toBe(0.25);
  expect(isLightBackground({ ...background, fill: '#ffffff', fillOpacity: 1 })).toBe(true); expect(isLightBackground(DEFAULT_BACKGROUND)).toBe(false); expect(isLightBackground({ ...background, fillOpacity: 0 })).toBe(true);
});


test('legacy RGBA fill colors separate intrinsic alpha so sliders can reach full opacity', () => {
  expect(parseFillColor('rgba(59, 130, 246, 0.2)')).toEqual({ color: '#3b82f6', opacity: 0.2 });
  expect(parseFillColor('#fff')).toEqual({ color: '#ffffff', opacity: 1 }); expect(parseFillColor('transparent').opacity).toBe(0);
});


test('every canvas pattern paints the chosen base color first without changing shape pattern semantics', () => {
  for(const fill of ['#121212','#4a5b4c','#ffffff'])for(const fillStyle of ['solid','hachure','crosshatch','dots']) {
    const {ctx,fills,strokes}=context(); drawCanvasBackground(ctx,{fill,fillStyle,fillOpacity:1},()=>{}, {x:0,y:0,width:100,height:60});
    expect(fills[0]).toEqual({color:fill,alpha:1});
    const pattern=fillStyle==='dots'?fills[1]:strokes[0];
    if(fillStyle!=='solid')expect(pattern).toEqual({color:fill==='#ffffff'?'#000000':'#ffffff',alpha:.12});
  }
  const {ctx,fills}=context();drawCanvasBackground(ctx,{fill:'#121212',fillStyle:'crosshatch',fillOpacity:.4},()=>{}, {x:0,y:0,width:100,height:60});expect(fills[0].alpha).toBe(.4);
});

test('light canvas changes background and neutral ink reversibly without mutating artwork', async () => {
 const {canvasBackground,canvasElementAppearance}=await import('../draw/canvasAppearance.ts');
 const original={...rect,fill:'transparent',fillStyle:'none'};
 expect(canvasBackground(DEFAULT_BACKGROUND,'light')).toEqual({...DEFAULT_BACKGROUND,fill:'#ffffff'});
 expect(canvasBackground(DEFAULT_BACKGROUND,'dark')).toEqual(DEFAULT_BACKGROUND);
 const custom={...DEFAULT_BACKGROUND,fill:'#ec4899',fillStyle:'crosshatch'};
 expect(canvasBackground(custom,'light')).toEqual(custom);
 const {ctx,strokes}=context();drawElement(ctx,original,{theme:'light'});
 expect(strokes.at(-1).color).toBe('#1f2937');expect(original.stroke).toBe('#ffffff');
 expect(canvasElementAppearance(original,false)).toBe(original);
 expect(canvasElementAppearance({...original,stroke:'#ef4444'},true).stroke).toBe('#ef4444');
 expect(canvasElementAppearance({...original,fill:'#101010',fillStyle:'solid',fillOpacity:1},true).stroke).toBe('#ffffff');
});

test('default document and code cards use readable light surfaces and custom cards retain their colors',async()=>{
 const {canvasElementAppearance,lightCodeInk}=await import('../draw/canvasAppearance.ts');
 const card={...rect,fillOpacity:1,type:'text',isDocCard:true,text:'Notes',fill:'#242428',stroke:'#FFFFFF',fontSize:20,fontFamily:'sans',textAlign:'left'};
 expect(canvasElementAppearance(card,true)).toMatchObject({fill:'#ffffff',stroke:'#1f2937'});
 expect(canvasElementAppearance({...card,isCodeCard:true,fill:'#111d2d'},true).fill).toBe('#ffffff');
 const pureCodeCard={...rect,fillOpacity:1,type:'text',isCodeCard:true,text:'const x=1;',fill:'#111d2d',stroke:'#FFFFFF',fontSize:14,fontFamily:'mono',textAlign:'left'};
 expect(canvasElementAppearance(pureCodeCard,true)).toMatchObject({fill:'#ffffff',stroke:'#1f2937'});
 const attachmentCard={...rect,fillOpacity:1,type:'text',attachment:{name:'doc.pdf',size:1024},text:'doc.pdf',fill:'#18181b',stroke:'#FFFFFF',fontSize:14,fontFamily:'sans',textAlign:'left'};
 expect(canvasElementAppearance(attachmentCard,true)).toMatchObject({fill:'#ffffff',stroke:'#1f2937'});
 expect(canvasElementAppearance({...card,cardFillCustom:true},true)).toEqual({...card,cardFillCustom:true});
 expect(lightCodeInk('#d4d4d8')).toBe('#27272a');expect(lightCodeInk('#b8a8c4')).toBe('#6b3f87');
});

test('drawio export reflects light theme canvas background', async () => {
 const { boardToDrawio } = await import('../draw/drawioExport.ts');
 const xml = boardToDrawio({ title: 'Test', elements: [], createdAt: 1, updatedAt: 1, id: '1', theme: 'light', viewMode: 'canvas', gridType: 'dot', snapToGrid: false, zoom: 1, panOffset: { x: 0, y: 0 } });
 expect(xml).toContain('background="#ffffff"');
 const darkXml = boardToDrawio({ title: 'Test', elements: [], createdAt: 1, updatedAt: 1, id: '1', theme: 'dark', viewMode: 'canvas', gridType: 'dot', snapToGrid: false, zoom: 1, panOffset: { x: 0, y: 0 } });
 expect(darkXml).toContain('background="#121212"');
});

test('canvas elements on light surfaces render legible borders, checkboxes, and quotes', async () => {
 const { drawElement } = await import('../draw/renderer.ts');
 const docCard = { ...rect, type: 'text', isDocCard: true, text: 'Heading\n---\n> quote\n- [ ] todo\n- [x] done', fill: '#ffffff', stroke: '#1f2937' };
 const { ctx, strokes, fills } = context();
 drawElement(ctx, docCard, { theme: 'light', lightCanvas: true });
 expect(strokes.some(s => s.color === '#d4d4d8')).toBe(true);
 expect(strokes.some(s => s.color === 'rgba(0, 0, 0, 0.12)')).toBe(true);
 expect(strokes.some(s => s.color === 'rgba(0, 0, 0, 0.35)')).toBe(true);
 expect(fills.some(f => f.color === '#4b5563')).toBe(true);
});

test('plus connection handles render in dim colors when idle and brighten on hover', async () => {
 const { drawConnectorHandles } = await import('../draw/renderer.ts');
 const { ctx, strokes, fills } = context();
 drawConnectorHandles(ctx, rect, 1, 'right', true);
 // Idle handles have dim translucent stroke / plus
 expect(strokes.some(s => s.color === 'rgba(59, 130, 246, 0.45)')).toBe(true);
 expect(strokes.some(s => s.color === 'rgba(59, 130, 246, 0.65)')).toBe(true);
 expect(fills.some(f => f.color === 'rgba(255, 255, 255, 0.9)')).toBe(true);
 // Active handle (right) has bright accent fill and stroke
 expect(fills.some(f => f.color === '#3B82F6')).toBe(true);
});

test('default text layout and font styling uses bolder font weight 500', async () => {
 const { layoutDocument, setFont } = await import('../draw/renderer.ts');
 const layout = layoutDocument(null, 'Normal writing', 16, 'sans');
 expect(layout.lines[0].fontWeight).toBe(500);
 const boldLayout = layoutDocument(null, 'Bold writing', 16, 'sans', { bold: true });
 expect(boldLayout.lines[0].fontWeight).toBe(700);

 const dummyCtx = { font: '' };
 setFont(dummyCtx, 16, 'sans');
 expect(dummyCtx.font).toContain('500');
});
