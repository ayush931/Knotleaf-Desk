import { DEFAULT_STYLE, type ElementStyleProps } from '@/draw/types';
import { normalizeNoteAppearance, DEFAULT_NOTE_APPEARANCE, type NoteAppearance } from './notesDocument';
import { normalizeToolColors, type ToolColorPreferences } from '@/draw/toolColors';
import { FONT_OPTIONS } from '@/draw/fonts';

const KEY = 'knotleaf.preferences.v1';
export interface Preferences {
  version: 1;
  markdownRetentionDays: 0 | 7;
  callNoiseSuppression: boolean;
  style: ElementStyleProps;
  toolColors: ToolColorPreferences;
  eraserSize: number;
  eraserMode: 'all' | 'drawings' | 'objects';
  notesWidth: number;
  notesHeight: number;
  noteAppearance: NoteAppearance;
  /** Last rich-note text size picked by shortcut or size input; null follows the note default. */
  noteTypingSize: number | null;
  exportFormat: string;
  exportScope: 'project' | 'canvas' | 'notes';
  exportScale: number;
  exportTransparent: boolean;
}
const defaults = (): Preferences => ({ version:1, markdownRetentionDays:7, callNoiseSuppression:true, style:{...DEFAULT_STYLE}, toolColors:normalizeToolColors(undefined), eraserSize:24, eraserMode:'all', notesWidth:360, notesHeight:300, noteAppearance:{...DEFAULT_NOTE_APPEARANCE}, noteTypingSize:null, exportFormat:'project', exportScope:'project', exportScale:2, exportTransparent:false });
const finite = (n: unknown, min: number, max=Number.MAX_VALUE): n is number => typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
const color = (value: unknown): value is string => typeof value==='string' && (value==='transparent' || /^#[\da-f]{6}$/i.test(value));
export function normalizePreferences(value: unknown): Preferences {
  const result=defaults();
  if (!value || typeof value!=='object') return result;
  const data=value as Record<string,unknown>;
  if (data.version!==undefined && data.version!==1) return result;
  if(data.markdownRetentionDays===0||data.markdownRetentionDays===7)result.markdownRetentionDays=data.markdownRetentionDays;
  if(typeof data.callNoiseSuppression==='boolean')result.callNoiseSuppression=data.callNoiseSuppression;
  const style=data.style && typeof data.style==='object'?data.style as Record<string,unknown>:{};
  for(const key of ['stroke','fill'] as const)if(color(style[key]))result.style[key]=style[key];
  for(const key of ['opacity','fillOpacity'] as const)if(finite(style[key],0,1))result.style[key]=style[key];
  if(finite(style.strokeWidth,.1,100))result.style.strokeWidth=style.strokeWidth;
  if(finite(style.fontSize,8,512))result.style.fontSize=style.fontSize;
  const choices: Record<string,string[]>={strokeStyle:['solid','dashed','dotted','rough'],fillStyle:['none','solid','semi','hachure','crosshatch','dots'],roundness:['sharp','rounded'],fontFamily:FONT_OPTIONS.map(f=>f.id),textAlign:['left','center','right'],arrowRouting:['straight','elbow','curved'],arrowHeadStart:['none','arrow','diamond','dot','bar'],arrowHeadEnd:['none','arrow','diamond','dot','bar']};
  for(const[key,allowed]of Object.entries(choices)){const value=style[key];if(typeof value==='string'&&allowed.includes(value))Object.assign(result.style,{[key]:value});}
  for(const key of ['bold','italic','underline','strikethrough','arrowAnimated'] as const)if(typeof style[key]==='boolean')result.style[key]=style[key];
  result.toolColors=normalizeToolColors(data.toolColors,result.style);
  if(finite(data.eraserSize,Number.MIN_VALUE))result.eraserSize=data.eraserSize;
  if(['all','drawings','objects'].includes(String(data.eraserMode)))result.eraserMode=data.eraserMode as Preferences['eraserMode'];
  if(finite(data.notesWidth,220))result.notesWidth=data.notesWidth;
  if(finite(data.notesHeight,160))result.notesHeight=data.notesHeight;
  result.noteAppearance=normalizeNoteAppearance(data.noteAppearance);
  if(finite(data.noteTypingSize,8,128))result.noteTypingSize=Math.round(data.noteTypingSize);
  if(['project','pdf','png','jpeg','webp','svg','markdown','drawio','json'].includes(String(data.exportFormat)))result.exportFormat=String(data.exportFormat);
  if(['project','canvas','notes'].includes(String(data.exportScope)))result.exportScope=data.exportScope as Preferences['exportScope'];
  if([1,2,3].includes(data.exportScale as number))result.exportScale=data.exportScale as number;
  if(typeof data.exportTransparent==='boolean')result.exportTransparent=data.exportTransparent;
  if(['png','jpeg','webp','svg','drawio'].includes(result.exportFormat))result.exportScope='canvas';
  if(result.exportFormat==='markdown')result.exportScope='notes';
  if(result.exportFormat==='json')result.exportScope='project';
  return result;
}
export function loadPreferences(): Preferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(KEY)||'null')); }
  catch { return defaults(); }
}
export function savePreferences(patch: Partial<Preferences>): boolean {
  try { localStorage.setItem(KEY,JSON.stringify(normalizePreferences({...loadPreferences(),...patch,version:1}))); return true; }
  catch { return false; }
}
