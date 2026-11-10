import {test,expect} from 'bun:test';
import {TEMPLATES} from '../draw/templatesData.ts';
import {DEFAULT_STYLE} from '../draw/types.ts';
import {sceneFontFamilies} from '../draw/fonts.ts';
test('built-in drawing-board content uses the handwriting font and preloads it for exports',()=>{
 expect(DEFAULT_STYLE.fontFamily).toBe('hand');expect(sceneFontFamilies([])).toContain('hand');
 const lettering=TEMPLATES.flatMap(t=>t.elements).filter(el=>el.type==='text'&&!el.isCodeCard||el.type==='sticky');
 expect(lettering.length).toBeGreaterThan(20);expect(lettering.every(el=>el.fontFamily==='hand')).toBe(true);
});


test('new drawings and template shapes default to hand-drawn ink',()=>{
 expect(DEFAULT_STYLE.strokeStyle).toBe('rough');
 const shapes=TEMPLATES.flatMap(t=>t.elements).filter(el=>['rectangle','diamond','circle','arrow'].includes(el.type));
 expect(shapes.length).toBeGreaterThan(20);expect(shapes.every(el=>el.strokeStyle==='rough')).toBe(true);
});
test('sketched straight, bent and curved connectors keep stable ink and source geometry',async()=>{
 const {drawElement}=await import('../draw/renderer.ts');
 for(const type of ['line','arrow'])for(const routing of ['straight','elbow','curved']){
  if(type==='line'&&routing==='elbow')continue;
  const el={...DEFAULT_STYLE,id:'sketch',type,routing,bendOffset:routing==='curved'?80:undefined,x:10,y:20,width:200,height:120,startX:10,startY:20,endX:210,endY:140};
  let commands=[];const ctx=new Proxy({globalAlpha:1,save(){},restore(){},measureText:t=>({width:t.length*7}),beginPath(){commands.push(['begin']);},moveTo(...v){commands.push(['move',...v]);},quadraticCurveTo(...v){commands.push(['curve',...v]);},stroke(){commands.push(['stroke']);}}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const original=JSON.stringify(el);drawElement(ctx,el,{theme:'dark'});const first=commands;commands=[];drawElement(ctx,el,{theme:'dark'});
  expect(commands).toEqual(first);expect(first.filter(c=>c[0]==='curve').length).toBeGreaterThan(1);expect(JSON.stringify(el)).toBe(original);
 }
});


test('bright board defaults preserve explicit custom colors, including black',async()=>{
 const {canvasBackground}=await import('../draw/canvasAppearance.ts');
 for(const theme of ['light','dark'])for(const fill of ['#000000','#e6f4ff','#d946ef']){
  const custom={fill,fillStyle:'solid',fillOpacity:1};expect(canvasBackground(custom,theme)).toEqual(custom);
 }
});
