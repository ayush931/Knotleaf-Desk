import {test,expect} from 'bun:test';
import {drawElement,getElementBounds,getSelectionPadding,getElementAnchors} from '../draw/renderer';
import {DEFAULT_STYLE} from '../draw/types';
const base={...DEFAULT_STYLE,id:'card',x:100,y:100,width:240,height:100,opacity:1,zIndex:0,text:'A document\nSecond line',fontSize:16,fontFamily:'sans',textAlign:'left',fill:'#18181b',fillStyle:'solid'};
for(const kind of ['document','code','sticky'])test(`${kind} painted border selection and connector anchors share bounds`,()=>{
 const el={...base,type:kind==='sticky'?'sticky':'text',isDocCard:kind!=='sticky',isCodeCard:kind==='code'};
 const boxes=[],state={roundRect:(...args)=>boxes.push(args),measureText:text=>({width:text.length*9}),save(){},restore(){}};
 const ctx=new Proxy(state,{get:(o,k)=>k in o?o[k]:()=>{}});drawElement(ctx,el,{theme:'dark'});
 const b=getElementBounds(el);expect(boxes[0].slice(0,4)).toEqual([b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY]);
 for(const zoom of [.25,1,3])expect(getSelectionPadding(el,zoom)).toBe(0);
 const ports=getElementAnchors(el);expect(ports.find(p=>p.anchor==='right').x).toBe(b.maxX);expect(ports.find(p=>p.anchor==='left').x).toBe(b.minX);
});
