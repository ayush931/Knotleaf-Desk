/** One token palette for the inline editor, canvas and image/vector exports. */
export const CODE_COLORS = {
  dark: {text:'#e2e8f0',keyword:'#c792ea',literal:'#ffb86c',string:'#9ece6a',comment:'#94a3b8',number:'#f6b26b',title:'#82aaff',type:'#f2cf82',built_in:'#7dcfff',attr:'#89c4f4',variable:'#e2e8f0',params:'#e2e8f0',regexp:'#f7768e',operator:'#89ddff',punctuation:'#cbd5e1',tag:'#f07178',name:'#f07178',meta:'#bb9af7',symbol:'#ffb86c',attribute:'#89c4f4'},
  light: {text:'#243247',keyword:'#7c3aed',literal:'#9a4b00',string:'#24713a',comment:'#64748b',number:'#9a4b00',title:'#1d4ed8',type:'#795214',built_in:'#006b76',attr:'#075985',variable:'#243247',params:'#243247',regexp:'#be185d',operator:'#155e75',punctuation:'#475569',tag:'#b91c1c',name:'#b91c1c',meta:'#6d28d9',symbol:'#9a4b00',attribute:'#075985'}
} as const;
export function codeTokenColor(classNames: string, light = false): string | undefined {
  const kind=classNames.split(/\s+/).find(name=>name.startsWith('hljs-'))?.slice(5);
  const palette=light?CODE_COLORS.light:CODE_COLORS.dark;
  return kind && kind in palette ? palette[kind as keyof typeof palette] : undefined;
}
const lightByDark = new Map<string,string>((Object.keys(CODE_COLORS.dark) as (keyof typeof CODE_COLORS.dark)[]).map(kind=>[CODE_COLORS.dark[kind],CODE_COLORS.light[kind]]));
export function lightSyntaxColor(color:string):string {
  return lightByDark.get(color.toLowerCase()) || color;
}
