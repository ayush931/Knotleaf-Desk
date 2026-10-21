import { test, expect } from 'bun:test';
import { liveHighlights, readHighlights, HIGHLIGHTER_LIMIT } from '../draw/highlighter.ts';

test('highlighter points expire after 200ms and retained work is bounded', () => {
  expect(liveHighlights([{x:1,y:1,at:1800},{x:2,y:2,at:1801}],2000)).toEqual([{x:2,y:2,at:1801}]);
  expect(liveHighlights(Array.from({length:1000},(_,x)=>({x,y:0,at:2000})),2000)).toHaveLength(HIGHLIGHTER_LIMIT);
});
test('presence validates points and translates ages across different clocks', () => {
  const packet={sequence:4,sentAt:10000,points:[{x:2,y:3,at:9900,start:true},{x:3,y:4,at:10000}]};
  expect(readHighlights(packet,2000).points).toEqual([{x:2,y:3,at:1900,start:true},{x:3,y:4,at:2000,start:false}]);
  for(const value of [null,{}, {...packet,points:[{x:NaN,y:3,at:10000}]},{...packet,points:Array(161).fill(packet.points[0])}])expect(readHighlights(value)).toBeNull();
});
