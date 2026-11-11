import type { CSSProperties } from 'react';
import type { Theme } from '@/draw/types';
export const WORKSPACE_THEMES = [
 {id:'black',name:'Midnight',description:'Black and white surfaces with blue, green and amber actions.'},
 {id:'mono',name:'Lagoon',description:'Deep ocean, bright teal and airy blue-white.'},
 {id:'paper',name:'Paper',description:'Warm paper and soft charcoal.'},
 {id:'slate',name:'Slate',description:'Cool graphite and quiet blue accents.'},
 {id:'forest',name:'Forest',description:'Deep green and natural paper.'},
] as const;
export type WorkspaceTheme = typeof WORKSPACE_THEMES[number]['id'];
export type ThemeScope = 'canvas' | 'notes' | 'both';
export interface WorkspaceThemes {canvas:WorkspaceTheme;notes:WorkspaceTheme;notesMode?:Theme}
export interface WorkspacePalette {background:string;panel:string;border:string;ink:string;muted:string;accent:string;accentInk:string;code:string}
const palette=(background:string,panel:string,border:string,ink:string,muted:string,accent:string,accentInk:string,code:string):WorkspacePalette=>({background,panel,border,ink,muted,accent,accentInk,code});
const palettes:Record<WorkspaceTheme,Record<Theme,WorkspacePalette>>={
 mono:{dark:palette('#10232c','#193641','#416573','#f0fbff','#b5d0da','#5ee0c1','#082c28','#0b1b23'),light:palette('#f0f9fc','#ffffff','#a8cbd6','#12313e','#476571','#096956','#ffffff','#e0eff4')},
 black:{dark:palette('#000000','#000000','#525252','#ffffff','#b8b8b8','#93b4ff','#0b1b34','#111318'),light:palette('#ffffff','#ffffff','#c7c7c7','#000000','#525252','#2759bb','#ffffff','#f3f5f9')},
 paper:{dark:palette('#211e19','#2c2720','#62584a','#faf4e9','#c9bfae','#f2dfb7','#241c10','#171510'),light:palette('#faf6ec','#fffdf7','#d3c5ac','#29231a','#655c4b','#604a28','#ffffff','#eee6d6')},
 slate:{dark:palette('#161d29','#202a39','#4f627d','#f2f6ff','#b2c1d6','#a7caff','#10213b','#101620'),light:palette('#f4f7fc','#ffffff','#becde1','#17253a','#52647b','#254e83','#ffffff','#e8eef7')},
 forest:{dark:palette('#14211b','#1d2e25','#4d6f5b','#effaf2','#b0cdb8','#b0e0bd','#102619','#0d1711'),light:palette('#f2f8f1','#fbfff9','#b4cdb6','#1c3022','#4d6955','#2d5638','#ffffff','#e3efe1')}
};
export function normalizeWorkspaceTheme(value:unknown):WorkspaceTheme{return WORKSPACE_THEMES.some(t=>t.id===value)?value as WorkspaceTheme:'black';}
export function normalizeWorkspaceThemes(value:unknown):WorkspaceThemes{const v=value&&typeof value==='object'?value as Partial<WorkspaceThemes>:{};return {canvas:normalizeWorkspaceTheme(v.canvas),notes:normalizeWorkspaceTheme(v.notes),...(v.notesMode==='dark'||v.notesMode==='light'?{notesMode:v.notesMode}:{})};}
export function workspacePalette(preset:WorkspaceTheme,mode:Theme){return palettes[normalizeWorkspaceTheme(preset)][mode];}
export function applyWorkspaceTheme(current:WorkspaceThemes,preset:WorkspaceTheme,scope:ThemeScope):WorkspaceThemes{return {...current,...(scope!=='notes'?{canvas:preset}:{}),...(scope!=='canvas'?{notes:preset}:{}),...(scope==='both'?{notesMode:undefined}:{})};}
export type WorkspaceThemeStyle = CSSProperties & { [key: `--${string}`]: string };
export function workspaceThemeStyle(preset:WorkspaceTheme,mode:Theme,notes=false):WorkspaceThemeStyle {
 const p=workspacePalette(preset,mode),controls=workspaceControlPalette(mode);
 const values:Record<string,string>=notes?{'--notes-bg':p.background,'--notes-panel':p.panel,'--notes-border':p.border,'--notes-ink':p.ink,'--notes-muted':p.muted,'--notes-code':p.code,'--reader-link':p.accent,'--notes-token-keyword':mode==='light'?'#6b3f87':'#b8a8c4','--notes-token-string':mode==='light'?'#356330':'#afbaa8','--notes-token-comment':mode==='light'?'#606975':'#a3a3a3','--notes-token-number':mode==='light'?'#895824':'#d4b38c','--notes-token-title':mode==='light'?'#285a86':'#9ebbd4'}:{};
 return {...(notes?{colorScheme:mode}:{}),...values,...Object.fromEntries(Object.entries(controls).map(([key,value])=>[`--ui-${key}`,value])),'--drawing-panel':p.panel,'--drawing-border':p.border,'--ui-accent':p.accent,'--ui-accent-ink':p.accentInk,'--ui-ink':p.ink,'--ui-muted':p.muted,'--ui-inset':p.code,'--ui-background':p.background};
}

/** Semantic action colors are consistent across presets; color never replaces the label. */
export function workspaceControlPalette(mode:Theme){return mode==='dark'?{
 control:'#111723','control-ink':'#c0d3f5',active:'#172d50','active-ink':'#b9d2ff',
 success:'#103629','success-ink':'#92efc2',pending:'#382b10','pending-ink':'#f8d78b',
 danger:'#3a1720','danger-ink':'#ffb5c3',info:'#172d50','info-ink':'#b9d2ff',brand:'#f6c55b'
 }:{control:'#f2f5fc','control-ink':'#344f7a',active:'#e8efff','active-ink':'#254982',
 success:'#e3f6ed','success-ink':'#176843',pending:'#fff2d9','pending-ink':'#85530a',
 danger:'#fff0f0','danger-ink':'#a62e42',info:'#e8efff','info-ink':'#254982',brand:'#9a5706'};}
