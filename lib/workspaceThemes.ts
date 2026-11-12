import type { CSSProperties } from 'react';
import type { Theme } from '@/draw/types';
export const WORKSPACE_THEMES = [
 {id:'black',name:'Studio',description:'Clear white or ink black, cobalt tools, mint and coral details.'},
 {id:'mono',name:'Tide',description:'Sea-glass surfaces with teal, sky and soft apricot.'},
 {id:'paper',name:'Parchment',description:'Ivory paper, terracotta, olive and warm graphite.'},
 {id:'slate',name:'Iris',description:'Lavender surfaces with violet, periwinkle and rose.'},
 {id:'forest',name:'Meadow',description:'Fresh sage with evergreen, ochre and cornflower.'},
 {id:'aurora',name:'Aurora',description:'Deep violet with lilac, aqua and rose light.'},
 {id:'citrus',name:'Citrus',description:'Golden ink with amber, lime and burnt orange.'},
 {id:'clay',name:'Clay',description:'Warm paper or soft charcoal with restrained terracotta accents.'},
] as const;
export type WorkspaceTheme = typeof WORKSPACE_THEMES[number]['id'];
export type LogoStyle = 'theme' | 'black';
export type ThemeScope = 'canvas' | 'notes' | 'both';
export interface WorkspaceThemes {canvas:WorkspaceTheme;notes:WorkspaceTheme;notesMode?:Theme}
export interface WorkspacePalette {background:string;panel:string;border:string;ink:string;muted:string;accent:string;accentInk:string;code:string}
const palette=(background:string,panel:string,border:string,ink:string,muted:string,accent:string,accentInk:string,code:string):WorkspacePalette=>({background,panel,border,ink,muted,accent,accentInk,code});
const palettes:Record<WorkspaceTheme,Record<Theme,WorkspacePalette>>={
 mono:{dark:palette('#10232c','#17313b','#416573','#f0fbff','#b5d0da','#5ee0c1','#082c28','#0b1b23'),light:palette('#f0f9fc','#ffffff','#a8cbd6','#12313e','#476571','#096956','#ffffff','#e0eff4')},
 black:{dark:palette('#000000','#000000','#2e3a4d','#ffffff','#b8b8b8','#8eb4ff','#000000','#090b0f'),light:palette('#ffffff','#ffffff','#c5cfdd','#000000','#525252','#305db5','#ffffff','#f7f8fa')},
 paper:{dark:palette('#211e19','#2c2720','#62584a','#faf4e9','#c9bfae','#f0b397','#241c10','#171510'),light:palette('#fbf7f0','#fffdf9','#d8cabb','#302821','#706052','#a5482c','#ffffff','#eee6d6')},
 slate:{dark:palette('#1b1928','#252237','#57516d','#f5f1ff','#c2bad7','#c2b0ff','#211a3d','#14111f'),light:palette('#f7f5ff','#fdfcff','#d2cbe5','#29223b','#665b79','#7051b8','#ffffff','#efebf8')},
 forest:{dark:palette('#14211b','#1d2e25','#4d6f5b','#effaf2','#b0cdb8','#b0e0bd','#102619','#0d1711'),light:palette('#f3f8f2','#fcfff9','#bfd1bd','#233326','#52694f','#32613d','#ffffff','#e3efe1')},
 aurora:{dark:palette('#0d0b18','#151126','#4b3d75','#f8f5ff','#c9bce8','#c4b5fd','#1b1236','#0a0813'),light:palette('#faf7ff','#ffffff','#d8c9f2','#241637','#65527e','#6d28d9','#ffffff','#f2ecff')},
 citrus:{dark:palette('#171205','#201a0b','#5f5328','#fff9e8','#d8c89e','#fcd34d','#2a1e04','#100d03'),light:palette('#fffbeb','#ffffff','#e8d9a8','#2a210b','#6f5d2e','#a84b08','#ffffff','#fdf6df')},
 clay:{dark:palette('#262624','#30302e','#59574f','#f2f0e8','#b9b6ad','#e8b39a','#241c18','#1f1f1d'),light:palette('#faf9f5','#fffefa','#d9d6cd','#292824','#6f6b62','#a55335','#ffffff','#f0eee6')}
};
export function normalizeWorkspaceTheme(value:unknown):WorkspaceTheme{return WORKSPACE_THEMES.some(t=>t.id===value)?value as WorkspaceTheme:'black';}
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
export function workspaceControlPalette(mode:Theme,preset:WorkspaceTheme='black'){
 const p=workspacePalette(preset,mode),support=({black:['#62cdb3','#edaa80'],mono:['#82baf0','#e8b58e'],paper:['#a8ba77','#cd9582'],slate:['#8ebed9','#d7a0bb'],forest:['#c5b36c','#90b5df'],aurora:['#5eead4','#fda4af'],citrus:['#a3e635','#fb923c'],clay:['#9f9b80','#b8a083']} as const)[preset],hover=mixHex(p.panel,p.ink,mode==='dark'?.065:.035),active=mixHex(p.panel,p.accent,mode==='dark'?.14:.065),primary=mixHex(p.panel,p.accent,mode==='dark'?.19:.09);
 return {secondary:support[0],tertiary:support[1],surface:mixHex(p.panel,p.ink,mode==='dark'?.035:0),control:p.panel,'control-ink':p.ink,hover,'hover-ink':p.ink,active,'active-ink':p.accent,
  success:mixHex(p.panel,support[0],.12),'success-ink':p.ink,pending:mixHex(p.panel,support[1],.12),'pending-ink':p.ink,
  danger:p.panel,'danger-ink':p.ink,info:primary,'info-ink':p.accent,
  brand:preset==='black'||preset==='slate'?(mode==='dark'?'#3b82f6':'#2563eb'):p.accent,
  border:mixHex(p.panel,p.ink,mode==='dark'?.19:.16),outline:mixHex(p.panel,p.accent,mode==='dark'?.45:.35),focus:p.accent};
}
