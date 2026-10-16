import { CanvasElement, Theme, Board } from "./types";
import { drawElement, getElementBounds, unionBounds } from "./renderer";

const PADDING = 40;

/** Renders the elements into an offscreen canvas at the given scale. */
function renderToCanvas(elements: CanvasElement[], theme: Theme, scale: number, transparent: boolean, scene: CanvasElement[] = elements) {
  const bounds = unionBounds(elements.map(el => getElementBounds(el, scene)));
  if (!bounds) return null;
  const w = Math.ceil((bounds.maxX - bounds.minX + PADDING * 2) * scale);
  const h = Math.ceil((bounds.maxY - bounds.minY + PADDING * 2) * scale);

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
  ctx.scale(scale, scale);
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

export function exportToPng(
  elements: CanvasElement[],
  theme: Theme,
  transparent: boolean = false,
  scale: number = 2,
  scene: CanvasElement[] = elements
): void {
  const canvas = renderToCanvas(elements, theme, scale, transparent, scene);
  if (!canvas) return;
  download(canvas.toDataURL("image/png"), `whiteboard-${Date.now()}.png`);
}

export async function copyPngToClipboard(elements: CanvasElement[], theme: Theme): Promise<boolean> {
  const canvas = renderToCanvas(elements, theme, 2, false);
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
  return title.toLowerCase().trim().replace(/\s+/g, "-") || "board";
}

export function exportToJson(board: Board): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }));
  download(url, `${slug(board.title)}-${board.id}.json`);
  URL.revokeObjectURL(url);
}

export function exportNotesToMarkdown(board: Board): void {
  const url = URL.createObjectURL(new Blob([board.markdownNotes || ""], { type: "text/markdown" }));
  download(url, `${slug(board.title)}-notes.md`);
  URL.revokeObjectURL(url);
}
