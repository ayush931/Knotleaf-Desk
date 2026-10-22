import { sceneFontFamilies } from "./fonts";
import type { Board, CanvasElement, BackgroundSettings, GridType } from "./types";
import { normalizeBackground, isLightBackground } from "@/lib/background.mjs";
import { drawCanvasBackground } from "./backgroundFill";
import { drawElement, getElementBounds, unionBounds, loadCanvasFonts, gridAppearance } from "./renderer";
import { isEmbeddedImage } from "./imageResource";
import { getIconById } from "./iconsData";
import { normalizeIconSvg } from "./iconSvg";

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
interface Paint {
  fillStyle: string; strokeStyle: string; lineWidth: number; globalAlpha: number;
  lineCap: string; lineJoin: string; lineDashOffset: number;
  clip?: string; font: string; textAlign: string; textBaseline: string; dash: number[]; transform: DOMMatrix;
}
/** Records the same drawing operations as the canvas renderer into portable SVG vectors. */
class SvgContext {
  output: string[] = [];
  private path = "";
  private cursor = { x: 0, y: 0 };
  private hasPoint = false;
  private stack: Paint[] = [];
  private paint: Paint = { fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, globalAlpha: 1, lineCap: "butt", lineJoin: "miter", lineDashOffset: 0, font: "12px sans-serif", textAlign: "left", textBaseline: "alphabetic", dash: [], transform: new DOMMatrix() };
  private metrics = document.createElement("canvas").getContext("2d")!;
  // Canvas renderers assign these properties. Proxy below forwards them to paint.
  get state() { return this.paint; }
  save() { this.stack.push({ ...this.paint, dash: [...this.paint.dash], transform: DOMMatrix.fromMatrix(this.paint.transform) }); }
  restore() { this.paint = this.stack.pop() ?? this.paint; }
  translate(x: number, y: number) { this.paint.transform = this.paint.transform.translate(x, y); }
  scale(x: number, y: number) { this.paint.transform = this.paint.transform.scale(x, y); }
  rotate(angle: number) { this.paint.transform = this.paint.transform.rotate(angle * 180 / Math.PI); }
  setLineDash(dash: number[]) { this.paint.dash = dash; }
  beginPath() { this.path = ""; this.hasPoint = false; }
  moveTo(x: number, y: number) { this.path += `M${x} ${y} `; this.cursor = { x, y }; this.hasPoint = true; }
  lineTo(x: number, y: number) { if (!this.hasPoint) this.moveTo(x, y); else { this.path += `L${x} ${y} `; this.cursor = { x, y }; } }
  closePath() { this.path += "Z "; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.path += `Q${cx} ${cy} ${x} ${y} `; this.cursor = { x, y }; }
  rect(x: number, y: number, w: number, h: number) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  roundRect(x: number, y: number, w: number, h: number, radius: number) {
    const r = Math.min(Number(radius) || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + r, y); this.lineTo(x + w - r, y); this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r); this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h); this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r); this.arcTo(x, y, x + r, y, r); this.closePath();
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    const p = this.cursor;
    const d1 = Math.hypot(p.x - x1, p.y - y1), d2 = Math.hypot(x2 - x1, y2 - y1);
    if (!r || !d1 || !d2) { this.lineTo(x1, y1); return; }
    const ux = (p.x - x1) / d1, uy = (p.y - y1) / d1, vx = (x2 - x1) / d2, vy = (y2 - y1) / d2;
    const angle = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (angle < 1e-8 || Math.abs(angle - Math.PI) < 1e-8) { this.lineTo(x1, y1); return; }
    const tangent = r / Math.tan(angle / 2);
    this.lineTo(x1 + ux * tangent, y1 + uy * tangent);
    const x = x1 + vx * tangent, y = y1 + vy * tangent;
    this.path += `A${r} ${r} 0 0 ${ux * vy - uy * vx < 0 ? 1 : 0} ${x} ${y} `;
    this.cursor = { x, y };
  }
  arc(x: number, y: number, radius: number, start: number, end: number, anticlockwise = false) { this.ellipse(x, y, radius, radius, 0, start, end, anticlockwise); }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise = false) {
    const at = (a: number) => ({ x: x + rx * Math.cos(a) * Math.cos(rotation) - ry * Math.sin(a) * Math.sin(rotation), y: y + rx * Math.cos(a) * Math.sin(rotation) + ry * Math.sin(a) * Math.cos(rotation) });
    const p = at(start); if (!this.hasPoint) this.moveTo(p.x, p.y); else this.lineTo(p.x, p.y);
    const full = Math.abs(end - start) >= Math.PI * 2 - 1e-6;
    const parts = full ? [start + (anticlockwise ? -Math.PI : Math.PI), end] : [end];
    for (const angle of parts) {
      const q = at(angle);
      this.path += `A${rx} ${ry} ${rotation * 180 / Math.PI} ${!full && Math.abs(end - start) > Math.PI ? 1 : 0} ${anticlockwise ? 0 : 1} ${q.x} ${q.y} `;
      this.cursor = q;
    }
  }
  clip() { const id = `paint-clip-${this.output.length}`; this.output.push(`<defs><clipPath id="${id}"><path d="${this.path}"/></clipPath></defs>`); this.paint.clip = id; }
  private attributes() { const m = this.paint.transform; return `${this.paint.clip ? `clip-path="url(#${this.paint.clip})" ` : ""}opacity="${this.paint.globalAlpha}" transform="matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})"`; }
  fill() { this.output.push(`<path d="${this.path}" fill="${esc(this.paint.fillStyle)}" ${this.attributes()}/>`); }
  stroke() { const p = this.paint; this.output.push(`<path d="${this.path}" fill="none" stroke="${esc(p.strokeStyle)}" stroke-width="${p.lineWidth}" stroke-linecap="${p.lineCap}" stroke-linejoin="${p.lineJoin}" stroke-dasharray="${p.dash.join(" ")}" stroke-dashoffset="${p.lineDashOffset}" ${this.attributes()}/>`); }
  fillRect(x: number, y: number, w: number, h: number) { this.output.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(this.paint.fillStyle)}" ${this.attributes()}/>`); }
  strokeRect(x: number, y: number, w: number, h: number) { const path = this.path; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.path = path; }
  measureText(text: string) { this.metrics.font = this.paint.font; return this.metrics.measureText(text); }
  fillText(text: string, x: number, y: number) {
    const p = this.paint;
    const anchor = p.textAlign === "center" ? "middle" : p.textAlign === "right" ? "end" : "start";
    const baseline = p.textBaseline === "top" ? "text-before-edge" : p.textBaseline === "middle" ? "central" : p.textBaseline === "bottom" ? "text-after-edge" : "alphabetic";
    this.output.push(`<text x="${x}" y="${y}" fill="${esc(p.fillStyle)}" text-anchor="${anchor}" dominant-baseline="${baseline}" style="font:${esc(p.font)};white-space:pre" ${this.attributes()}>${esc(text)}</text>`);
  }
}

function safeIcon(markup: string, namespace: string) {
  try { return normalizeIconSvg(markup, undefined, namespace).svgMarkup; } catch { return ""; }
}

export function boardToSvg(elements: CanvasElement[], transparent = false, scene: CanvasElement[] = elements, background?: BackgroundSettings, gridType: GridType = "dot"): string | null {
  const bounds = unionBounds(elements.map(el => getElementBounds(el, scene)));
  if (!bounds) return null;
  const width = Math.ceil(bounds.maxX - bounds.minX + 80), height = Math.ceil(bounds.maxY - bounds.minY + 80);
  const recorder = new SvgContext();
  const ctx = new Proxy(recorder, {
    get(target, key) { if (key in target.state) return target.state[key as keyof Paint]; const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value; },
    set(target, key, value) { if (key in target.state) Reflect.set(target.state, key, value); return true; },
  }) as unknown as CanvasRenderingContext2D;
  if (!transparent) drawCanvasBackground(ctx, normalizeBackground(background), () => ctx.rect(bounds.minX - 40, bounds.minY - 40, width, height), { x: bounds.minX - 40, y: bounds.minY - 40, width, height });
  if (!transparent && gridType !== "none") {
    const { spacing, radius, dotColor, lineColor } = gridAppearance(1, isLightBackground(background));
    const marks = gridType === "dot" ? `<circle cx="${spacing/2}" cy="${spacing/2}" r="${radius}" fill="${dotColor}"/>` : `<path d="M0.5 0V${spacing}M0 0.5H${spacing}" fill="none" stroke="${lineColor}" stroke-width="1"/>`;
    const offset = gridType === "dot" ? -spacing/2 : 0;
    recorder.output.push(`<defs><pattern id="knotleaf-editor-grid" x="${offset}" y="${offset}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">${marks}</pattern></defs><rect x="${bounds.minX-40}" y="${bounds.minY-40}" width="${width}" height="${height}" fill="url(#knotleaf-editor-grid)"/>`);
  }
  for (const el of elements) {
    if (el.type === "image") {
      if (isEmbeddedImage(el.source, el.localOnly ? Infinity : 4_000_000)) recorder.output.push(`<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${esc(el.source)}" opacity="${el.opacity}" preserveAspectRatio="none"/>`);
      continue;
    }
    // Embed icon glyphs as self-contained SVG; icons have no card or caption.
    drawElement(ctx, el.type === "icon" ? { ...el, svgMarkup: "" } : el, { theme: "dark", scene });
    if (el.type === "icon") {
      const icon = getIconById(el.iconId), markup = el.svgMarkup ?? icon?.svgPath;
      if (markup) {
        const size = Math.max(1, Math.min(el.width, el.height));
        recorder.output.push(`<svg x="${el.x + (el.width - size) / 2}" y="${el.y + (el.height - size) / 2}" width="${size}" height="${size}" viewBox="${esc(el.viewBox ?? icon?.viewBox ?? "0 0 24 24")}" color="${esc(el.iconColor ?? icon?.color ?? "#3b82f6")}" opacity="${el.opacity}">${safeIcon(markup, `icon-${el.id}`)}</svg>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX - 40} ${bounds.minY - 40} ${width} ${height}">${recorder.output.join("\n")}</svg>`;
}
export async function exportToSvg(board: Board, elements = board.elements, transparent = false) {
  await loadCanvasFonts(sceneFontFamilies(elements));
  const svg = boardToSvg(elements, transparent, board.elements, board.background, board.gridType || "dot");
  if (!svg) throw new Error("Add something to the canvas before exporting SVG.");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a"); link.href = url; link.download = `${board.title.replace(/[^a-z0-9_-]/gi, "-") || "board"}.svg`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
