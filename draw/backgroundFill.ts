import type { FillStyle } from './types';
export interface BackgroundFill { fill: string; fillStyle: FillStyle; fillOpacity?: number }
export function drawBackgroundFill(ctx: CanvasRenderingContext2D, style: BackgroundFill, build: () => void, box: { x: number; y: number; width: number; height: number }) {
  if (style.fillStyle === 'none' || !style.fill || style.fill === 'transparent' || style.fill === 'none') return;
  const opacity = Math.max(0, Math.min(1, style.fillOpacity ?? 1)) * (style.fillStyle === 'semi' ? 0.35 : 1);
  if (!opacity) return;
  ctx.save(); ctx.globalAlpha *= opacity; ctx.fillStyle = style.fill; ctx.strokeStyle = style.fill; ctx.setLineDash([]);
  ctx.beginPath(); build();
  if (style.fillStyle === 'solid' || style.fillStyle === 'semi') ctx.fill();
  else {
    ctx.clip(); const { x, y, width, height } = box, spacing = Math.max(10, Math.max(width, height) / 200);
    ctx.lineWidth = 1.25; ctx.beginPath();
    if (style.fillStyle === 'dots') {
      for (let px = x + spacing / 2; px < x + width; px += spacing) for (let py = y + spacing / 2; py < y + height; py += spacing) { ctx.moveTo(px + 1.5, py); ctx.arc(px, py, 1.5, 0, Math.PI * 2); }
      ctx.fill();
    } else {
      for (let offset = -height; offset < width; offset += spacing) { ctx.moveTo(x + offset, y); ctx.lineTo(x + offset + height, y + height); }
      if (style.fillStyle === 'crosshatch') for (let offset = 0; offset < width + height; offset += spacing) { ctx.moveTo(x + offset, y); ctx.lineTo(x + offset - height, y + height); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Matching DOM surface for inline editors; alpha affects the paint, never its text. */
export function backgroundFillCss(style: BackgroundFill): { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string } {
  if (style.fillStyle === 'none' || style.fill === 'transparent') return { backgroundColor: 'transparent' };
  let alpha = Math.max(0, Math.min(1, style.fillOpacity ?? 1)) * (style.fillStyle === 'semi' ? 0.35 : 1);
  let color = 'transparent';
  if (/^#[\da-f]{6}$/i.test(style.fill)) {
    const n = parseInt(style.fill.slice(1), 16); color = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  } else {
    const rgba = style.fill.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/);
    if (rgba) { alpha *= Number(rgba[4] ?? 1); color = `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${alpha})`; }
  }
  if (style.fillStyle === 'dots') return { backgroundColor: 'transparent', backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`, backgroundSize: '10px 10px' };
  if (style.fillStyle === 'hachure' || style.fillStyle === 'crosshatch') return { backgroundColor: 'transparent', backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 1.25px, transparent 1.25px 10px)${style.fillStyle === 'crosshatch' ? `,repeating-linear-gradient(-45deg, ${color} 0 1.25px, transparent 1.25px 10px)` : ''}` };
  return { backgroundColor: color };
}
