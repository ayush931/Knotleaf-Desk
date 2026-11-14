import type { InkPoint, InkStyle } from "./types";

export interface InkStyleDefinition {
  id: InkStyle;
  name: string;
  description: string;
  /** Preview stroke width in CSS pixels. */
  previewWidth: number;
}

/** The four pen characters shown in Appearance. */
export const INK_STYLES: readonly InkStyleDefinition[] = [
  { id: "fountain", name: "Fountain", description: "Classic pen with pressure taper and a fine finish.", previewWidth: 2.2 },
  { id: "brush", name: "Brush", description: "Expressive pressure and bold weight for loose sketching.", previewWidth: 4.2 },
  { id: "marker", name: "Marker", description: "Even, confident line with a rounded tip.", previewWidth: 3 },
  { id: "technical", name: "Technical", description: "Crisp, nearly constant line for diagrams and annotation.", previewWidth: 1.3 },
];

export const DEFAULT_INK_STYLE: InkStyle = "fountain";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Convert a pointer's travel into a stable pressure estimate for mouse and touch. */
export function velocityPressure(distance: number, elapsedMs: number): number {
  const speed = Math.max(0, distance) / Math.max(1, elapsedMs);
  return clamp(0.93 - speed * 0.62, 0.24, 0.93);
}

export function smoothPressure(previous: number | undefined, next: number): number {
  return previous === undefined ? next : previous * 0.52 + next * 0.48;
}

/**
 * Width for each sample of a freehand stroke. Pressure is optional so old
 * drawings and non-pressure pointers still produce a clean, tapered line.
 */
export function inkWidths(points: readonly InkPoint[], strokeWidth: number, style: InkStyle = DEFAULT_INK_STYLE): number[] {
  const base = Math.max(0.8, strokeWidth);
  const count = points.length;
  if (!count) return [];
  if (style === "marker") return points.map(() => base * 1.08);
  if (style === "technical") return points.map(() => Math.max(1, base * 0.62));
  return points.map((point, index) => {
    const pressure = clamp(point.pressure ?? 0.52, 0.06, 1);
    const taper = count <= 2 ? 0.72 : Math.min(1, (index + 1) / 3, (count - index) / 3);
    const edge = 0.45 + taper * 0.55;
    const body = style === "brush"
      ? 0.42 + pressure * 1.7
      : 0.38 + pressure * 1.02;
    return Math.max(0.65, base * body * edge);
  });
}

/** Average two neighbouring widths, which hides pressure spikes at sharp corners. */
export function smoothInkWidths(widths: readonly number[]): number[] {
  if (widths.length < 3) return [...widths];
  return widths.map((width, index) => {
    if (index === 0 || index === widths.length - 1) return width;
    return (widths[index - 1] + width * 2 + widths[index + 1]) / 4;
  });
}
