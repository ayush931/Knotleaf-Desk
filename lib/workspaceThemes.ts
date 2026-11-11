import type { CSSProperties } from 'react';
import type { Theme } from '@/draw/types';
export const WORKSPACE_THEMES = [
 {id:'black',name:'Midnight',description:'Black and white with a restrained blue accent.'},
 {id:'mono',name:'Lagoon',description:'Deep ocean, bright teal and airy blue-white.'},
 {id:'paper',name:'Paper',description:'Warm paper and soft charcoal.'},
 {id:'slate',name:'Slate',description:'Cool graphite and quiet blue accents.'},
 {id:'forest',name:'Forest',description:'Deep green and natural paper.'},
] as const;
export type WorkspaceTheme = typeof WORKSPACE_THEMES[number]['id'];
export type LogoStyle = 'theme' | 'black';
export type ThemeScope = 'canvas' | 'notes' | 'both';
export interface WorkspaceThemes {canvas:WorkspaceTheme;notes:WorkspaceTheme;notesMode?:Theme}
export interface WorkspacePalette {background:string;panel:string;border:string;ink:string;muted:string;accent:string;accentInk:string;code:string}
const palette=(background:string,panel:string,border:string,ink:string,muted:string,accent:string,accentInk:string,code:string):WorkspacePalette=>({background,panel,border,ink,muted,accent,accentInk,code});
const palettes:Record<WorkspaceTheme,Record<Theme,WorkspacePalette>>={
 mono:{dark:palette('#10232c','#193641','#416573','#f0fbff','#b5d0da','#5ee0c1','#082c28','#0b1b23'),light:palette('#f0f9fc','#ffffff','#a8cbd6','#12313e','#476571','#096956','#ffffff','#e0eff4')},
 black:{dark:palette('#000000','#000000','#2e3a4d','#ffffff','#b8b8b8','#8fa9d5','#000000','#090b0f'),light:palette('#ffffff','#ffffff','#c5cfdd','#000000','#525252','#3c5f91','#ffffff','#f7f8fa')},
 paper:{dark:palette('#211e19','#2c2720','#62584a','#faf4e9','#c9bfae','#f2dfb7','#241c10','#171510'),light:palette('#faf6ec','#fffdf7','#d3c5ac','#29231a','#655c4b','#604a28','#ffffff','#eee6d6')},
 slate:{dark:palette('#161d29','#202a39','#4f627d','#f2f6ff','#b2c1d6','#a7caff','#10213b','#101620'),light:palette('#f4f7fc','#ffffff','#becde1','#17253a','#52647b','#254e83','#ffffff','#e8eef7')},
 forest:{dark:palette('#14211b','#1d2e25','#4d6f5b','#effaf2','#b0cdb8','#b0e0bd','#102619','#0d1711'),light:palette('#f2f8f1','#fbfff9','#b4cdb6','#1c3022','#4d6955','#2d5638','#ffffff','#e3efe1')}
};
export function normalizeWorkspaceTheme(value:unknown):WorkspaceTheme{return WORKSPACE_THEMES.some(t=>t.id===value)?value as WorkspaceTheme:'black';}
export function normalizeWorkspaceThemes(value:unknown):WorkspaceThemes{const v=value&&typeof value==='object'?value as Partial<WorkspaceThemes>:{};return {canvas:normalizeWorkspaceTheme(v.canvas),notes:normalizeWorkspaceTheme(v.notes),...(v.notesMode==='dark'||v.notesMode==='light'?{notesMode:v.notesMode}:{})};}
export function workspacePalette(preset:WorkspaceTheme,mode:Theme){return palettes[normalizeWorkspaceTheme(preset)][mode];}
export function applyWorkspaceTheme(current:WorkspaceThemes,preset:WorkspaceTheme,scope:ThemeScope):WorkspaceThemes{return {...current,...(scope!=='notes'?{canvas:preset}:{}),...(scope!=='canvas'?{notes:preset}:{}),...(scope==='both'?{notesMode:undefined}:{})};}
export type WorkspaceThemeStyle = CSSProperties & { [key: `--${string}`]: string };
export function workspaceThemeStyle(preset:WorkspaceTheme,mode:Theme,notes=false,logo:LogoStyle='theme'):WorkspaceThemeStyle {
 const p=workspacePalette(preset,mode),controls=workspaceControlPalette(mode,preset);
 const values:Record<string,string>=notes?{'--notes-bg':p.background,'--notes-panel':p.panel,'--notes-border':controls.outline,'--notes-ink':p.ink,'--notes-muted':p.muted,'--notes-code':p.code,'--reader-link':p.accent,'--notes-token-keyword':mode==='light'?'#6b3f87':'#b8a8c4','--notes-token-string':mode==='light'?'#356330':'#afbaa8','--notes-token-comment':mode==='light'?'#606975':'#a3a3a3','--notes-token-number':mode==='light'?'#895824':'#d4b38c','--notes-token-title':mode==='light'?'#285a86':'#9ebbd4'}:{};
 return {...(notes?{colorScheme:mode}:{}),...values,...Object.fromEntries(Object.entries(controls).map(([key,value])=>[`--ui-${key}`,value])),'--drawing-panel':p.panel,'--drawing-border':controls.outline,'--ui-accent':p.accent,'--ui-accent-ink':p.accentInk,'--ui-ink':p.ink,'--ui-muted':p.muted,'--ui-inset':p.code,'--ui-background':p.background,'--ui-brand':logo==='black'?'#000000':p.accent,'--ui-brand-bg':logo==='black'?'#ffffff':p.panel};
}

/** Blend one theme accent into the neutral surface; roles differ by emphasis, not hue. */
function mixHex(base:string,accent:string,weight:number){const channel=(offset:number)=>Math.round(parseInt(base.slice(offset,offset+2),16)*(1-weight)+parseInt(accent.slice(offset,offset+2),16)*weight).toString(16).padStart(2,'0');return '#'+[1,3,5].map(channel).join('');}
export function workspaceControlPalette(mode:Theme,preset:WorkspaceTheme='black'){
 const p=workspacePalette(preset,mode),active=mixHex(p.panel,p.accent,mode==='dark'?.11:.055),done=mixHex(p.panel,p.accent,mode==='dark'?.17:.085);
 return {control:p.panel,'control-ink':p.ink,active,'active-ink':p.ink,
  success:done,'success-ink':p.ink,pending:p.panel,'pending-ink':p.muted,
  danger:p.panel,'danger-ink':p.ink,info:active,'info-ink':p.ink,
  brand:p.accent,outline:mixHex(p.border,p.accent,.23),focus:p.accent};
}
