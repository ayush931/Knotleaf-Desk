import { validatePaintSize, MAX_PAINT_LAYERS } from './paint';
import { isEmbeddedImage } from '@/draw/imageResource';
export interface PaintProject { format: 'knotleaf.paint'; version: 1; width: number; height: number; layers: { name: string; visible: boolean; opacity: number; source: string }[] }
export function parsePaintProject(text: string): PaintProject {
  if (text.length > 24_000_000) throw new Error('This Paint project exceeds 24 MB.');
  const p = JSON.parse(text);
  if (!p || p.format !== 'knotleaf.paint' || p.version !== 1) throw new Error('Choose a supported .kpaint project.');
  validatePaintSize(p.width, p.height);
  if (!Array.isArray(p.layers) || !p.layers.length || p.layers.length > MAX_PAINT_LAYERS || p.width * p.height * p.layers.length > 16_777_216) throw new Error('This project has too many layers or pixels.');
  if (!p.layers.every((l: PaintProject['layers'][number]) => l && typeof l.name === 'string' && l.name.length <= 80 && typeof l.visible === 'boolean' && typeof l.opacity === 'number' && Number.isFinite(l.opacity) && l.opacity >= 0 && l.opacity <= 1 && isEmbeddedImage(l.source))) throw new Error('This Paint project contains an invalid layer.');
  return p as PaintProject;
}
