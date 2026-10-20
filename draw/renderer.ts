import { drawBackgroundFill } from "./backgroundFill";
import { expandCodeTabs, highlightCode } from "@/lib/code";
import { routeConnector } from "./connectorRouting";
import {
  CanvasElement,
  ArrowElement,
  Theme,
  GridType,
  Point,
  ArrowRouting,
  ArrowHead,
  AnchorPosition,
  FontFamily,
  TextElement,
  TextFormatting,
} from "./types";
import { getIconById } from "./iconsData";
import { getImageResource } from "./imageResource";
import { getIconImage } from "./iconSvg";
import { FONT_OPTIONS } from "./fonts";

export const ACCENT = "#3B82F6";
export const LINE_HEIGHT = 1.35;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawOptions {
  theme: Theme;
  scene?: CanvasElement[];
  selected?: boolean;
  flowOffset?: number;
  zoom?: number;
  onResourceLoad?: () => void;
}

// --- Fonts -----------------------------------------------------------------

const FONT_FALLBACK = Object.fromEntries(FONT_OPTIONS.map(font => [font.id, font.fallback])) as Record<FontFamily, string>;

let resolvedFonts: Record<FontFamily, string> | null = null;

/** Canvas cannot read CSS variables, so resolve the next/font family names once. */
export function fontStack(family: FontFamily): string {
  if (!resolvedFonts) {
    resolvedFonts = { ...FONT_FALLBACK };
    if (typeof document !== "undefined" && document.documentElement && typeof getComputedStyle === "function") {
      const styles = getComputedStyle(document.documentElement);
      FONT_OPTIONS.forEach(font => {
        const value = styles.getPropertyValue(font.variable).trim();
        if (value) resolvedFonts![font.id] = `${value}, ${font.fallback}`;
      });
    }
  }
  return resolvedFonts[family] || resolvedFonts.sans;
}

export async function loadCanvasFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(FONT_OPTIONS.flatMap(font => ["400", "700", "italic 400", "italic 700"].map(style => document.fonts.load(`${style} 16px ${fontStack(font.id)}`))));
  textBoundsContexts.get(document)?.cache.clear();
}

export function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  family: FontFamily,
  weight: number | string = 400,
  italic = false
) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${fontStack(family)}`;
}

// --- Geometry ----------------------------------------------------------------

export function normalizeRect(el: { x: number; y: number; width: number; height: number }) {
  return {
    x: el.width < 0 ? el.x + el.width : el.x,
    y: el.height < 0 ? el.y + el.height : el.y,
    w: Math.abs(el.width),
    h: Math.abs(el.height),
  };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  return list.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

/** Tight bounds of an element in canvas space, including arrow bends and pencil strokes. */
export function getElementBounds(el: CanvasElement, scene: CanvasElement[] = []): Bounds {
  if (el.type === "arrow" || el.type === "line") {
    const pts: Point[] = [];
    if (el.type === "arrow" || el.bendOffset) {
      const info = el.type === "arrow" ? computeArrowPath(el, scene) : computeLinePath(el);
      pts.push(...info.points);
      if (info.cpx !== undefined && info.cpy !== undefined) pts.push({ x: info.cpx, y: info.cpy });
    } else {
      pts.push({ x: el.startX, y: el.startY }, { x: el.endX, y: el.endY });
    }
    return pointsBounds(pts);
  }
  if (el.type === "pencil") {
    return pointsBounds(el.points.length ? el.points : [{ x: el.x, y: el.y }]);
  }
  if (el.type === "text") {
    const isDocCard = el.isDocCard || (el.fill && el.fill !== "transparent");
    if (!isDocCard && !el.isCodeCard) {
      const ink = cachedTextContentBounds(el);
      if (ink) return ink;
    }
    const pad = isDocCard ? 16 : 0;
    return {
      minX: el.x - pad,
      minY: el.y - pad,
      maxX: el.x + Math.max(el.width, isDocCard ? 24 : 1) + pad,
      maxY: el.y + Math.max(el.height, el.fontSize * 1.35) + pad,
    };
  }
  const r = normalizeRect(el);
  return { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h };
}

function pointsBounds(pts: Point[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Text ports and its selection outline share stable, outside-glyph padding. */
export const TEXT_PORT_PADDING = 8;
export function selectionPadding(el: CanvasElement, zoom: number) { return el.type === "text" ? el.isDocCard || el.isCodeCard || el.fill !== "transparent" ? TEXT_PORT_PADDING : 2 : 5 / zoom; }

export function getElementAnchors(el: CanvasElement): { anchor: AnchorPosition; x: number; y: number }[] {
  if (el.type === "arrow" || el.type === "line" || el.type === "pencil" || el.type === "frame") return [];
  const bounds = getElementBounds(el);
  const pad = el.type === "text" ? TEXT_PORT_PADDING : 0;
  const r = { x: bounds.minX - pad, y: bounds.minY - pad, w: bounds.maxX - bounds.minX + pad * 2, h: bounds.maxY - bounds.minY + pad * 2 };
  return [
    { anchor: "top", x: r.x + r.w / 2, y: r.y },
    { anchor: "right", x: r.x + r.w, y: r.y + r.h / 2 },
    { anchor: "bottom", x: r.x + r.w / 2, y: r.y + r.h },
    { anchor: "left", x: r.x, y: r.y + r.h / 2 },
  ];
}

// --- Text helpers -------------------------------------------------------------

/** Greedy word wrap that also breaks words longer than the available width. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;
      const candidate = line + word;
      if (ctx.measureText(candidate.trimEnd()).width <= maxWidth || line === "") {
        line = candidate;
        // Hard-break a single token that is wider than the box.
        while (ctx.measureText(line.trimEnd()).width > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        out.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Truncates a string with an ellipsis so it fits within maxWidth. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

export interface DocLine {
  raw: string;
  type:
    | "h1"
    | "h2"
    | "h3"
    | "divider"
    | "quote"
    | "bullet-disc"
    | "bullet-circle"
    | "bullet-square"
    | "bullet-diamond"
    | "bullet-dash"
    | "bullet-arrow"
    | "number"
    | "todo-unchecked"
    | "todo-checked"
    | "normal";
  content: string;
  prefix?: string;
  indentLevel: number;
  fontSize: number;
  fontWeight: number | string;
  isItalic?: boolean;
  isStrikethrough?: boolean;
  lineHeight: number;
  yOffset: number;
  width: number;
}

export interface DocumentLayout {
  lines: DocLine[];
  totalWidth: number;
  totalHeight: number;
}

export function layoutDocument(
  ctx: CanvasRenderingContext2D | null,
  text: string,
  baseFontSize: number,
  family: FontFamily,
  formatting: TextFormatting = {}
): DocumentLayout {
  const rawLines = text.split("\n");
  const lines: DocLine[] = [];
  let currentY = 0;
  let maxLineWidth = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const leadingSpaces = raw.match(/^\s*/)?.[0].length || 0;
    const indentLevel = Math.min(6, Math.floor(leadingSpaces / 2));
    const trimmed = raw.trim();

    let type: DocLine["type"] = "normal";
    let content = raw.slice(leadingSpaces);
    let prefix = "";
    let fontSize = baseFontSize;
    let fontWeight: number | string = formatting.bold ? 700 : 400;
    let isItalic = !!formatting.italic;
    let isStrikethrough = false;
    let lineHeight = baseFontSize * LINE_HEIGHT;

    if (trimmed.startsWith("# ")) {
      type = "h1";
      content = trimmed.slice(2);
      fontSize = Math.round(baseFontSize * 1.5);
      fontWeight = 700;
      lineHeight = Math.round(fontSize * 1.35) + 6;
    } else if (trimmed.startsWith("## ")) {
      type = "h2";
      content = trimmed.slice(3);
      fontSize = Math.round(baseFontSize * 1.25);
      fontWeight = 600;
      lineHeight = Math.round(fontSize * 1.35) + 4;
    } else if (trimmed.startsWith("### ")) {
      type = "h3";
      content = trimmed.slice(4);
      fontSize = Math.round(baseFontSize * 1.12);
      fontWeight = 600;
      lineHeight = Math.round(fontSize * 1.35) + 2;
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      type = "divider";
      content = "";
      lineHeight = 16;
    } else if (trimmed.startsWith("> ")) {
      type = "quote";
      content = trimmed.slice(2);
      isItalic = true;
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\-\s*|\*\s*)?\[\s*\]\s+/.test(trimmed)) {
      type = "todo-unchecked";
      content = trimmed.replace(/^(\-\s*|\*\s*)?\[\s*\]\s+/, "");
      prefix = "[ ]";
      lineHeight = baseFontSize * LINE_HEIGHT + 3;
    } else if (/^(\-\s*|\*\s*)?\[[xX]\]\s+/.test(trimmed)) {
      type = "todo-checked";
      content = trimmed.replace(/^(\-\s*|\*\s*)?\[[xX]\]\s+/, "");
      prefix = "[x]";
      isStrikethrough = true;
      lineHeight = baseFontSize * LINE_HEIGHT + 3;
    } else if (/^(\u2022|\-|\*)\s+/.test(trimmed)) {
      type = "bullet-disc";
      content = trimmed.replace(/^(\u2022|\-|\*)\s+/, "");
      prefix = "•";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\u25CB|o|\(\))\s+/.test(trimmed)) {
      type = "bullet-circle";
      content = trimmed.replace(/^(\u25CB|o|\(\))\s+/, "");
      prefix = "○";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\u25AA|\u25A0)\s+/.test(trimmed)) {
      type = "bullet-square";
      content = trimmed.replace(/^(\u25AA|\u25A0)\s+/, "");
      prefix = "▪";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\u25C6|\u25C7)\s+/.test(trimmed)) {
      type = "bullet-diamond";
      content = trimmed.replace(/^(\u25C6|\u25C7)\s+/, "");
      prefix = "◆";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\u2013|\-\-)\s+/.test(trimmed)) {
      type = "bullet-dash";
      content = trimmed.replace(/^(\u2013|\-\-)\s+/, "");
      prefix = "–";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^(\u2192|\->|\u25B8)\s+/.test(trimmed)) {
      type = "bullet-arrow";
      content = trimmed.replace(/^(\u2192|\->|\u25B8)\s+/, "");
      prefix = "→";
      lineHeight = baseFontSize * LINE_HEIGHT;
    } else if (/^\d+\.\s+/.test(trimmed)) {
      type = "number";
      const match = trimmed.match(/^(\d+\.)\s+/);
      prefix = match ? match[1] : "1.";
      content = trimmed.replace(/^\d+\.\s+/, "");
      lineHeight = baseFontSize * LINE_HEIGHT;
    }

    let measuredContentWidth = content.length * fontSize * 0.6;
    if (ctx) {
      setFont(ctx, fontSize, family, fontWeight, isItalic);
      measuredContentWidth = ctx.measureText(content).width;
    }

    const indentPx = indentLevel * 18;
    const gutterPx =
      type.startsWith("bullet-") || type === "number" || type.startsWith("todo-") ? 24 : type === "quote" ? 18 : 0;
    const lineWidth = indentPx + gutterPx + measuredContentWidth;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);

    lines.push({
      raw,
      type,
      content,
      prefix,
      indentLevel,
      fontSize,
      fontWeight,
      isItalic,
      isStrikethrough,
      lineHeight,
      yOffset: currentY,
      width: lineWidth,
    });

    currentY += lineHeight;
  }

  return {
    lines,
    totalWidth: Math.max(maxLineWidth, baseFontSize * 2) + 12,
    totalHeight: Math.max(currentY, baseFontSize * LINE_HEIGHT),
  };
}

export function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  family: FontFamily,
  formatting: TextFormatting = {}
): { width: number; height: number } {
  const layout = layoutDocument(ctx, text, fontSize, family, formatting);
  return { width: Math.ceil(Math.max(1, ...layout.lines.map(line => line.width))), height: Math.ceil(layout.totalHeight) };
}

/** Visible glyph bounds for free text; stored alignment boxes need not be resized. */
export function textContentBounds(ctx: CanvasRenderingContext2D, el: TextElement): Bounds | null {
  const layout = layoutDocument(ctx, el.text, el.fontSize, el.fontFamily, el);
  const boxes: Bounds[] = [];
  ctx.save(); ctx.textBaseline = "top";
  for (const line of layout.lines) {
    const ly = line.yOffset, indent = line.indentLevel * 18;
    if (line.type === "divider") {
      boxes.push({ minX: el.x, maxX: el.x + Math.max(el.width, layout.totalWidth, 120), minY: el.y + ly + 7.5, maxY: el.y + ly + 8.5 });
      continue;
    }
    const list = line.type.startsWith("bullet-") || line.type === "number" || line.type.startsWith("todo-");
    if (line.type === "quote") boxes.push({ minX: el.x, maxX: el.x + 3, minY: el.y + ly, maxY: el.y + ly + line.lineHeight - 2 });
    if (line.type.startsWith("todo-")) { const top = el.y + ly + (line.lineHeight - 14) / 2; boxes.push({ minX: el.x + indent, maxX: el.x + indent + 14, minY: top, maxY: top + 14 }); }
    else if (line.type === "number") {
      setFont(ctx, Math.max(10, line.fontSize - 1), el.fontFamily, 600); ctx.textAlign = "right";
      const prefix = ctx.measureText(line.prefix || "1.");
      if (![prefix.actualBoundingBoxLeft, prefix.actualBoundingBoxRight, prefix.actualBoundingBoxAscent, prefix.actualBoundingBoxDescent].every(Number.isFinite)) { ctx.restore(); return null; }
      boxes.push({ minX: el.x + indent + 16 - prefix.actualBoundingBoxLeft, maxX: el.x + indent + 16 + prefix.actualBoundingBoxRight, minY: el.y + ly + 1 - prefix.actualBoundingBoxAscent, maxY: el.y + ly + 1 + prefix.actualBoundingBoxDescent });
    }
    else if (list) boxes.push({ minX: el.x + indent, maxX: el.x + indent + 18, minY: el.y + ly + line.lineHeight / 2 - 5, maxY: el.y + ly + line.lineHeight / 2 + 5 });
    if (!line.content.trim()) continue;
    setFont(ctx, line.fontSize, el.fontFamily, line.fontWeight, line.isItalic);
    const align = list || line.type === "quote" ? "left" : el.textAlign || "left";
    ctx.textAlign = align;
    const metrics = ctx.measureText(line.content);
    if (![metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight, metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent].every(Number.isFinite)) { ctx.restore(); return null; }
    const anchor = list ? indent + 22 : line.type === "quote" ? 14 : align === "center" ? el.width / 2 : align === "right" ? el.width : indent;
    const textY = ly + (line.type === "quote" ? 1 : 0);
    let bottom = textY + metrics.actualBoundingBoxDescent;
    let left = anchor - metrics.actualBoundingBoxLeft, right = anchor + metrics.actualBoundingBoxRight;
    if (el.underline || el.strikethrough) {
      const start = align === "center" ? anchor - metrics.width / 2 : align === "right" ? anchor - metrics.width : anchor;
      left = Math.min(left, start); right = Math.max(right, start + metrics.width);
      if (el.underline) bottom = Math.max(bottom, textY + line.fontSize * 1.05 + Math.max(1, line.fontSize / 16) / 2);
    }
    boxes.push({ minX: el.x + left, maxX: el.x + right, minY: el.y + textY - metrics.actualBoundingBoxAscent, maxY: el.y + bottom });
  }
  ctx.restore(); return boxes.length ? unionBounds(boxes) : null;
}

const textBoundsContexts = new WeakMap<Document, { ctx: CanvasRenderingContext2D; cache: Map<string, Bounds | null> }>();
function cachedTextContentBounds(el: TextElement): Bounds | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  let entry = textBoundsContexts.get(document);
  if (!entry) { const ctx = document.createElement("canvas").getContext("2d"); if (!ctx) return null; entry = { ctx, cache: new Map() }; textBoundsContexts.set(document, entry); }
  const key = JSON.stringify([el.text, el.width, el.fontSize, el.fontFamily, el.textAlign, el.bold, el.italic, el.underline, el.strikethrough]);
  if (!entry.cache.has(key)) {
    if (entry.cache.size >= 1000) entry.cache.clear();
    entry.cache.set(key, textContentBounds(entry.ctx, { ...el, x: 0, y: 0 }));
  }
  const b = entry.cache.get(key);
  return b ? { minX: b.minX + el.x, maxX: b.maxX + el.x, minY: b.minY + el.y, maxY: b.maxY + el.y } : null;
}

// --- Grid -------------------------------------------------------------------

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
  gridType: GridType,
  light = false
) {
  if (gridType === "none") return;

  // Keep the on-screen spacing readable when zoomed far out.
  let spacing = 24 * zoom;
  while (spacing < 14) spacing *= 2;
  const startX = ((pan.x % spacing) + spacing) % spacing;
  const startY = ((pan.y % spacing) + spacing) % spacing;

  ctx.save();
  if (gridType === "dot") {
    ctx.fillStyle = light ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.12)";
    const r = Math.max(0.9, 1.0 * Math.min(zoom, 1.4));
    ctx.beginPath();
    for (let x = startX; x < width; x += spacing) {
      for (let y = startY; y < height; y += spacing) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  } else {
    ctx.strokeStyle = light ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < width; x += spacing) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = startY; y < height; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- Dispatch ---------------------------------------------------------------

export function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement, opts: DrawOptions) {
  const { theme, flowOffset = 0 } = opts;
  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (el.type) {
    case "rectangle":
      drawRectangle(ctx, el);
      break;
    case "diamond":
      drawDiamond(ctx, el);
      break;
    case "circle":
      drawCircle(ctx, el);
      break;
    case "arrow":
      drawArrow(ctx, el, theme, flowOffset, opts.scene);
      break;
    case "line":
      drawLine(ctx, el);
      break;
    case "pencil":
      drawPencil(ctx, el);
      break;
    case "text":
      drawText(ctx, el);
      break;
    case "sticky":
      drawSticky(ctx, el);
      break;
    case "image": {
      try { const resource = getImageResource(el.source, opts.onResourceLoad); if (resource.ready) ctx.drawImage(resource.image, el.x, el.y, el.width, el.height); } catch { /* Invalid imported images cannot stop the scene. */ }
      break;
    }
    case "icon":
      drawIcon(ctx, el, opts.onResourceLoad);
      break;
    case "frame":
      drawFrame(ctx, el);
      break;
  }

  ctx.restore();

  if (opts.selected) {
    drawSelection(ctx, el, opts.zoom ?? 1, opts.scene);
  }
}

// --- Stroke helpers -----------------------------------------------------------

function applyDash(ctx: CanvasRenderingContext2D, el: { strokeStyle: string; strokeWidth: number }) {
  const w = Math.max(1, el.strokeWidth || 2);
  if (el.strokeStyle === "dashed") {
    ctx.setLineDash([Math.max(6, w * 4), Math.max(5, w * 3)]);
    ctx.lineCap = "butt";
  } else if (el.strokeStyle === "dotted") {
    ctx.setLineDash([0.01, w * 2.6]);
    ctx.lineCap = "round";
    ctx.lineWidth = w * 1.4;
  } else {
    ctx.setLineDash([]);
  }
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0 || 1;
}

function mulberry(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Perturb each edge without moving its endpoints or smoothing across corners. */
function strokeSketch(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  closed: boolean,
  seed: number,
  width: number
) {
  if (pts.length < 2) return;
  const ring = closed ? [...pts, pts[0]] : pts;
  const rand = mulberry(seed);
  const amplitude = Math.min(1.6, Math.max(0.4, width * 0.5));
  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pass === 1) { ctx.globalAlpha *= 0.55; ctx.lineWidth *= 0.7; }
    ctx.beginPath();
    ctx.moveTo(ring[0].x, ring[0].y);
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (!length) continue;
      const steps = Math.max(1, Math.ceil(length / 48));
      // Short arc samples and tiny shapes need proportionally less variation.
      const amount = Math.min(amplitude, length * 0.06);
      for (let step = 0; step < steps; step++) {
        const mid = (step + 0.5) / steps, end = (step + 1) / steps;
        const offset = (rand() - 0.5) * 2 * amount;
        ctx.quadraticCurveTo(a.x + dx * mid - dy / length * offset, a.y + dy * mid + dx / length * offset, a.x + dx * end, a.y + dy * end);
      }
    }
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/** All four corner arcs share the same radius and sampling, including the seam. */
function roundedOutline(x: number, y: number, width: number, height: number, radius: number): Point[] {
  const points: Point[] = [{ x: x + radius, y }];
  const centers = [
    { x: x + width - radius, y: y + radius },
    { x: x + width - radius, y: y + height - radius },
    { x: x + radius, y: y + height - radius },
    { x: x + radius, y: y + radius },
  ];
  centers.forEach((center, corner) => {
    for (let step = 0; step <= 8; step++) {
      const angle = -Math.PI / 2 + corner * Math.PI / 2 + step * Math.PI / 16;
      points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    }
  });
  return points.slice(0, -1); // Closing the path supplies the final shared tangent.
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length < 3) {
    if (pts.length === 2) {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
    }
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

/** Fills and strokes a closed or open outline, sketching it when strokeStyle is "rough". */
function paintShape(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  build: () => void,
  sketchPts: Point[] | null,
  closed = true
) {
  const bounds = getElementBounds(el);
  drawBackgroundFill(ctx, el, build, { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY });
  ctx.strokeStyle = el.stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  applyDash(ctx, el);
  if (el.strokeStyle === "rough" && sketchPts) {
    strokeSketch(ctx, sketchPts, closed, seedOf(el.id), ctx.lineWidth);
  } else {
    ctx.beginPath();
    build();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// --- Shapes -------------------------------------------------------------------

function drawRectangle(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "rectangle") return;
  const { x, y, w, h } = normalizeRect(el);
  const r = el.roundness === "rounded" ? Math.min(12, w / 4, h / 4) : 0;
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  paintShape(
    ctx,
    el,
    () => {
      if (r > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    },
    r > 0 ? roundedOutline(x, y, w, h, r) : corners
  );
  drawShapeLabel(ctx, el, { x, y, w, h });
}

function drawDiamond(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "diamond") return;
  const { x, y, w, h } = normalizeRect(el);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [
    { x: cx, y },
    { x: x + w, y: cy },
    { x: cx, y: y + h },
    { x, y: cy },
  ];
  paintShape(
    ctx,
    el,
    () => {
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
    },
    pts
  );
  drawShapeLabel(ctx, el, { x, y, w, h });
}

function drawCircle(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "circle") return;
  const { x, y, w, h } = normalizeRect(el);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(0.5, w / 2);
  const ry = Math.max(0.5, h / 2);
  const samples: Point[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    samples.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  paintShape(ctx, el, () => ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2), samples, true);
  drawShapeLabel(ctx, el, { x, y, w, h });
}

/** Centered, wrapped label for shapes. */
function drawShapeLabel(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  box: { x: number; y: number; w: number; h: number }
) {
  if (!el.label) return;
  ctx.save();
  const size = 14;
  setFont(ctx, size, "sans", 500);
  const lines = wrapText(ctx, el.label, Math.max(20, box.w - 16));
  const total = lines.length * size * LINE_HEIGHT;
  let y = box.y + box.h / 2 - total / 2 + (size * LINE_HEIGHT) / 2;
  ctx.fillStyle = el.stroke;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const line of lines) {
    ctx.fillText(line, box.x + box.w / 2, y);
    y += size * LINE_HEIGHT;
  }
  ctx.restore();
}

// --- Lines & arrows ----------------------------------------------------------

function drawLine(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "line") return;
  const a = { x: el.startX, y: el.startY };
  const b = { x: el.endX, y: el.endY };
  ctx.strokeStyle = el.stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  applyDash(ctx, el);
  const info = computeLinePath(el);
  if (info.cpx !== undefined && info.cpy !== undefined) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(info.cpx, info.cpy, b.x, b.y);
    ctx.stroke();
  } else if (el.strokeStyle === "rough") {
    strokeSketch(ctx, [a, b], false, seedOf(el.id), ctx.lineWidth);
  } else {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export interface ArrowPathInfo {
  points: Point[];
  routing: ArrowRouting;
  cpx?: number;
  cpy?: number;
  labelPt: Point;
  midPt: Point;
  startAngle: number;
  endAngle: number;
}

export function computeLinePath(el: import("./types").LineElement): ArrowPathInfo {
  return computeArrowPath({ ...el, type: "arrow", routing: el.bendOffset ? "curved" : "straight", bendOffset: el.bendOffset ?? 0 });
}

export function computeArrowPath(el: ArrowElement, scene: CanvasElement[] = []): ArrowPathInfo {
  const { startX, startY, endX, endY } = el;
  const routing = (el.routing || el.elbow || "straight") as ArrowRouting;
  const dx = endX - startX;
  const dy = endY - startY;

  if (routing === "curved") {
    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const offset = el.bendOffset !== undefined ? el.bendOffset : Math.max(22, Math.min(65, dist * 0.22));
    const cpx = mx + nx * offset;
    const cpy = my + ny * offset;
    const labelX = 0.25 * startX + 0.5 * cpx + 0.25 * endX;
    const labelY = 0.25 * startY + 0.5 * cpy + 0.25 * endY;
    return {
      points: [{ x: startX, y: startY }, { x: endX, y: endY }],
      routing: "curved",
      cpx,
      cpy,
      labelPt: { x: labelX, y: labelY },
      midPt: { x: labelX, y: labelY },
      startAngle: Math.atan2(cpy - startY, cpx - startX),
      endAngle: Math.atan2(endY - cpy, endX - cpx),
    };
  }

  if (routing === "elbow") {
    if (el.startBinding || el.endBinding) {
      const boundIds = new Set([el.startBinding?.elementId, el.endBinding?.elementId]);
      const obstacles = scene.filter(e => boundIds.has(e.id) && e.type !== "arrow").map(e => getElementBounds(e));
      const pts = routeConnector({ x: startX, y: startY }, { x: endX, y: endY }, el.startBinding?.anchor, el.endBinding?.anchor, obstacles, el.bendOffset === undefined ? undefined : el.startBinding?.anchor === "top" || el.startBinding?.anchor === "bottom" ? { y: startY + el.bendOffset } : { x: startX + el.bendOffset });
      const lengths = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
      let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
      let midPt = pts[0];
      for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i]) {
          const t = lengths[i] ? remaining / lengths[i] : 0;
          midPt = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
          break;
        }
        remaining -= lengths[i];
      }
      const last = pts.length - 1;
      return { points: pts, routing: "elbow", labelPt: midPt, midPt,
        startAngle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
        endAngle: Math.atan2(pts[last].y - pts[last - 1].y, pts[last].x - pts[last - 1].x) };
    }
    // Unbound elbow arrows use the pointer direction and optional manual bend.
    const horizontalFirst = Math.abs(dx) >= Math.abs(dy);

    let pts: Point[];
    let midPt: Point;
    if (horizontalFirst) {
      const midX = el.bendOffset !== undefined ? startX + el.bendOffset : startX + dx / 2;
      pts = [
        { x: startX, y: startY },
        { x: midX, y: startY },
        { x: midX, y: endY },
        { x: endX, y: endY },
      ];
      midPt = { x: midX, y: (startY + endY) / 2 };
    } else {
      const midY = el.bendOffset !== undefined ? startY + el.bendOffset : startY + dy / 2;
      pts = [
        { x: startX, y: startY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY },
      ];
      midPt = { x: (startX + endX) / 2, y: midY };
    }

    const last = pts.length - 1;
    return {
      points: pts,
      routing: "elbow",
      labelPt: midPt,
      midPt,
      startAngle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x),
      endAngle: Math.atan2(pts[last].y - pts[last - 1].y, pts[last].x - pts[last - 1].x),
    };
  }

  const angle = Math.atan2(dy, dx);
  return {
    points: [{ x: startX, y: startY }, { x: endX, y: endY }],
    routing: "straight",
    labelPt: { x: (startX + endX) / 2, y: (startY + endY) / 2 },
    midPt: { x: (startX + endX) / 2, y: (startY + endY) / 2 },
    startAngle: angle,
    endAngle: angle,
  };
}

function normalizeCap(cap: ArrowHead | boolean | undefined, fallback: ArrowHead): ArrowHead {
  if (cap === undefined) return fallback;
  if (cap === true) return "arrow";
  if (cap === false) return "none";
  return cap;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  angle: number,
  cap: ArrowHead,
  stroke: string,
  strokeWidth: number,
  theme: Theme
) {
  if (cap === "none") return;
  const w = Math.max(1.5, strokeWidth);
  ctx.save();
  ctx.fillStyle = stroke;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.5, w);
  ctx.setLineDash([]);

  if (cap === "arrow") {
    const len = Math.max(10, w * 4.5);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - len * Math.cos(angle - Math.PI / 6), py - len * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(px - len * 0.72 * Math.cos(angle), py - len * 0.72 * Math.sin(angle));
    ctx.lineTo(px - len * Math.cos(angle + Math.PI / 6), py - len * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (cap === "dot") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3.5, w * 1.8), 0, Math.PI * 2);
    ctx.fill();
  } else if (cap === "diamond") {
    const d = Math.max(7, w * 3);
    ctx.fillStyle = theme === "dark" ? "#121212" : "#FFFFFF";
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-d, -d * 0.6);
    ctx.lineTo(-d * 2, 0);
    ctx.lineTo(-d, d * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (cap === "bar") {
    const len = Math.max(6, w * 3);
    ctx.beginPath();
    ctx.moveTo(px + len * Math.cos(angle + Math.PI / 2), py + len * Math.sin(angle + Math.PI / 2));
    ctx.lineTo(px + len * Math.cos(angle - Math.PI / 2), py + len * Math.sin(angle - Math.PI / 2));
    ctx.stroke();
  }
  ctx.restore();
}

const ELBOW_RADIUS = 10;

function drawArrow(ctx: CanvasRenderingContext2D, el: CanvasElement, theme: Theme, flowOffset: number, scene: CanvasElement[] = []) {
  if (el.type !== "arrow") return;
  const arrow = el as ArrowElement;
  const info = computeArrowPath(arrow, scene);
  const { points, cpx, cpy } = info;
  const width = el.strokeWidth || 2;

  ctx.save();
  ctx.strokeStyle = el.stroke;
  ctx.lineWidth = width;
  if (arrow.animated) {
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -flowOffset;
  } else {
    applyDash(ctx, el);
  }

  ctx.beginPath();
  if (info.routing === "curved" && cpx !== undefined && cpy !== undefined) {
    ctx.moveTo(arrow.startX, arrow.startY);
    ctx.quadraticCurveTo(cpx, cpy, arrow.endX, arrow.endY);
    ctx.stroke();
  } else if (info.routing === "elbow" && points.length >= 3) {
    // Rounded corners: arcTo each bend with a fillet of ELBOW_RADIUS.
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const radius = Math.min(ELBOW_RADIUS, Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) / 2, Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) / 2);
      ctx.arcTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, radius);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  } else if (el.strokeStyle === "rough") {
    ctx.setLineDash([]);
    strokeSketch(ctx, [{ x: arrow.startX, y: arrow.startY }, { x: arrow.endX, y: arrow.endY }], false, seedOf(el.id), width);
  } else {
    ctx.moveTo(arrow.startX, arrow.startY);
    ctx.lineTo(arrow.endX, arrow.endY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  drawArrowHead(
    ctx,
    arrow.startX,
    arrow.startY,
    info.startAngle + Math.PI,
    normalizeCap(arrow.arrowHeadStart, "none"),
    el.stroke,
    width,
    theme
  );
  drawArrowHead(
    ctx,
    arrow.endX,
    arrow.endY,
    info.endAngle,
    normalizeCap(arrow.arrowHeadEnd, "arrow"),
    el.stroke,
    width,
    theme
  );
  ctx.restore();

  if (arrow.label) {
    drawPill(ctx, arrow.label, info.labelPt, theme);
  }
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, at: Point, theme: Theme) {
  ctx.save();
  setFont(ctx, 12, "sans", 500);
  const textW = ctx.measureText(text).width;
  const w = textW + 16;
  const h = 22;
  ctx.fillStyle = theme === "dark" ? "rgba(24, 24, 27, 0.95)" : "rgba(255, 255, 255, 0.96)";
  ctx.strokeStyle = theme === "dark" ? "#27272A" : "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(at.x - w / 2, at.y - h / 2, w, h, 6);
  else ctx.rect(at.x - w / 2, at.y - h / 2, w, h);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();
  ctx.fillStyle = theme === "dark" ? "#F4F4F5" : "#0F172A";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, at.x, at.y + 0.5);
  ctx.restore();
}

// --- Freehand & text ---------------------------------------------------------

function drawPencil(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "pencil" || el.points.length < 2) return;
  const pts = el.points;
  ctx.strokeStyle = el.stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  smoothPath(ctx, pts);
  const bounds = getElementBounds(el);
  drawBackgroundFill(ctx, el, () => { smoothPath(ctx, pts); ctx.closePath(); }, { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY });
  ctx.beginPath(); smoothPath(ctx, pts); ctx.stroke();
}


function drawStyledText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, formatting: TextFormatting) {
  ctx.fillText(text, x, y);
  if (!text || (!formatting.underline && !formatting.strikethrough)) return;
  const width = ctx.measureText(text).width;
  const left = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, size / 16); ctx.setLineDash([]);
  for (const offset of [formatting.underline ? size * 1.05 : null, formatting.strikethrough ? size * 0.55 : null]) {
    if (offset === null) continue;
    ctx.beginPath(); ctx.moveTo(left, y + offset); ctx.lineTo(left + width, y + offset); ctx.stroke();
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "text") return;
  if (el.isCodeCard) {
    const result = highlightCode(expandCodeTabs(el.text), el.codeLanguage);
    ctx.save(); ctx.fillStyle = "#10151e"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
    const build = () => ctx.roundRect(el.x - 16, el.y - 16, el.width + 32, el.height + 32, 10);
    drawBackgroundFill(ctx, el, build, { x: el.x - 16, y: el.y - 16, width: el.width + 32, height: el.height + 32 });
    ctx.beginPath(); build(); ctx.stroke();
    ctx.textBaseline = "top"; setFont(ctx, 11, "mono"); ctx.fillStyle = "#94a3b8"; ctx.fillText(result.language, el.x, el.y);
    setFont(ctx, el.fontSize, "mono");
    result.lines.forEach((line, row) => { let x = el.x; for (const token of line) { ctx.fillStyle = token.color; ctx.fillText(token.text, x, el.y + 28 + el.fontSize * 0.25 + row * el.fontSize * 1.5); x += ctx.measureText(token.text).width; } });
    ctx.restore(); return;
  }
  const { x, y, text, fontSize, fontFamily, textAlign, stroke, fill } = el;
  const isDocCard = el.isDocCard || (fill && fill !== "transparent");

  const layout = layoutDocument(ctx, text, fontSize, fontFamily, el);

  // If this element is a Document Card or has a background fill, render a sleek card container
  if (isDocCard) {
    const pad = 16;
    const cardX = x - pad;
    const cardY = y - pad;
    const cardW = Math.max(el.width, layout.totalWidth) + pad * 2;
    const cardH = Math.max(el.height, layout.totalHeight) + pad * 2;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    const buildCard = () => { if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 12); else ctx.rect(cardX, cardY, cardW, cardH); };
    drawBackgroundFill(ctx, el, buildCard, { x: cardX, y: cardY, width: cardW, height: cardH });
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = el.strokeWidth || 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    else ctx.rect(cardX, cardY, cardW, cardH);
    ctx.shadowColor = "transparent";
    ctx.stroke();

    ctx.restore();
  }

  // Draw lines
  ctx.save();
  ctx.textBaseline = "top";

  for (const line of layout.lines) {
    ctx.textAlign = "left";
    const ly = y + line.yOffset;
    setFont(ctx, line.fontSize, fontFamily, line.fontWeight, line.isItalic);
    const color = stroke || "#FFFFFF";
    ctx.fillStyle = color;

    if (line.type === "divider") {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1;
      ctx.moveTo(x, ly + 8);
      ctx.lineTo(x + Math.max(el.width, layout.totalWidth, 120), ly + 8);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    if (line.type === "quote") {
      ctx.save();
      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(x, ly, 3, line.lineHeight - 2);
      ctx.fillStyle = "rgba(244, 244, 245, 0.85)";
      setFont(ctx, line.fontSize, fontFamily, line.fontWeight, true);
      drawStyledText(ctx, line.content, x + 14, ly + 1, line.fontSize, el);
      ctx.restore();
      continue;
    }

    const indentX = x + line.indentLevel * 18;

    if (line.type === "todo-unchecked" || line.type === "todo-checked") {
      const boxSize = 14;
      const boxY = ly + (line.lineHeight - boxSize) / 2;
      ctx.save();
      if (line.type === "todo-checked") {
        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(indentX, boxY, boxSize, boxSize, 3);
        else ctx.rect(indentX, boxY, boxSize, boxSize);
        ctx.fill();
        // Checkmark
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(indentX + 3, boxY + 7);
        ctx.lineTo(indentX + 6, boxY + 10.5);
        ctx.lineTo(indentX + 11, boxY + 3.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(indentX, boxY, boxSize, boxSize, 3);
        else ctx.rect(indentX, boxY, boxSize, boxSize);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Text with optional strikethrough
      const textX = indentX + 22;
      if (line.type === "todo-checked") {
        ctx.save();
        ctx.fillStyle = "rgba(244, 244, 245, 0.55)";
        drawStyledText(ctx, line.content, textX, ly, line.fontSize, el);
        const tw = ctx.measureText(line.content).width;
        ctx.strokeStyle = "rgba(244, 244, 245, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(textX, ly + line.lineHeight / 2);
        ctx.lineTo(textX + tw, ly + line.lineHeight / 2);
        ctx.stroke();
        ctx.restore();
      } else {
        drawStyledText(ctx, line.content, textX, ly, line.fontSize, el);
      }
      continue;
    }

    if (line.type.startsWith("bullet-") || line.type === "number") {
      const bx = indentX + 7;
      const by = ly + line.lineHeight / 2;
      ctx.save();
      ctx.fillStyle = stroke || "#FFFFFF";
      ctx.strokeStyle = stroke || "#FFFFFF";

      switch (line.type) {
        case "bullet-disc":
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "bullet-circle":
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        case "bullet-square":
          ctx.fillRect(bx - 3, by - 3, 6, 6);
          break;
        case "bullet-diamond":
          ctx.beginPath();
          ctx.moveTo(bx, by - 4);
          ctx.lineTo(bx + 4, by);
          ctx.lineTo(bx, by + 4);
          ctx.lineTo(bx - 4, by);
          ctx.closePath();
          ctx.fill();
          break;
        case "bullet-dash":
          ctx.beginPath();
          ctx.moveTo(bx - 4, by);
          ctx.lineTo(bx + 4, by);
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        case "bullet-arrow":
          ctx.beginPath();
          ctx.moveTo(bx - 3, by - 4);
          ctx.lineTo(bx + 4, by);
          ctx.lineTo(bx - 3, by + 4);
          ctx.closePath();
          ctx.fill();
          break;
        case "number":
          setFont(ctx, Math.max(10, line.fontSize - 1), fontFamily, 600);
          ctx.fillStyle = "#A1A1AA";
          ctx.textAlign = "right";
          ctx.fillText(line.prefix || "1.", indentX + 16, ly + 1);
          break;
      }
      ctx.restore();

      const textX = indentX + 22;
      drawStyledText(ctx, line.content, textX, ly, line.fontSize, el);
      continue;
    }

    // Normal line or Heading
    const anchorX = textAlign === "center" ? x + el.width / 2 : textAlign === "right" ? x + el.width : x + line.indentLevel * 18;
    ctx.textAlign = textAlign || "left";
    drawStyledText(ctx, line.content, anchorX, ly, line.fontSize, el);
  }

  ctx.restore();
}

export function getCheckboxAtPoint(
  el: CanvasElement,
  pt: Point
): { lineIndex: number; newChecked: boolean; newText: string } | null {
  if (el.type !== "text") return null;
  const layout = layoutDocument(null, el.text, el.fontSize, el.fontFamily, el);
  const tol = 6;
  const rawLines = el.text.split("\n");

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    if (line.type === "todo-unchecked" || line.type === "todo-checked") {
      const boxSize = 16;
      const boxX = el.x + line.indentLevel * 18;
      const boxY = el.y + line.yOffset + (line.lineHeight - boxSize) / 2;

      if (
        pt.x >= boxX - tol &&
        pt.x <= boxX + boxSize + tol &&
        pt.y >= boxY - tol &&
        pt.y <= boxY + boxSize + tol
      ) {
        const isChecked = line.type === "todo-checked";
        const currentLine = rawLines[i];
        let toggledLine = currentLine;
        if (isChecked) {
          toggledLine = currentLine.replace(/\[[xX]\]/, "[ ]");
        } else {
          toggledLine = currentLine.replace(/\[\s*\]/, "[x]");
        }
        rawLines[i] = toggledLine;
        return {
          lineIndex: i,
          newChecked: !isChecked,
          newText: rawLines.join("\n"),
        };
      }
    }
  }
  return null;
}

function drawSticky(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "sticky") return;
  const { x, y, width, height, text, color, fontSize } = el;
  const r = 8;

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  const background = el.fill !== "transparent" ? el.fill : color || "#FEF08A";
  drawBackgroundFill(ctx, { ...el, fill: background, fillStyle: background !== "transparent" && el.fillStyle === "none" ? "solid" : el.fillStyle }, () => { if (ctx.roundRect) ctx.roundRect(x, y, width, height, r); else ctx.rect(x, y, width, height); }, { x, y, width, height });
  ctx.restore();

  ctx.save();
  const size = fontSize || 14;
  setFont(ctx, size, el.fontFamily || "sans", el.bold ? 700 : 400, el.italic);
  ctx.fillStyle = el.stroke || "#1E293B";
  ctx.textBaseline = "top";
  ctx.textAlign = el.textAlign || "left";
  const lines = wrapText(ctx, text || "", Math.max(20, width - 24));
  const lineHeight = size * LINE_HEIGHT;
  lines.forEach((line, i) => {
    const ly = y + 12 + i * lineHeight;
    if (ly + lineHeight <= y + height) drawStyledText(ctx, line, el.textAlign === "center" ? x + width / 2 : el.textAlign === "right" ? x + width - 12 : x + 12, ly, size, el);
  });
  ctx.restore();
}

// --- Icons ---------------------------------------------------------------------

interface IconPart {
  path: Path2D;
  fill: string | null;
  stroke: string | null;
  lineWidth: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
}

const iconCache = new Map<string, IconPart[]>();

function num(node: Element, name: string, fallback = 0): number {
  const v = parseFloat(node.getAttribute(name) ?? "");
  return isFinite(v) ? v : fallback;
}

function elementToPath(node: Element): Path2D | null {
  const p = new Path2D();
  switch (node.tagName) {
    case "path": {
      const d = node.getAttribute("d");
      return d ? new Path2D(d) : null;
    }
    case "circle":
      p.arc(num(node, "cx"), num(node, "cy"), num(node, "r"), 0, Math.PI * 2);
      return p;
    case "ellipse":
      p.ellipse(num(node, "cx"), num(node, "cy"), num(node, "rx"), num(node, "ry"), 0, 0, Math.PI * 2);
      return p;
    case "rect": {
      const x = num(node, "x");
      const y = num(node, "y");
      const w = num(node, "width");
      const h = num(node, "height");
      const rx = num(node, "rx");
      if (rx > 0 && typeof p.roundRect === "function") p.roundRect(x, y, w, h, rx);
      else p.rect(x, y, w, h);
      return p;
    }
    case "line":
      p.moveTo(num(node, "x1"), num(node, "y1"));
      p.lineTo(num(node, "x2"), num(node, "y2"));
      return p;
    case "polyline":
    case "polygon": {
      const nums = (node.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => isFinite(n));
      if (nums.length < 4) return null;
      p.moveTo(nums[0], nums[1]);
      for (let i = 2; i + 1 < nums.length; i += 2) p.lineTo(nums[i], nums[i + 1]);
      if (node.tagName === "polygon") p.closePath();
      return p;
    }
    default:
      return null;
  }
}

/**
 * Converts an icon's SVG markup into vector Path2D parts. Icons are drawn as
 * vectors, so they stay crisp at any zoom and every shape in the icon renders.
 */
function getIconParts(iconId: string, svgMarkup: string): IconPart[] {
  const cached = iconCache.get(iconId);
  if (cached) return cached;
  const parts: IconPart[] = [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${svgMarkup}</svg>`,
      "image/svg+xml"
    );
    if (!doc.querySelector("parsererror")) {
      for (const node of Array.from(doc.documentElement.children)) {
        const path = elementToPath(node);
        if (!path) continue;
        const fill = node.getAttribute("fill") ?? "none";
        const stroke = node.getAttribute("stroke") ?? "none";
        parts.push({
          path,
          fill: fill === "none" ? null : fill,
          stroke: stroke === "none" ? null : stroke,
          lineWidth: num(node, "stroke-width", 1),
          cap: (node.getAttribute("stroke-linecap") as CanvasLineCap) || "butt",
          join: (node.getAttribute("stroke-linejoin") as CanvasLineJoin) || "miter",
        });
      }
    }
  }
  iconCache.set(iconId, parts);
  return parts;
}

/** Parses an SVG viewBox ("minX minY w h"); defaults to a 24-unit square. */
function parseViewBox(vb?: string): { minX: number; minY: number; size: number } {
  const n = (vb || "").trim().split(/[\s,]+/).map(Number);
  if (n.length === 4 && n.every((v) => isFinite(v)) && n[2] > 0) {
    return { minX: n[0], minY: n[1], size: Math.max(n[2], n[3]) };
  }
  return { minX: 0, minY: 0, size: 24 };
}

function drawIcon(ctx: CanvasRenderingContext2D, el: CanvasElement, onResourceLoad?: () => void) {
  if (el.type !== "icon") return;
  const { x, y, width, height, iconId } = el;
  const iconDef = getIconById(iconId);
  const color = el.iconColor || (iconDef ? iconDef.color : "#3B82F6");

  // Icon glyph: embedded markup (online icons) takes precedence over the bundled set.
  const markup = el.svgMarkup ?? iconDef?.svgPath;
  if (el.svgMarkup) {
    try {
      const image = getIconImage(el.svgMarkup, el.viewBox || "0 0 24 24", color, onResourceLoad);
      const size = Math.max(1, Math.min(width, height));
      if (image.ready) ctx.drawImage(image.image, x + (width - size) / 2, y + (height - size) / 2, size, size);
    } catch { /* Malformed imported artwork must not stop the rest of the board rendering. */ }
  } else if (markup) {
    const vb = parseViewBox(el.viewBox ?? iconDef?.viewBox);
    const size = Math.max(1, Math.min(width, height));
    const scale = size / vb.size;
    const ox = x + (width - size) / 2;
    const oy = y + (height - size) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.translate(-vb.minX, -vb.minY);
    for (const part of getIconParts(iconId, markup)) {
      if (part.fill) {
        ctx.fillStyle = part.fill === "currentColor" ? color : part.fill;
        ctx.fill(part.path);
      }
      if (part.stroke) {
        ctx.strokeStyle = part.stroke === "currentColor" ? color : part.stroke;
        ctx.lineWidth = part.lineWidth;
        ctx.lineCap = part.cap;
        ctx.lineJoin = part.join;
        ctx.stroke(part.path);
      }
    }
    ctx.restore();
  }


}

// --- Frames -------------------------------------------------------------------

function drawFrame(ctx: CanvasRenderingContext2D, el: CanvasElement) {
  if (el.type !== "frame") return;
  const { x, y, w, h } = normalizeRect(el);
  const color = el.stroke || ACCENT;

  ctx.save();
  drawBackgroundFill(ctx, el, () => { if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14); else ctx.rect(x, y, w, h); }, { x, y, width: w, height: h });
  ctx.strokeStyle = color;
  ctx.lineWidth = el.strokeWidth || 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14);
  else ctx.rect(x, y, w, h);
  ctx.stroke();
  ctx.setLineDash([]);

  const title = el.title;
  if (title) {
    setFont(ctx, 12, "sans", 600);
    const tagW = ctx.measureText(title).width + 16;
    const tagH = 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + 12, y - tagH / 2, tagW, tagH, 6);
    else ctx.rect(x + 12, y - tagH / 2, tagW, tagH);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, x + 12 + tagW / 2, y + 0.5);
  }
  ctx.restore();
}

// --- Selection & overlays --------------------------------------------------------

export function drawSelection(ctx: CanvasRenderingContext2D, el: CanvasElement, zoom: number, scene: CanvasElement[] = []) {
  const z = zoom || 1;
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = 1.5 / z;

  if (el.type === "arrow" || el.type === "line") {
    const r = 5 / z;
    const endpoints = [
      { x: el.startX, y: el.startY, bound: el.type === "arrow" && !!el.startBinding },
      { x: el.endX, y: el.endY, bound: el.type === "arrow" && !!el.endBinding },
    ];
    for (const p of endpoints) {
      ctx.fillStyle = p.bound ? ACCENT : "#FFFFFF";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    {
      ctx.fillStyle = "#FFFFFF";
      const mid = (el.type === "arrow" ? computeArrowPath(el, scene) : computeLinePath(el)).midPt;
      const d = 4.5 / z;
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y - d);
      ctx.lineTo(mid.x + d, mid.y);
      ctx.lineTo(mid.x, mid.y + d);
      ctx.lineTo(mid.x - d, mid.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const b = getElementBounds(el);
    const pad = selectionPadding(el, z);
    drawBoundsOutline(ctx, b, z, pad, false);
    drawResizeHandles(ctx, b, z, el.type === "frame", pad);
  }
  ctx.restore();
}

export function drawBoundsOutline(ctx: CanvasRenderingContext2D, b: Bounds, zoom: number, pad = 0, dashed = true) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.2 / zoom;
  ctx.setLineDash(dashed ? [5 / zoom, 4 / zoom] : []);
  ctx.strokeRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2);
  ctx.restore();
}

export type ResizeHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w";

/** Shared positions for painting and hit testing. Side centers belong to connectors. */
export function getResizeHandles(b: Bounds, zoom: number, includeSides = false, pad = 5 / zoom): { handle: ResizeHandle; x: number; y: number }[] {
  const x0 = b.minX - pad, x1 = b.maxX + pad;
  const y0 = b.minY - pad, y1 = b.maxY + pad;
  const corners: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: "nw", x: x0, y: y0 }, { handle: "ne", x: x1, y: y0 },
    { handle: "se", x: x1, y: y1 }, { handle: "sw", x: x0, y: y1 },
  ];
  // Frames have no connector ports, so their edge resize handles remain useful.
  if (includeSides) corners.push(
    { handle: "n", x: (x0 + x1) / 2, y: y0 }, { handle: "e", x: x1, y: (y0 + y1) / 2 },
    { handle: "s", x: (x0 + x1) / 2, y: y1 }, { handle: "w", x: x0, y: (y0 + y1) / 2 },
  );
  return corners;
}

export function drawResizeHandles(ctx: CanvasRenderingContext2D, b: Bounds, zoom: number, includeSides = false, pad = 5 / zoom) {
  const s = 8 / zoom;
  const pts = getResizeHandles(b, zoom, includeSides, pad);
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5 / zoom;
  for (const p of pts) {
    ctx.beginPath();
    ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawElementAnchors(
  ctx: CanvasRenderingContext2D,
  anchors: { anchor: AnchorPosition; x: number; y: number }[],
  snappedAnchor: AnchorPosition | null | undefined,
  zoom = 1
) {
  ctx.save();
  for (const a of anchors) {
    const snapped = snappedAnchor === a.anchor;
    const r = (snapped ? 6 : 4.5) / zoom;
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.fillStyle = snapped ? ACCENT : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = (snapped ? 2 : 1.5) / zoom;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMarquee(ctx: CanvasRenderingContext2D, b: Bounds, zoom: number) {
  ctx.save();
  ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1 / zoom;
  ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  ctx.restore();
}
