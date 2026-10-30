import { sceneFontFamilies } from "./fonts";
import { encodeRaster } from "./rasterEncoder";
import { CanvasElement, Theme, Board, BackgroundSettings, GridType } from "./types";
import { normalizeBackground, isLightBackground } from "@/lib/background.mjs";
import { drawCanvasBackground } from "./backgroundFill";
import { drawElement, getElementBounds, unionBounds, loadCanvasFonts, drawGrid } from "./renderer";
import { getImageResource } from "./imageResource";
import { getIconImage } from "./iconSvg";
import { serializeProject, safeFilename, type ExportScope } from "@/lib/projectFile";

const PADDING = 40;

/** Renders the elements into an offscreen canvas at the given scale. */
export async function renderToCanvas(elements: CanvasElement[], theme: Theme, scale: number, transparent: boolean, scene: CanvasElement[] = elements, background?: BackgroundSettings, gridType: GridType = "dot") {
  await Promise.all([loadCanvasFonts(sceneFontFamilies(elements)), ...elements.filter(el => el.type === "icon" && el.svgMarkup).map(el => el.type === "icon" ? getIconImage(el.svgMarkup!, el.viewBox || "0 0 24 24", el.iconColor || "#3B82F6").loaded : undefined)]);
  await Promise.all(elements.map(el => el.type === "image" ? getImageResource(el.source, undefined, el.localOnly ? Infinity : 4_000_000).loaded : undefined));
  const bounds = unionBounds(elements.map(el => getElementBounds(el, scene)));
  if (!bounds) return null;
  const naturalW = bounds.maxX - bounds.minX + PADDING * 2, naturalH = bounds.maxY - bounds.minY + PADDING * 2;
  const actualScale = Math.min(scale, 16384 / naturalW, 16384 / naturalH, Math.sqrt(32_000_000 / (naturalW * naturalH)));
  if (!Number.isFinite(actualScale) || actualScale <= 0) throw new Error("The canvas dimensions are invalid.");
  const w = Math.max(1, Math.ceil(naturalW * actualScale));
  const h = Math.max(1, Math.ceil(naturalH * actualScale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (!transparent) {
    drawCanvasBackground(ctx, normalizeBackground(background), () => ctx.rect(0, 0, w, h), { x: 0, y: 0, width: w, height: h });
    drawGrid(ctx, w, h, { x:(-bounds.minX+PADDING)*actualScale, y:(-bounds.minY+PADDING)*actualScale }, actualScale, gridType, isLightBackground(background));
  }
  ctx.save();
  ctx.scale(actualScale, actualScale);
  ctx.translate(-bounds.minX + PADDING, -bounds.minY + PADDING);
  let lastYield = performance.now();
  for (let index = 0; index < elements.length; index++) {
    drawElement(ctx, elements[index], { theme, scene });
    if (index % 32 === 31 && performance.now() - lastYield >= 8) {
      await new Promise(resolve => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }
  ctx.restore();
  return canvas;
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export type RasterFormat = "png" | "jpeg" | "webp";

export async function exportToRaster(
  elements: CanvasElement[], theme: Theme, format: RasterFormat,
  transparent = false, scale = 2, scene: CanvasElement[] = elements,
  background?: BackgroundSettings, gridType: GridType = "dot"
): Promise<void> {
  // JPEG has no alpha channel: use the chosen canvas color as an opaque matte.
  const matte = format === "jpeg" ? { ...normalizeBackground(background), fillOpacity: 1 } : background;
  const canvas = await renderToCanvas(elements, theme, scale, format !== "jpeg" && transparent, scene, matte, gridType);
  if (!canvas) throw new Error("Add something to the canvas before exporting an image.");
  const mime = `image/${format}`;
  const blob = await encodeRaster(canvas, mime);
  const url = URL.createObjectURL(blob);
  download(url, `whiteboard-${Date.now()}.${format === "jpeg" ? "jpg" : format}`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToPng(
  elements: CanvasElement[], theme: Theme, transparent = false, scale = 2,
  scene: CanvasElement[] = elements, background?: BackgroundSettings, gridType: GridType = "dot"
): Promise<void> {
  return exportToRaster(elements, theme, "png", transparent, scale, scene, background, gridType);
}

export async function copyPngToClipboard(elements: CanvasElement[], theme: Theme, background?: BackgroundSettings, gridType: GridType = "dot", scene: CanvasElement[] = elements): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  const png = renderToCanvas(elements, theme, 2, false, scene, background, gridType).then(canvas => {
    if (!canvas) throw new Error("Add something to the canvas before copying an image.");
    return encodeRaster(canvas);
  });
  void png.catch(() => undefined);
  try {
    // Start the clipboard request within the user's gesture; pixels can arrive later.
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch { return false; }
}

function slug(title: string) {
  return safeFilename(title).toLowerCase().replace(/\s+/g, "-");
}

export function exportToJson(board: Board): void {
  if(board.largeMarkdown)throw new Error("Download this document as Markdown from Uploaded Markdown. Large files are not embedded in JSON backups.");
  const portable={...board};delete portable.importedMarkdownId;delete portable.largeMarkdown;
  const url = URL.createObjectURL(new Blob([JSON.stringify(portable, null, 2)], { type: "application/json" }));
  download(url, `${slug(board.title)}-${board.id}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportNotesToMarkdown(board: Board): void {
  const url = URL.createObjectURL(new Blob([board.markdownNotes || ""], { type: "text/markdown" }));
  download(url, `${slug(board.title)}-notes.md`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProjectFile(board: Board, scope: ExportScope = "project") {
  const url = URL.createObjectURL(new Blob([serializeProject(board, scope)], { type: "application/json" }));
  download(url, `${safeFilename(board.title)}${scope === "project" ? "" : `-${scope}`}.knotleaf`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
