import {test,expect,afterAll} from 'bun:test';
import {Window} from 'happy-dom';
import {editableText,textEdit} from '../lib/editableText.ts';
const browser=new Window();afterAll(()=>browser.close());
test('native editable blocks and BRs retain real newlines but ignore caret placeholders',()=>{
 const root=browser.document.createElement('div');
 for(const [html,expected]of [
  ['<span>First</span><div><span>Second</span></div>','First\nSecond'],
  ['<div>First</div><div>Second</div>','First\nSecond'],
  ['<div>First<br></div><div>Second</div>','First\nSecond'],
  ['<div>First</div><div><br></div><div>Third</div>','First\n\nThird'],
  ['<span>First\n</span><br data-editor-caret="true">','First\n'],
  ['First<br><br>','First\n\n'],['<br>',''],['<div><br></div>',''],
 ]){root.innerHTML=html;expect(editableText(root)).toBe(expected);}
 root.innerHTML='<span>First</span><div>Second</div>';const prefix=browser.document.createRange();prefix.selectNodeContents(root);prefix.setEnd(root.lastChild.firstChild,0);expect(editableText(prefix.cloneContents(),true).length).toBe(6);
});
test('Enter continues and exits lists consistently, and Shift+Enter makes a simple line break',()=>{
 for(const text of ['- First','* First','• First','1. First','[x] First']){const next=textEdit(text,text.length,text.length,'enter');expect(next.text).toBe(text+'\n'+(text.startsWith('1.')?'2. ':text.startsWith('[x]')?'[ ] ':text[0]+' '));expect(next.start).toBe(next.text.length);expect(textEdit(next.text,next.start,next.end,'enter').text).toBe(text+'\n');expect(textEdit(text,text.length,text.length,'enter',true).text).toBe(text+'\n');}
 expect(textEdit('hello world',6,11,'enter')).toEqual({text:'hello \n',start:7,end:7});
});
test('Tab and Shift+Tab affect all selected lines and retain the intended selection',()=>{
 const value='First\nSecond\nThird';const indented=textEdit(value,0,13,'indent');expect(indented).toMatchObject({text:'  First\n  Second\nThird',start:2,end:17});
 expect(textEdit(indented.text,indented.start,indented.end,'outdent')).toMatchObject({text:value,start:0,end:13});
 expect(textEdit('  First',4,4,'outdent')).toMatchObject({text:'First',start:2,end:2});
});
