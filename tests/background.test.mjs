import { test, expect } from 'bun:test';
import { parseFillColor } from '../lib/fillColor.ts';
import { drawBackgroundFill, drawCanvasBackground } from '../draw/backgroundFill.ts';
import { drawElement } from '../draw/renderer.ts';
import { normalizeBackground, DEFAULT_BACKGROUND, isLightBackground } from '../lib/background.mjs';
import { serializeProject, readProjectPayload } from '../lib/projectFile.ts';
function context() {
  const stack = [], fills = [], strokes = [], clips = [], lines = [], dots = [];
  const target = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); }, restore() { Object.assign(this, stack.pop()); },
    fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); }, stroke() { strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha }); }, clip() { clips.push(true); }, lineTo(...p) { lines.push(p); }, arc(...p) { dots.push(p); }
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
