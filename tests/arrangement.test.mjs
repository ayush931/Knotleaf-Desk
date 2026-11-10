import { test, expect } from 'bun:test';
import { arrangementDeltas, arrangementTargets } from '../draw/arrangement.ts';
import { getElementBounds } from '../draw/renderer.ts';
const box=(id,x,y,width=100,height=60)=>({id,type:'rectangle',x,y,width,height,stroke:'#fff',strokeWidth:2,fill:'transparent',fillStyle:'none',opacity:1});
const selection=[box('a',0,20,100,60),box('b',220,170,40,100),box('c',400,400,80,40)];
function moved(mode){const deltas=arrangementDeltas(selection,mode);return selection.map(el=>{const d=deltas.get(el.id)||{x:0,y:0};return getElementBounds({...el,x:el.x+d.x,y:el.y+d.y});});}
test('six alignments match visible selection edges and centers without mutation',()=>{
 const original=JSON.stringify(selection);
 for(const mode of ['left','center','right','top','middle','bottom']){
  const b=moved(mode),values=b.map(v=>mode==='left'?v.minX:mode==='right'?v.maxX:mode==='top'?v.minY:mode==='bottom'?v.maxY:mode==='center'?(v.minX+v.maxX)/2:(v.minY+v.maxY)/2);
  expect(values.every(v=>Math.abs(v-values[0])<1e-7)).toBe(true);
 }
 expect(JSON.stringify(selection)).toBe(original);
});
test('horizontal and vertical distribution preserve endpoints and equalize gaps for unequal sizes',()=>{
 for(const mode of ['horizontal','vertical']){
  const b=moved(mode),min=mode==='horizontal'?'minX':'minY',max=mode==='horizontal'?'maxX':'maxY';
  expect(b[1][min]-b[0][max]).toBeCloseTo(b[2][min]-b[1][max]);
  expect(b[0]).toEqual(getElementBounds(selection[0]));expect(b[2]).toEqual(getElementBounds(selection[2]));
 }
});
test('attached text does not become a separate layout target when its parent is selected',()=>{
 const text={...box('label',12,32),type:'text',text:'Label',containerId:'a',fontSize:20,fontFamily:'sans'};
 expect(arrangementTargets([...selection,text,{...box('arrow',0,0),type:'arrow'}]).map(el=>el.id)).toEqual(['a','b','c']);
 expect(arrangementTargets([text,selection[1]]).map(el=>el.id)).toEqual(['label','b']);
});
test('insufficient or already aligned selections are no-ops',()=>{
 expect(arrangementDeltas(selection.slice(0,1),'left').size).toBe(0);expect(arrangementDeltas(selection.slice(0,2),'vertical').size).toBe(0);
 expect(arrangementDeltas([box('a',0,0),box('b',0,200)],'left').size).toBe(0);
});
test('code cards align their visible padded edges with other objects',()=>{
 const code={...box('code',200,100),type:'text',isCodeCard:true,text:'let x=1',fontSize:16,fontFamily:'mono'};
 const deltas=arrangementDeltas([selection[0],code],'left'),d=deltas.get('code');
 expect(getElementBounds({...code,x:code.x+d.x,y:code.y+d.y}).minX).toBe(getElementBounds(selection[0]).minX);
});
