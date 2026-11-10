import type { BackgroundSettings, CanvasElement, Theme } from './types';
import { normalizeBackground, isLightBackground } from '@/lib/background.mjs';
import { CODE_CARD_FILL, DOCUMENT_CARD_FILL } from './cardAppearance';

/** Theme presentation is reversible and never rewrites saved board colors. */
export function canvasBackground(value: unknown, theme: Theme): BackgroundSettings {
  const background = normalizeBackground(value);
  return theme === 'light' && background.fill.toLowerCase() === '#121212'
    ? { ...background, fill: '#ffffff' } : background;
}
export function neutralInk(color: string, light: boolean): string {
  return light && /^(#fff(?:fff)?|#f4f4f5|#e4e4e7|#e2e8f0|#cbd5e1)$/i.test(color) ? '#1f2937' : color;
}
export function canvasElementAppearance<T extends CanvasElement>(element: T, light: boolean): T {
  if (!light || element.type === 'image' || element.type === 'sticky') return element;
  let next = element;
  if (element.type === 'text' && (element.isDocCard || element.isCodeCard || element.attachment) && !element.cardFillCustom &&
      ['#18181b', '#10151e', DOCUMENT_CARD_FILL, CODE_CARD_FILL].includes(element.fill.toLowerCase())) {
    next = { ...element, fill: '#ffffff' };
  }
  const lightSurface = next.fill === 'transparent' || next.fillStyle === 'none' ||
    isLightBackground({ fill: next.fill, fillStyle: 'solid', fillOpacity: next.fillOpacity ?? 1 });
  if (!lightSurface) return next;
  const stroke = neutralInk(next.stroke, true);
  if (stroke !== next.stroke) next = { ...next, stroke };
  if (next.type === 'icon') next = { ...next, iconColor: neutralInk(next.iconColor || next.stroke, true) };
  return next;
}
export function lightCodeInk(color: string): string {
  return ({ '#d4d4d8': '#27272a', '#b8a8c4': '#6b3f87', '#afbaa8': '#356330', '#808995': '#606975' } as Record<string,string>)[color.toLowerCase()] || color;
}
