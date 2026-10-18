import { CanvasElement, Theme, Board } from "./types";
import { drawElement, getElementBounds, unionBounds, loadCanvasFonts } from "./renderer";
import { getIconImage } from "./iconSvg";
import { serializeProject, safeFilename, type ExportScope } from "@/lib/projectFile";

const PADDING = 40;

/** Renders the elements into an offscreen canvas at the given scale. */
export async function renderToCanvas(elements: CanvasElement[], theme: Theme, scale: number, transparent: boolean, scene: CanvasElement[] = elements) {
  await Promise.all([loadCanvasFonts(), ...elements.filter(el => el.type === "icon" && el.svgMarkup).map(el => el.type === "icon" ? getIconImage(el.svgMarkup!, el.viewBox || "0 0 24 24", el.iconColor || "#3B82F6").loaded : undefined)]);
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
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  ctx.scale(actualScale, actualScale);
  ctx.translate(-bounds.minX + PADDING, -bounds.minY + PADDING);
  elements.forEach((el) => drawElement(ctx, el, { theme, scene }));
  ctx.restore();
  return canvas;
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export async function exportToPng(
  elements: CanvasElement[],
  theme: Theme,
  transparent: boolean = false,
  scale: number = 2,
  scene: CanvasElement[] = elements
): Promise<void> {
  const canvas = await renderToCanvas(elements, theme, scale, transparent, scene);
  if (!canvas) throw new Error("Add something to the canvas before exporting an image.");
  download(canvas.toDataURL("image/png"), `whiteboard-${Date.now()}.png`);
}

export async function copyPngToClipboard(elements: CanvasElement[], theme: Theme): Promise<boolean> {
  const canvas = await renderToCanvas(elements, theme, 2, false);
  if (!canvas) return false;
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(false);
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        resolve(true);
      } catch (err) {
        console.error("Failed to copy image to clipboard", err);
        resolve(false);
      }
    });
  });
}

function slug(title: string) {
  return safeFilename(title).toLowerCase().replace(/\s+/g, "-");
}

export function exportToJson(board: Board): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }));
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
