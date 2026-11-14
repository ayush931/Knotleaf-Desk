import { workspacePalette, type WorkspaceTheme } from '@/lib/workspaceThemes';
import { lightSyntaxColor } from '@/lib/codePalette';
import type { BackgroundSettings, CanvasElement, Theme } from './types';
import { normalizeBackground, isLightBackground } from '@/lib/background.mjs';
import { CODE_CARD_FILL, DOCUMENT_CARD_FILL } from './cardAppearance';

/** Colours the active workspace theme gives canvas chrome and neutral artwork ink. Null means plain black/white. */
export interface CanvasUiPalette { accent: string; panel: string; accentInk: string; ink: string }
let canvasUi: CanvasUiPalette | null = null;
export function setCanvasUiPalette(palette: CanvasUiPalette | null) { canvasUi = palette; }
export function getCanvasUiPalette(): CanvasUiPalette | null { return canvasUi; }

export const DRAWING_PAPER = '#ffffff';
export const DRAWING_BOARD = '#000000';

/** Theme presentation is reversible and never rewrites saved board colors. */
export function canvasBackground(value: unknown, theme: Theme, preset: WorkspaceTheme = 'black'): BackgroundSettings {
  const background = normalizeBackground(value);
  return background.fill.toLowerCase() === '#121212'
    ? { ...background, fill: workspacePalette(preset,theme).background } : background;
}
const NEUTRAL_LIGHT_INK = /^(#fff(?:fff)?|#f4f4f5|#e4e4e7|#e2e8f0|#cbd5e1)$/i;
/** Neutral artwork ink follows the theme: near-white on dark surfaces becomes the theme ink, and so does near-black on light surfaces. */
export function neutralInk(color: string, light: boolean): string {
  if (light) return NEUTRAL_LIGHT_INK.test(color) ? (canvasUi?.ink ?? '#000000') : color;
  return /^#fff(?:fff)?$/i.test(color) && canvasUi ? canvasUi.ink : color;
}
export function canvasElementAppearance<T extends CanvasElement>(element: T, light: boolean, scene: CanvasElement[] = []): T {
  if (element.type === 'image' || element.type === 'sticky') return element;
  if (!light) {
    const stroke = neutralInk(element.stroke, false);
    return stroke === element.stroke ? element : { ...element, stroke };
  }
  if (element.type === 'text' && element.containerId) {
    const parent=scene.find(item=>item.id===element.containerId);
    if(parent){const surface=canvasElementAppearance(parent,light);if(surface.fill!=='transparent'&&surface.fillStyle!=='none'&&!isLightBackground({fill:surface.fill,fillStyle:'solid',fillOpacity:surface.fillOpacity??1}))return element;}
  }
  let next = element;
  if (element.type === 'text' && (element.isDocCard || element.isCodeCard || element.attachment) && !element.cardFillCustom &&
      ['#18181b', '#10151e', '#111d2d', DOCUMENT_CARD_FILL, CODE_CARD_FILL].includes(element.fill.toLowerCase())) {
    next = { ...element, fill: '#ffffff' };
  }
  const lightSurface = next.fill === 'transparent' || next.fillStyle === 'none' ||
    isLightBackground({ fill: next.fill, fillStyle: 'solid', fillOpacity: next.fillOpacity ?? 1 });
  if (!lightSurface) return next;
  const stroke = neutralInk(next.stroke, true);
  if (stroke !== next.stroke) next = { ...next, stroke };
  if((next.type==='text'||next.type==='sticky')&&next.textRanges?.some(r=>r.style.color&&neutralInk(r.style.color,true)!==r.style.color))next={...next,textRanges:next.textRanges.map(r=>({...r,style:{...r.style,...(r.style.color?{color:neutralInk(r.style.color,true)}:{})}}))};
  if (next.type === 'icon') next = { ...next, iconColor: neutralInk(next.iconColor || next.stroke, true) };
  return next;
}
export function lightCodeInk(color: string): string {
  return ({ '#d4d4d8': '#27272a', '#b8a8c4': '#6b3f87', '#afbaa8': '#356330', '#808995': '#606975' } as Record<string,string>)[color.toLowerCase()] || lightSyntaxColor(color);
}
