/** Read contenteditable text without losing browser-created block and BR line breaks. */
export function editableText(root: Node, prefix = false): string {
 const children = Array.from(root.childNodes).filter(node => !(node.nodeType === 1 && (node as Element).hasAttribute('data-editor-caret')));
 if (!prefix && children.length === 1 && children[0].nodeType === 1 && (children[0] as Element).tagName === 'BR') return '';
 let text = '', previous: {text:string;block:boolean}|undefined;
 for (const child of children) {
  const element = child.nodeType === 1 ? child as Element : null;
  const block = !!element && /^(DIV|P|LI)$/.test(element.tagName);
  const value = child.nodeType === 3 ? child.textContent || '' : element?.tagName === 'BR' ? '\n' : editableText(child);
  if (previous && (block || previous.block) && !previous.text.endsWith('\n')) text += '\n';
  text += value; previous = {text:value,block};
 }
 return text;
}

export interface TextChange {start:number;end:number;text:string}
export interface TextEdit { text:string;start:number;end:number;changes?:TextChange[] }
/** The same Enter/Tab transaction is used for hardware and software keyboard input. */
export function textEdit(text:string,start:number,end:number,command:'enter'|'indent'|'outdent',soft=false): TextEdit {
 start=Math.max(0,Math.min(text.length,start));end=Math.max(start,Math.min(text.length,end));
 const lineStart=start===0?0:text.lastIndexOf('\n',start-1)+1;
 if(command==='enter'){
  const line=text.slice(lineStart,start);
  const empty=line.match(/^(\s*)([•○▪◆–→*\-]|\d+\.|\[[ xX]\])\s*$/);
  if(!soft&&start===end&&empty){const caret=lineStart+empty[1].length;return {text:text.slice(0,lineStart)+empty[1]+text.slice(end),start:caret,end:caret};}
  let prefix='';
  if(!soft){
   const bullet=line.match(/^(\s*)([•○▪◆–→*\-])\s+(.+)$/),number=line.match(/^(\s*)(\d+)\.\s+(.+)$/),todo=line.match(/^(\s*)\[[ xX]\]\s+(.+)$/);
   if(bullet)prefix=bullet[1]+bullet[2]+' ';else if(number)prefix=number[1]+(Number(number[2])+1)+'. ';else if(todo)prefix=todo[1]+'[ ] ';
  }
  const insert='\n'+prefix,caret=start+insert.length;return {text:text.slice(0,start)+insert+text.slice(end),start:caret,end:caret};
 }
 const last=end>start&&text[end-1]==='\n'?end-1:end;
 const changes:{at:number;remove:number;insert:string}[]=[];
 for(let at=lineStart;at<=last;){
  const remove=command==='outdent'?(text.slice(at).match(/^( {1,2}|\t)/)?.[0].length||0):0;
  if(command==='indent'||remove)changes.push({at,remove,insert:command==='indent'?'  ':''});
  const next=text.indexOf('\n',at);if(next<0||next>=last)break;at=next+1;
 }
 let next=text;for(const change of [...changes].reverse())next=next.slice(0,change.at)+change.insert+next.slice(change.at+change.remove);
 const offset=(position:number)=>{let delta=0;for(const change of changes){if(change.at>position)break;delta+=change.insert.length-Math.min(change.remove,Math.max(0,position-change.at));}return position+delta;};
 return {text:next,start:offset(start),end:offset(end),changes:changes.map(change=>({start:change.at,end:change.at+change.remove,text:change.insert}))};
}
