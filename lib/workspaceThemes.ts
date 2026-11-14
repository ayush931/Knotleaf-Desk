import type { CSSProperties } from 'react';
import type { Theme } from '@/draw/types';
/** Ids are stored preferences: 'paper' is Blossom and 'citrus' is Neon. */
export const WORKSPACE_THEMES = [
 {id:'board',name:'Whiteboard',description:'Clean board white with marker blue, green and red accents.'},
 {id:'black',name:'Studio',description:'Clear white or ink black, cobalt tools, mint and coral details.'},
 {id:'mono',name:'Tide',description:'Sea-glass surfaces with teal, sky and soft apricot.'},
 {id:'paper',name:'Blossom',description:'Petal white or deep plum with rose, mint and apricot.'},
 {id:'slate',name:'Iris',description:'Lavender surfaces with violet, periwinkle and rose.'},
 {id:'forest',name:'Meadow',description:'Fresh sage with evergreen, ochre and cornflower.'},
 {id:'aurora',name:'Aurora',description:'Deep northern night with cyan light and soft sky accents.'},
 {id:'citrus',name:'Neon',description:'Cool white or near-black with electric lime, cyan and pink.'},
 {id:'claude',name:'Claude',description:'Claude ivory or warm charcoal with Claude terracotta, olive and sky accents.'},
] as const;
export type WorkspaceTheme = typeof WORKSPACE_THEMES[number]['id'];
export type LogoStyle = 'theme' | 'black';
export type ThemeScope = 'canvas' | 'notes' | 'both';
export interface WorkspaceThemes {canvas:WorkspaceTheme;notes:WorkspaceTheme;notesMode?:Theme}
export interface WorkspacePalette {background:string;panel:string;border:string;ink:string;muted:string;accent:string;accentInk:string;code:string}
const palette=(background:string,panel:string,border:string,ink:string,muted:string,accent:string,accentInk:string,code:string):WorkspacePalette=>({background,panel,border,ink,muted,accent,accentInk,code});
const palettes:Record<WorkspaceTheme,Record<Theme,WorkspacePalette>>={
 board:{dark:palette('#1b2026','#232a31','#3e4853','#eef3f7','#a9b5c1','#7fb2ff','#0b1420','#151a1f'),light:palette('#fbfcfd','#ffffff','#cdd5dd','#18212c','#566170','#1d5bd6','#ffffff','#eef2f6')},
 mono:{dark:palette('#10232c','#17313b','#416573','#f0fbff','#b5d0da','#5ee0c1','#082c28','#0b1b23'),light:palette('#f0f9fc','#ffffff','#a8cbd6','#12313e','#476571','#096956','#ffffff','#e0eff4')},
 black:{dark:palette('#000000','#000000','#2e3a4d','#ffffff','#b8b8b8','#8eb4ff','#000000','#090b0f'),light:palette('#ffffff','#ffffff','#c5cfdd','#000000','#525252','#305db5','#ffffff','#f7f8fa')},
 paper:{dark:palette('#1f0f18','#2a1522','#6b3a55','#fff0f6','#d9b3c6','#f9a8d4','#3a0b24','#170a12'),light:palette('#fff6f9','#ffffff','#f1c9d8','#3a1028','#7a4a62','#be185d','#ffffff','#fdeef4')},
 slate:{dark:palette('#1b1928','#252237','#57516d','#f5f1ff','#c2bad7','#c2b0ff','#211a3d','#14111f'),light:palette('#f7f5ff','#fdfcff','#d2cbe5','#29223b','#665b79','#7051b8','#ffffff','#efebf8')},
 forest:{dark:palette('#14211b','#1d2e25','#4d6f5b','#effaf2','#b0cdb8','#b0e0bd','#102619','#0d1711'),light:palette('#f3f8f2','#fcfff9','#bfd1bd','#233326','#52694f','#32613d','#ffffff','#e3efe1')},
 aurora:{dark:palette('#071318','#0d1f26','#2c5563','#effcff','#a9ccd6','#67e8f9','#052028','#06121a'),light:palette('#f5fcff','#ffffff','#bfe2ea','#0c2530','#4b6f7b','#0e7490','#ffffff','#e6f6fa')},
 citrus:{dark:palette('#07080a','#0f1114','#2c333a','#f4f7f0','#a9b1a3','#c6f432','#0b1000','#050607'),light:palette('#f6f8f2','#ffffff','#cfd8c2','#10140c','#545d4b','#456f0c','#ffffff','#edf1e6')},
 claude:{dark:palette('#1f1e1d','#262624','#4a4945','#faf9f5','#c2c0b6','#eba085','#1f1e1d','#191918'),light:palette('#faf9f5','#ffffff','#dedcd1','#141413','#6a6964','#a9502d','#ffffff','#f0eee6')}
};
/** Clay was renamed to Claude; saved Clay choices keep working. */
export function normalizeWorkspaceTheme(value:unknown):WorkspaceTheme{if(value==='clay')return 'claude';return WORKSPACE_THEMES.some(t=>t.id===value)?value as WorkspaceTheme:'black';}
export function normalizeWorkspaceThemes(value:unknown):WorkspaceThemes{const v=value&&typeof value==='object'?value as Partial<WorkspaceThemes>:{};return {canvas:normalizeWorkspaceTheme(v.canvas),notes:normalizeWorkspaceTheme(v.notes),...(v.notesMode==='dark'||v.notesMode==='light'?{notesMode:v.notesMode}:{})};}
export function workspacePalette(preset:WorkspaceTheme,mode:Theme){return palettes[normalizeWorkspaceTheme(preset)][mode];}
export function applyWorkspaceTheme(current:WorkspaceThemes,preset:WorkspaceTheme,scope:ThemeScope):WorkspaceThemes{return {...current,...(scope!=='notes'?{canvas:preset}:{}),...(scope!=='canvas'?{notes:preset}:{}),...(scope==='both'?{notesMode:undefined}:{})};}
export type WorkspaceThemeStyle = CSSProperties & { [key: `--${string}`]: string };
export function workspaceThemeStyle(preset:WorkspaceTheme,mode:Theme,notes=false,logo:LogoStyle='theme'):WorkspaceThemeStyle {
 const p=workspacePalette(preset,mode),controls=workspaceControlPalette(mode,preset);
 const values:Record<string,string>=notes?{'--notes-bg':p.background,'--notes-panel':p.panel,'--notes-border':controls.border,'--notes-ink':p.ink,'--notes-muted':p.muted,'--notes-code':p.code,'--reader-link':p.accent,'--notes-token-keyword':mode==='light'?'#6b3f87':'#b8a8c4','--notes-token-string':mode==='light'?'#356330':'#afbaa8','--notes-token-comment':mode==='light'?'#606975':'#a3a3a3','--notes-token-number':mode==='light'?'#895824':'#d4b38c','--notes-token-title':mode==='light'?'#285a86':'#9ebbd4'}:{};
 return {...(notes?{colorScheme:mode}:{}),...values,...Object.fromEntries(Object.entries(controls).map(([key,value])=>[`--ui-${key}`,value])),'--drawing-panel':p.panel,'--drawing-border':controls.border,'--ui-accent':p.accent,'--ui-accent-ink':p.accentInk,'--ui-ink':p.ink,'--ui-muted':p.muted,'--ui-inset':p.code,'--ui-background':p.background,'--ui-brand':logo==='black'?'#000000':controls.brand,'--ui-brand-bg':logo==='black'?'#ffffff':p.panel};
}

/** Blend one theme accent into the neutral surface; roles differ by emphasis, not hue. */
function mixHex(base:string,accent:string,weight:number){const channel=(offset:number)=>Math.round(parseInt(base.slice(offset,offset+2),16)*(1-weight)+parseInt(accent.slice(offset,offset+2),16)*weight).toString(16).padStart(2,'0');return '#'+[1,3,5].map(channel).join('');}
export function workspaceControlPalette(mode:Theme,presetValue:WorkspaceTheme|string='black'){
 const preset=normalizeWorkspaceTheme(presetValue),p=workspacePalette(preset,mode),support=({board:['#2f9e5b','#e5484d'],black:['#62cdb3','#edaa80'],mono:['#82baf0','#e8b58e'],paper:['#6ec8a8','#f4a261'],slate:['#8ebed9','#d7a0bb'],forest:['#c5b36c','#90b5df'],aurora:['#7dd3fc','#f0abfc'],citrus:['#22d3ee','#f472b6'],claude:['#788c5d','#6a9bcc']} as const)[preset],hover=mixHex(p.panel,p.ink,mode==='dark'?.065:.035),active=mixHex(p.panel,p.accent,mode==='dark'?.14:.065),primary=mixHex(p.panel,p.accent,mode==='dark'?.19:.09);
 return {secondary:support[0],tertiary:support[1],surface:mixHex(p.panel,p.ink,mode==='dark'?.035:0),control:p.panel,'control-ink':p.ink,hover,'hover-ink':p.ink,active,'active-ink':p.accent,
  success:mixHex(p.panel,support[0],.12),'success-ink':p.ink,pending:mixHex(p.panel,support[1],.12),'pending-ink':p.ink,
  danger:p.panel,'danger-ink':p.ink,info:primary,'info-ink':p.accent,
  brand:preset==='black'||preset==='slate'||preset==='board'?(mode==='dark'?'#3b82f6':'#2563eb'):p.accent,
  border:mixHex(p.panel,p.ink,mode==='dark'?.19:.16),outline:mixHex(p.panel,p.accent,mode==='dark'?.45:.35),focus:p.accent};
}

