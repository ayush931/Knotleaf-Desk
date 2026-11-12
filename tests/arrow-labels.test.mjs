import {test,expect} from 'bun:test';
import {getBendHandle,arrowLabelLayout,arrowLabelColors,ARROW_LABEL_FONT_SIZE,drawElement,getElementBounds,computeArrowPath} from '../draw/renderer.ts';
const arrow={id:'labelled',type:'arrow',x:0,y:0,width:80,height:0,startX:0,startY:0,endX:80,endY:0,stroke:'#ef4444',strokeWidth:2,strokeStyle:'solid',fill:'transparent',fillStyle:'none',roundness:'rounded',opacity:1,zIndex:0,routing:'straight',label:'A readable request label'};
function context(){const text=[];const plates=[];const obj={measureText:value=>({width:Array.from(value).length*8}),fillText(value,x,y){text.push({value,x,y,font:this.font,color:this.fillStyle});},roundRect(x,y,w,h){plates.push({x,y,w,h});}};return {ctx:new Proxy(obj,{get:(value,key)=>key in value?value[key]:()=>{}}),text,plates};}
test('arrow labels use larger text and wrap multiline or long tokens into a padded measured box',()=>{
 const {ctx}=context();expect(ARROW_LABEL_FONT_SIZE).toBe(16);const at={x:100,y:200};
 for(const value of ['HTTP request','First line\nSecond line','https://example.com/'+'long'.repeat(100)]){
  const layout=arrowLabelLayout(value,at,ctx);expect(layout.width).toBeLessThanOrEqual(264);expect(layout.width).toBeGreaterThanOrEqual(48);expect(layout.height).toBe(layout.lines.length*20+12);expect(layout.bounds.minX+layout.width/2).toBe(at.x);expect(layout.bounds.minY+layout.height/2).toBe(at.y);
  expect(layout.lines.every(line=>ctx.measureText(line).width<=240)).toBe(true);
 }
});
test('labels paint opaque contrast plates and readable text independently of the arrow color',()=>{
 for(const theme of ['light','dark']){
  const {ctx,text,plates}=context();drawElement(ctx,{...arrow,label:'First\nSecond'},{theme});expect(plates.at(-1).h).toBe(52);expect(text.map(row=>row.value)).toEqual(['First','Second']);expect(text.every(row=>row.font.startsWith('600 16px'))).toBe(true);expect(text.every(row=>row.color===arrowLabelColors(theme).ink)).toBe(true);expect(arrowLabelColors(theme).background).toMatch(/^#[0-9a-f]{6}$/i);
 }
});
test('connector bounds include the full label so long or multiline labels are not cropped',()=>{
 const labelled={...arrow,label:'A long line of text that wraps onto several lines\nAnother line'};const at=computeArrowPath(labelled).labelPt,label=arrowLabelLayout(labelled.label,at),bounds=getElementBounds(labelled);
 expect(bounds.minX).toBeLessThanOrEqual(label.bounds.minX);expect(bounds.maxX).toBeGreaterThanOrEqual(label.bounds.maxX);expect(bounds.minY).toBeLessThanOrEqual(label.bounds.minY);expect(bounds.maxY).toBeGreaterThanOrEqual(label.bounds.maxY);
 expect(labelled).toEqual({...arrow,label:labelled.label});
});


test('bend handles stay outside label text at every zoom while unlabeled arrows retain their midpoint',()=>{
 for(const zoom of [.25,.5,1,2,4]){const label=arrowLabelLayout(arrow.label,computeArrowPath(arrow).labelPt),handle=getBendHandle(arrow,zoom);expect(handle.y+4.5/zoom).toBeLessThan(label.bounds.minY);}
 expect(getBendHandle({...arrow,label:undefined})).toEqual(computeArrowPath(arrow).midPt);
});


test('moving an unchanged label reuses its measured text instead of measuring each frame',()=>{
 let count=0;const {ctx}=context();ctx.measureText=value=>{count++;return {width:value.length*8};};
 const first=arrowLabelLayout('A frequently moved label',{x:100,y:200},ctx),measured=count;const second=arrowLabelLayout('A frequently moved label',{x:300,y:500},ctx);
 expect(count).toBe(measured);expect(second.width).toBe(first.width);expect(second.bounds.minX-first.bounds.minX).toBe(200);expect(second.bounds.minY-first.bounds.minY).toBe(300);
});
