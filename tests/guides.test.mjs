import { test, expect } from 'bun:test';
import { smartGuides, drawSmartGuides } from '../draw/smartGuides.ts';
const box = (x, y, width = 100, height = 100) => ({ minX: x, minY: y, maxX: x + width, maxY: y + height });
test('edge and center alignment snap within a screen-constant tolerance', () => {
  expect(smartGuides(box(204, 100), [box(200, 400)], 1).dx).toBe(-4);
  expect(smartGuides(box(204, 100), [box(200, 400)], 2).dx).toBe(0);
  expect(smartGuides(box(204, 100), [box(200, 400)], 1, false).dx).toBe(0);
});
test('gap rulers report nearest objects and highlight equal spacing', () => {
  const result = smartGuides(box(140, 100), [box(0, 100), box(280, 100)], 1);
  expect(result.guides.filter(guide => guide.label).map(guide => guide.label)).toEqual(['= 40 px', '= 40 px']);
});
test('distant and empty targets do not create noisy alignment guides', () => {
  expect(smartGuides(box(100, 100), [], 1)).toEqual({ dx: 0, dy: 0, guides: [] });
  expect(smartGuides(box(100, 100), [box(100, 5000)], 1).guides).toEqual([]);
});


const alignment = result => result.guides.filter(guide => !guide.label);
test('equal-size neighbors show top, middle and bottom plus left, center and right',()=>{
 for(const zoom of [.25,.5,1,1.25,2,4]){
  const horizontal=alignment(smartGuides(box(3/zoom,3/zoom),[box(200,0)],zoom));
  expect(horizontal.filter(g=>g.y1===g.y2).map(g=>g.y1)).toEqual([0,50,100]);
  const vertical=alignment(smartGuides(box(3/zoom,3/zoom),[box(0,200)],zoom));
  expect(vertical.filter(g=>g.x1===g.x2).map(g=>g.x1)).toEqual([0,50,100]);
 }
});
test('each edge and center works independently for differently sized objects',()=>{
 for(const [y,height,expected]of [[0,60,0],[20,60,50],[40,60,100]]){
  expect(alignment(smartGuides(box(0,0),[box(200,y,100,height)])).map(g=>g.y1)).toEqual([expected]);
  expect(alignment(smartGuides(box(0,0),[box(y,200,height,100)])).map(g=>g.x1)).toEqual([expected]);
 }
});
test('coincident guides merge across all matching references without duplicates',()=>{
 const guides=alignment(smartGuides(box(0,0),[box(-200,0),box(200,0),box(200,0)]));
 expect(guides).toHaveLength(3);
 for(const guide of guides)expect(guide).toMatchObject({x1:-212,x2:312});
});
test('guides reflect the final snap and omit competing nearby alignments',()=>{
 const result=smartGuides(box(0,3),[box(200,0),box(350,5)]);
 expect(result.dy).toBe(2);expect(alignment(result).map(g=>g.y1)).toEqual([5,55,105]);
});
test('unsnapped creation and resize retain all exact guides without moving artwork',()=>{
 for(const zoom of [.5,1,2]){
  const result=smartGuides(box(-50,-25),[box(150,-25)],zoom,false);
  expect([result.dx,result.dy]).toEqual([0,0]);expect(alignment(result).map(g=>g.y1)).toEqual([-25,25,75]);
  expect(alignment(smartGuides(box(-50,-25+2/zoom),[box(150,-25)],zoom,false))).toEqual([]);
 }
});
test('spacing rulers measure all four margins and mark equal vertical gaps',()=>{
 const result=smartGuides(box(140,140),[box(0,140),box(280,140),box(140,0),box(140,280)]);
 expect(result.guides.filter(g=>g.label).map(g=>g.label)).toEqual(['= 40 px','= 40 px','= 40 px','= 40 px']);
});
test('red alignment guides paint every line with screen-constant dotted strokes',()=>{
 for(const zoom of [.5,1,2]){
  const strokes=[],dashes=[];let path;
  const ctx={save(){},restore(){},setLineDash(value){dashes.push(value);},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},stroke(){strokes.push(path);}};
  const guides=alignment(smartGuides(box(0,0),[box(200,0)],zoom));drawSmartGuides(ctx,guides,zoom);
  expect(strokes).toHaveLength(3);expect(dashes).toEqual(Array(3).fill([4/zoom,3/zoom]));expect(ctx.lineWidth).toBe(1/zoom);expect(ctx.strokeStyle).toBe('#f87171');
 }
});
