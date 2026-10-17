export interface NoteEdit { value: string; start: number; end: number }
export type NoteFormat = 'heading' | 'bold' | 'italic' | 'bullet' | 'checklist' | 'code' | 'quote';
function replace(value:string,start:number,end:number,text:string,selectionStart=start+text.length,selectionEnd=selectionStart):NoteEdit {
  return {value:value.slice(0,start)+text+value.slice(end),start:selectionStart,end:selectionEnd};
}
export function formatNotes(value:string,start:number,end:number,format:NoteFormat):NoteEdit {
  const selected=value.slice(start,end);
  if(format==='bold'||format==='italic'){
    const mark=format==='bold'?'**':'*';
    if(value.slice(Math.max(0,start-mark.length),start)===mark&&value.slice(end,end+mark.length)===mark&&start>=mark.length)
      return replace(value,start-mark.length,end+mark.length,selected,start-mark.length,end-mark.length);
    return replace(value,start,end,mark+selected+mark,start+mark.length,end+mark.length);
  }
  const lineStart=(start===0?0:value.lastIndexOf('\n',start-1)+1);
  const last=end>start&&value[end-1]==='\n'?end-1:end;
  const nextBreak=value.indexOf('\n',last),lineEnd=nextBreak<0?value.length:nextBreak;
  if(format==='code'){
    const content=selected||value.slice(lineStart,lineEnd),from=selected?start:lineStart,to=selected?end:lineEnd;
    const before=(from>0&&value[from-1]!=='\n'?'\n':'')+'```\n';
    const after='\n```'+(to<value.length&&value[to]!=='\n'?'\n':'');
    return replace(value,from,to,before+content+after,from+before.length,from+before.length+content.length);
  }
  const prefix={heading:'# ',bullet:'- ',checklist:'- [ ] ',quote:'> '}[format];
  const lines=value.slice(lineStart,lineEnd).split('\n');
  const strip=(line:string)=>line.replace(/^( *)(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+|>\s?)/,'$1');
  const all=lines.every(line=>line.trimStart().startsWith(prefix));
  const text=lines.map(line=>{const plain=strip(line);return all?plain:plain.replace(/^( *)/,`$1${prefix}`);}).join('\n');
  const result=replace(value,lineStart,lineEnd,text,lineStart,lineStart+text.length);
  if(start===end){result.start=result.end=Math.max(lineStart,start+(text.length-(lineEnd-lineStart)));}
  return result;
}
export function indentNotes(value:string,start:number,end:number,outdent=false):NoteEdit {
  if(!outdent&&start===end)return replace(value,start,end,'  ');
  const from=(start===0?0:value.lastIndexOf('\n',start-1)+1),last=end>start&&value[end-1]==='\n'?end-1:end;
  const next=value.indexOf('\n',last),to=next<0?value.length:next;
  const lines=value.slice(from,to).split('\n');
  const changes=lines.map(line=>outdent?-(line.match(/^(?: {1,2}|\t)/)?.[0].length||0):2);
  const text=lines.map((line,i)=>outdent?line.slice(-changes[i]):'  '+line).join('\n');
  return replace(value,from,to,text,Math.max(from,start+changes[0]),Math.max(from,end+changes.reduce((a,b)=>a+b,0)));
}
export function continueNoteList(value:string,start:number,end:number):NoteEdit|null {
  const from=(start===0?0:value.lastIndexOf('\n',start-1)+1),current=value.slice(from,start);
  const match=current.match(/^( *)([-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)(.*)$/);
  if(!match)return null;
  // A caret in the marker itself must keep normal Enter behavior.
  if(!match[3].trim()&&value.slice(start,value.indexOf('\n',start)<0?value.length:value.indexOf('\n',start)).trim())return null;
  if(!match[3].trim())return replace(value,from,end,'');
  let prefix=match[2].replace(/\[[xX]\]/,'[ ]');
  if(/^\d+\./.test(prefix))prefix=`${parseInt(prefix,10)+1}. `;
  return replace(value,start,end,'\n'+match[1]+prefix);
}
/** Match the Markdown renderer: headings inside fenced code are not document sections. */
export function noteHeadings(value:string){
  const result:{text:string;start:number;end:number;level:number}[]=[];let offset=0,fence='';
  for(const line of value.split('\n')){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
    if(fence){if(new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line))fence='';}
    else if(marker)fence=marker[1];
    else {const heading=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);if(heading)result.push({text:heading[2].replace(/\s+#+\s*$/,''),start:offset,end:offset+line.length,level:heading[1].length});}
    offset+=line.length+1;
  }
  return result;
}
