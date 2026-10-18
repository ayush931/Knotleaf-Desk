/** Bounded, DOM-independent raster operations shared by Paint tools and tests. */
export const MAX_PAINT_PIXELS = 4_194_304;
export const MAX_PAINT_LAYERS = 8;
export type RGBA = [number, number, number, number];
export interface PixelRect { x: number; y: number; width: number; height: number }
export interface PaintLayer { id: string; name: string; visible: boolean; opacity: number; pixels: Uint8ClampedArray }
export function validatePaintSize(width: number, height: number) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 4096) || width * height > MAX_PAINT_PIXELS) throw new Error('Use whole-number dimensions up to 4096 px and 4 million pixels in total.');
}
export function hexRgba(hex: string): RGBA {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Choose a six-digit hex color.');
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
}
export function clampRect(r: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(width - 1, Math.floor(r.x))), y = Math.max(0, Math.min(height - 1, Math.floor(r.y)));
  return { x, y, width: Math.max(1, Math.min(width - x, Math.round(r.width))), height: Math.max(1, Math.min(height - y, Math.round(r.height))) };
}
/** Iterative flood fill marks visited pixels before pushing, with bounded memory. */
export function floodFill(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: RGBA, tolerance = 0, mask?: Uint8Array): boolean {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const start = y * width + x, target = [...pixels.slice(start * 4, start * 4 + 4)];
  if (target.every((c, i) => c === color[i])) return false;
  tolerance = Math.max(0, Math.min(255, tolerance));
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 1; queue[0] = start; visited[start] = 1;
  while (head < tail) {
    const at = queue[head++], offset = at * 4;
    if (!target.every((c, i) => Math.abs(pixels[offset + i] - c) <= tolerance)) continue;
    pixels.set(color, offset); if (mask) mask[at] = 1;
    const col = at % width;
    const enqueue = (p: number) => { if (!visited[p]) { visited[p] = 1; queue[tail++] = p; } };
    if (col > 0) enqueue(at - 1); if (col < width - 1) enqueue(at + 1);
    if (at >= width) enqueue(at - width); if (at < width * (height - 1)) enqueue(at + width);
  }
  return true;
}
export function extractPixels(pixels: Uint8ClampedArray, width: number, rect: PixelRect) {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) out.set(pixels.subarray(((rect.y + y) * width + rect.x) * 4, ((rect.y + y) * width + rect.x + rect.width) * 4), y * rect.width * 4);
  return out;
}
export function pastePixels(target: Uint8ClampedArray, width: number, height: number, source: Uint8ClampedArray, rect: PixelRect) {
  for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) {
    const tx = rect.x + x, ty = rect.y + y;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    target.set(source.subarray((y * rect.width + x) * 4, (y * rect.width + x + 1) * 4), (ty * width + tx) * 4);
  }
}
export function clearPixels(target: Uint8ClampedArray, width: number, rect: PixelRect) {
  for (let y = rect.y; y < rect.y + rect.height; y++) target.fill(0, (y * width + rect.x) * 4, (y * width + rect.x + rect.width) * 4);
}
export function transformPixels(pixels: Uint8ClampedArray, width: number, height: number, operation: 'left' | 'right' | 'horizontal' | 'vertical') {
  const rotate = operation === 'left' || operation === 'right', w = rotate ? height : width, h = rotate ? width : height;
  const out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = operation === 'right' ? height - 1 - y : operation === 'left' ? y : operation === 'horizontal' ? width - 1 - x : x;
    const ny = operation === 'right' ? x : operation === 'left' ? width - 1 - x : operation === 'vertical' ? height - 1 - y : y;
    out.set(pixels.subarray((y * width + x) * 4, (y * width + x + 1) * 4), (ny * w + nx) * 4);
  }
  return { pixels: out, width: w, height: h };
}
export function resizePixels(pixels: Uint8ClampedArray, width: number, height: number, nextWidth: number, nextHeight: number, scale: boolean) {
  validatePaintSize(nextWidth, nextHeight);
  const out = new Uint8ClampedArray(nextWidth * nextHeight * 4);
  if (!scale) { pastePixels(out, nextWidth, nextHeight, pixels, { x: 0, y: 0, width, height }); return out; }
  for (let y = 0; y < nextHeight; y++) for (let x = 0; x < nextWidth; x++) {
    const from = (Math.min(height - 1, Math.floor(y * height / nextHeight)) * width + Math.min(width - 1, Math.floor(x * width / nextWidth))) * 4;
    out.set(pixels.subarray(from, from + 4), (y * nextWidth + x) * 4);
  }
  return out;
}
interface Snapshot { width: number; height: number; activeId: string; layers: PaintLayer[] }
export class PaintDocument {
  width: number; height: number; layers: PaintLayer[]; activeId: string;
  private undoStates: Snapshot[] = []; private redoStates: Snapshot[] = [];
  constructor(width = 960, height = 640) {
    validatePaintSize(width, height); this.width = width; this.height = height;
    this.layers = [{ id: crypto.randomUUID(), name: 'Layer 1', visible: true, opacity: 1, pixels: new Uint8ClampedArray(width * height * 4) }]; this.activeId = this.layers[0].id;
  }
  get active() { return this.layers.find(l => l.id === this.activeId)!; }
  get canUndo() { return this.undoStates.length > 0; } get canRedo() { return this.redoStates.length > 0; }
  private snapshot(): Snapshot { return { width: this.width, height: this.height, activeId: this.activeId, layers: this.layers.map(l => ({ ...l, pixels: l.pixels.slice() })) }; }
  private trim(states: Snapshot[]) {
    let bytes = states.reduce((n, s) => n + s.layers.reduce((n, l) => n + l.pixels.byteLength, 0), 0);
    while (states.length > 1 && (states.length > 20 || bytes > 64 * 1024 * 1024)) { const first = states.shift()!; bytes -= first.layers.reduce((n, l) => n + l.pixels.byteLength, 0); }
  }
  checkpoint() { this.undoStates.push(this.snapshot()); this.trim(this.undoStates); this.redoStates = []; }
  private restore(s: Snapshot) { this.width = s.width; this.height = s.height; this.activeId = s.activeId; this.layers = s.layers; }
  undo() { const s = this.undoStates.pop(); if (s) { this.redoStates.push(this.snapshot()); this.trim(this.redoStates); this.restore(s); } }
  redo() { const s = this.redoStates.pop(); if (s) { this.undoStates.push(this.snapshot()); this.trim(this.undoStates); this.restore(s); } }
  addLayer(name = `Layer ${this.layers.length + 1}`) {
    if (this.width * this.height * (this.layers.length + 1) > 16_777_216) throw new Error('Reduce the image size before adding more layers.');
    if (this.layers.length >= MAX_PAINT_LAYERS) throw new Error('Use up to 8 layers.');
    this.checkpoint(); const layer = { id: crypto.randomUUID(), name, visible: true, opacity: 1, pixels: new Uint8ClampedArray(this.width * this.height * 4) }; this.layers.push(layer); this.activeId = layer.id; return layer;
  }
  importPixels(pixels: Uint8ClampedArray, width: number, height: number, name: string, replaceBlank: boolean, behind = false) {
    validatePaintSize(width, height);
    if (pixels.length !== width * height * 4) throw new Error('Image dimensions do not match its pixels.');
    if (!replaceBlank && (this.layers.length >= MAX_PAINT_LAYERS || width * height * (this.layers.length + 1) > 16_777_216)) throw new Error('Reduce the image size or number of layers before importing.');
    this.checkpoint();
    const layer = { id: crypto.randomUUID(), name: name.slice(0, 80), visible: true, opacity: 1, pixels };
    if (replaceBlank) { this.width = width; this.height = height; this.layers = [layer]; } else if (behind) this.layers.unshift(layer); else this.layers.push(layer);
    this.activeId = layer.id;
  }
  loadLayers(layers: PaintLayer[]) { this.layers = layers; this.activeId = layers.at(-1)!.id; }
  replacePixels(pixels: Uint8ClampedArray) { this.active.pixels = pixels; }
  setActive(id: string) { if (this.layers.some(l => l.id === id)) this.activeId = id; }
  updateLayer(id: string, props: Partial<Pick<PaintLayer, 'name' | 'visible' | 'opacity'>>) { const layer = this.layers.find(l => l.id === id); if (layer) { this.checkpoint(); Object.assign(layer, props); } }
  reorderLayer(id: string, direction: number) { const index = this.layers.findIndex(l => l.id === id), target = index + direction; if (index >= 0 && target >= 0 && target < this.layers.length) { this.checkpoint(); [this.layers[index], this.layers[target]] = [this.layers[target], this.layers[index]]; } }
  deleteLayer(id: string) { if (this.layers.length <= 1) return; this.checkpoint(); this.layers = this.layers.filter(l => l.id !== id); this.activeId = this.layers.at(-1)!.id; }
  crop(r: PixelRect) { const rect = clampRect(r, this.width, this.height); this.checkpoint(); for (const l of this.layers) l.pixels = extractPixels(l.pixels, this.width, rect); this.width = rect.width; this.height = rect.height; }
  resize(width: number, height: number, scale: boolean) { validatePaintSize(width, height); if (width * height * this.layers.length > 16_777_216) throw new Error('Reduce the number of layers or the image size.'); this.checkpoint(); for (const l of this.layers) l.pixels = resizePixels(l.pixels, this.width, this.height, width, height, scale); this.width = width; this.height = height; }
  transform(operation: 'left' | 'right' | 'horizontal' | 'vertical') {
    this.checkpoint(); const width = this.width, height = this.height;
    for (const l of this.layers) { const result = transformPixels(l.pixels, width, height, operation); l.pixels = result.pixels; this.width = result.width; this.height = result.height; }
  }
}
