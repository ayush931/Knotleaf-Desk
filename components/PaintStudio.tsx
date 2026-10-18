'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Redo2, Download, Upload, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { FillControls } from './FillControls';
import { drawBackgroundFill } from '@/draw/backgroundFill';
import type { FillStyle } from '@/draw/types';
import { ColorControl } from './ColorControl';
import { PaintDocument, MAX_PAINT_LAYERS, validatePaintSize, floodFill, hexRgba, clampRect, extractPixels, clearPixels, pastePixels, type PixelRect } from '@/lib/paint';
import { parsePaintProject, type PaintProject } from '@/lib/paintProject';
import { getImageResource } from '@/draw/imageResource';
import { FONT_OPTIONS } from '@/draw/fonts';
import { setFont, loadCanvasFonts } from '@/draw/renderer';
import type { ImageElement, FontFamily } from '@/draw/types';

type PaintTool = 'brush' | 'pencil' | 'eraser' | 'fill' | 'picker' | 'select' | 'line' | 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'star' | 'hexagon' | 'text';
const tools: [PaintTool, string][] = [['brush', 'Brush'], ['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill bucket'], ['picker', 'Color picker'], ['select', 'Select area'], ['line', 'Line'], ['rectangle', 'Rectangle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['diamond', 'Diamond'], ['star', 'Star'], ['hexagon', 'Hexagon'], ['text', 'Text']];
const button = 'rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:pointer-events-none';
const field = 'w-full min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200';
function layerCanvas(width: number, height: number, pixels: Uint8ClampedArray) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Your browser does not support image editing.');
  const data = ctx.createImageData(width, height); data.data.set(pixels); ctx.putImageData(data, 0, 0); return canvas;
}
function imageData(ctx: CanvasRenderingContext2D, pixels: Uint8ClampedArray, width: number, height: number) { const data = ctx.createImageData(width, height); data.data.set(pixels); return data; }
function composite(doc: PaintDocument, preview?: HTMLCanvasElement | null, background?: string) {
  const out = document.createElement('canvas'); out.width = doc.width; out.height = doc.height;
  const ctx = out.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, out.width, out.height); }
  for (const layer of doc.layers) if (layer.visible) { ctx.globalAlpha = layer.opacity; ctx.drawImage(layer.id === doc.activeId && preview ? preview : layerCanvas(doc.width, doc.height, layer.pixels), 0, 0); }
  ctx.globalAlpha = 1; return out;
}
interface Gesture { pointer: number; start: { x: number; y: number }; last: { x: number; y: number }; canvas: HTMLCanvasElement; original: Uint8ClampedArray; moving?: PixelRect; selection?: PixelRect }
interface Props { open: boolean; onClose: () => void; onInsert: (source: string, width: number, height: number) => void; selectedImage?: ImageElement | null }
export function PaintStudio({ open, onClose, onInsert, selectedImage }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null), file = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState(() => new PaintDocument()), [version, setVersion] = useState(0);
  const [tool, setTool] = useState<PaintTool>('brush'), [color, setColor] = useState('#3b82f6'), [fillColor, setFillColor] = useState('#f59e0b');
  const [size, setSize] = useState(8), [brush, setBrush] = useState('round'), [opacity, setOpacity] = useState(1), [filled, setFilled] = useState(false), [fillStyle, setFillStyle] = useState<FillStyle>('solid'), [fillOpacity, setFillOpacity] = useState(1), [tolerance, setTolerance] = useState(0);
  const [text, setText] = useState(''), [fontSize, setFontSize] = useState(32), [font, setFontFamily] = useState<FontFamily>('sans');
  const [zoom, setZoom] = useState(1), [selection, setSelection] = useState<PixelRect | null>(null), [dimensions, setDimensions] = useState({ width: 960, height: 640 }), [scaleImage, setScaleImage] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [confirmNew, setConfirmNew] = useState(false), [pendingProject, setPendingProject] = useState<PaintDocument | null>(null), [hasClipboard, setHasClipboard] = useState(false), [insertFormat, setInsertFormat] = useState("png");
  const gesture = useRef<Gesture | null>(null), preview = useRef<HTMLCanvasElement | null>(null), clipboard = useRef<{ pixels: Uint8ClampedArray; width: number; height: number } | null>(null);
  const mounted = useRef(true), busyRef = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const update = useCallback((message = '') => { preview.current = null; setVersion(v => v + 1); setDimensions({ width: doc.width, height: doc.height }); setDirty(true); setError(''); setNotice(message); }, [doc]);
  const perform = (fn: () => void, message = '') => { try { fn(); update(message); } catch (e) { setError(e instanceof Error ? e.message : 'Could not edit the image.'); } };
  const paintDisplay = useCallback(() => {
    const el = canvas.current; if (!el) return;
    if (el.width !== doc.width) el.width = doc.width; if (el.height !== doc.height) el.height = doc.height;
    const ctx = el.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, doc.width, doc.height); ctx.drawImage(composite(doc, preview.current), 0, 0);
    const rect = gesture.current?.selection || selection;
    if (rect) { ctx.save(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5 / zoom, 4 / zoom]); ctx.strokeRect(rect.x, rect.y, rect.width, rect.height); ctx.restore(); }
  }, [doc, selection, zoom]);
  useEffect(() => { if (open) paintDisplay(); }, [open, version, paintDisplay]);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); void loadCanvasFonts().catch(() => undefined); } else dialog.current?.close();
    return () => { gesture.current = null; preview.current = null; };
  }, [open]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(doc.width - 1, (e.clientX - r.left) * doc.width / r.width)), y: Math.max(0, Math.min(doc.height - 1, (e.clientY - r.top) * doc.height / r.height)) }; };
  const stamp = (ctx: CanvasRenderingContext2D, x: number, y: number, last: { x: number; y: number }) => {
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = tool === 'eraser' ? 1 : opacity * (brush === 'marker' && tool === 'brush' ? 0.3 : 1); ctx.lineWidth = tool === 'pencil' ? 1 : size;
    ctx.lineCap = brush === 'square' && tool === 'brush' ? 'square' : 'round'; ctx.lineJoin = 'round';
    if (brush === 'spray' && tool === 'brush') { for (let i = 0; i < Math.max(6, size * 2); i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * size / 2; ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1, 1); } }
    else { ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(x + 0.01, y + 0.01); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  };
  const outline = (ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, shift: boolean) => {
    let dx = end.x - start.x, dy = end.y - start.y;
    if (shift && tool !== 'line') { const side = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * side; dy = Math.sign(dy || 1) * side; }
    if (shift && tool === 'line') { const length = Math.hypot(dx, dy), angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4; dx = Math.cos(angle) * length; dy = Math.sin(angle) * length; }
    const x = Math.min(start.x, start.x + dx), y = Math.min(start.y, start.y + dy), w = Math.abs(dx), h = Math.abs(dy);
    ctx.strokeStyle = color; ctx.fillStyle = fillColor; ctx.lineWidth = size; ctx.globalAlpha = opacity; ctx.lineJoin = 'round'; ctx.beginPath();
    const build = () => {
    if (tool === 'line') { ctx.moveTo(start.x, start.y); ctx.lineTo(start.x + dx, start.y + dy); }
    else if (tool === 'rectangle') ctx.rect(x, y, w, h);
    else if (tool === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else {
      const count = tool === 'triangle' ? 3 : tool === 'diamond' ? 4 : tool === 'hexagon' ? 6 : 10;
      for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / count, ratio = tool === 'star' && i % 2 ? 0.45 : 1; const px = x + w / 2 + Math.cos(a) * w / 2 * ratio, py = y + h / 2 + Math.sin(a) * h / 2 * ratio; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath();
    }
    };
    if (filled && tool !== 'line') drawBackgroundFill(ctx, { fill: fillColor, fillStyle, fillOpacity }, build, { x, y, width: w, height: h });
    ctx.beginPath(); build(); ctx.stroke(); ctx.globalAlpha = 1;
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || e.isPrimary === false || gesture.current || busyRef.current) return;
    e.preventDefault(); e.currentTarget.focus(); const pt = point(e); setError(''); setNotice('');
    if (tool === 'picker') { const pixel = composite(doc).getContext('2d')!.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data; setColor(`#${[...pixel.slice(0, 3)].map(n => n.toString(16).padStart(2, '0')).join('')}`); setNotice(pixel[3] ? 'Color picked.' : 'This pixel is transparent.'); return; }
    if (!doc.active.visible || doc.active.opacity === 0) { setError('Show the active layer and raise its opacity before drawing.'); return; }
    if (tool === 'fill') { perform(() => {
      const pixels = doc.active.pixels.slice();
      if (fillStyle === 'solid') {
        if (floodFill(pixels, doc.width, doc.height, pt.x, pt.y, [...hexRgba(fillColor).slice(0, 3), Math.round(fillOpacity * 255)] as [number, number, number, number], tolerance)) { doc.checkpoint(); doc.replacePixels(pixels); }
      } else {
        const mask = new Uint8Array(doc.width * doc.height), index = (Math.floor(pt.y) * doc.width + Math.floor(pt.x)) * 4;
        floodFill(pixels, doc.width, doc.height, pt.x, pt.y, [pixels[index] ^ 255, pixels[index + 1], pixels[index + 2], pixels[index + 3]], tolerance, mask);
        const c = layerCanvas(doc.width, doc.height, new Uint8ClampedArray(pixels.length)), ctx = c.getContext('2d')!;
        drawBackgroundFill(ctx, { fill: fillColor, fillStyle, fillOpacity }, () => ctx.rect(0, 0, doc.width, doc.height), { x: 0, y: 0, width: doc.width, height: doc.height });
        const pattern = ctx.getImageData(0, 0, doc.width, doc.height).data, result = doc.active.pixels.slice();
        for (let i = 0; i < mask.length; i++) if (mask[i]) result.set(pattern.subarray(i * 4, i * 4 + 4), i * 4);
        doc.checkpoint(); doc.replacePixels(result);
      }
    }); return; }

    const working = layerCanvas(doc.width, doc.height, doc.active.pixels), ctx = working.getContext('2d')!;
    if (tool === 'text') { if (!text.trim()) { setError('Enter text in the Text to place field, then click the image.'); return; } void runAsync(async () => { await loadCanvasFonts(); perform(() => { doc.checkpoint(); ctx.fillStyle = color; ctx.globalAlpha = opacity; ctx.textBaseline = 'top'; setFont(ctx, fontSize, font); text.split('\n').forEach((line, i) => ctx.fillText(line, pt.x, pt.y + i * fontSize * 1.35)); doc.replacePixels(ctx.getImageData(0, 0, doc.width, doc.height).data); }); }); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    const g: Gesture = { pointer: e.pointerId, start: pt, last: pt, canvas: working, original: doc.active.pixels.slice() };
    if (tool === 'select' && selection && pt.x >= selection.x && pt.x < selection.x + selection.width && pt.y >= selection.y && pt.y < selection.y + selection.height) g.moving = selection;
    else if (tool === 'select') { setSelection(null); g.selection = { x: Math.floor(pt.x), y: Math.floor(pt.y), width: 1, height: 1 }; }
    else if (['brush', 'pencil', 'eraser'].includes(tool)) stamp(ctx, pt.x, pt.y, pt);
    gesture.current = g; preview.current = tool === 'select' && !g.moving ? null : working; paintDisplay();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return; const pt = point(e), ctx = g.canvas.getContext('2d')!;
    if (tool === 'select') {
      if (g.moving) { const rect = { ...g.moving, x: Math.round(g.moving.x + pt.x - g.start.x), y: Math.round(g.moving.y + pt.y - g.start.y) }; const pixels = g.original.slice(); clearPixels(pixels, doc.width, g.moving); pastePixels(pixels, doc.width, doc.height, extractPixels(g.original, doc.width, g.moving), rect); ctx.putImageData(imageData(ctx, pixels, doc.width, doc.height), 0, 0); g.selection = clampRect(rect, doc.width, doc.height); }
      else g.selection = clampRect({ x: Math.min(g.start.x, pt.x), y: Math.min(g.start.y, pt.y), width: Math.abs(pt.x - g.start.x) + 1, height: Math.abs(pt.y - g.start.y) + 1 }, doc.width, doc.height);
    } else if (['brush', 'pencil', 'eraser'].includes(tool)) stamp(ctx, pt.x, pt.y, g.last);
    else { ctx.putImageData(imageData(ctx, g.original, doc.width, doc.height), 0, 0); outline(ctx, g.start, pt, e.shiftKey); }
    g.last = pt; paintDisplay();
  };
  const cancel = () => { gesture.current = null; preview.current = null; paintDisplay(); };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return; move(e); gesture.current = null;
    if (tool === 'select' && !g.moving) { setSelection(g.selection || null); preview.current = null; paintDisplay(); return; }
    doc.checkpoint(); doc.replacePixels(g.canvas.getContext('2d')!.getImageData(0, 0, doc.width, doc.height).data); if (g.selection) setSelection(g.selection); update();
  };
  const copy = (cut = false) => { if (!selection) return; clipboard.current = { pixels: extractPixels(doc.active.pixels, doc.width, selection), width: selection.width, height: selection.height }; setHasClipboard(true); if (cut) perform(() => { doc.checkpoint(); clearPixels(doc.active.pixels, doc.width, selection); }, 'Selection cut.'); else setNotice('Selection copied.'); };
  const paste = () => { const c = clipboard.current; if (!c) return; perform(() => { doc.checkpoint(); const rect = { x: selection?.x ?? 0, y: selection?.y ?? 0, width: c.width, height: c.height }; pastePixels(doc.active.pixels, doc.width, doc.height, c.pixels, rect); setSelection(clampRect(rect, doc.width, doc.height)); }, 'Selection pasted.'); };
  const history = (redo = false) => { cancel(); if (redo) doc.redo(); else doc.undo(); setSelection(null); update(); };
  const importDecodedImage = (image: HTMLImageElement, name: string) => {
    if (!mounted.current) return;
    const width = image.naturalWidth, height = image.naturalHeight; validatePaintSize(width, height);
    const empty = doc.layers.length === 1 && !doc.canUndo;
    const nextWidth = empty ? width : doc.width, nextHeight = empty ? height : doc.height;
    const c = document.createElement('canvas'); c.width = nextWidth; c.height = nextHeight; const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    doc.importPixels(ctx.getImageData(0, 0, nextWidth, nextHeight).data, nextWidth, nextHeight, name, empty); setSelection(null); update('Image imported onto its own layer.');
  };
  const importImage = async (source: string, name: string) => { const resource = getImageResource(source); await resource.loaded; importDecodedImage(resource.image, name); };
  const runAsync = async (fn: () => Promise<void>) => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); try { await fn(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not process this image.'); } finally { busyRef.current = false; if (mounted.current) setBusy(false); } };
  const acceptProject = (next: PaintDocument) => { cancel(); setDoc(next); setDimensions({ width: next.width, height: next.height }); setSelection(null); setPendingProject(null); setDirty(false); setNotice('Editable Paint project opened.'); };
  const importFile = (input: File) => runAsync(async () => {
    if (/\.kpaint$/i.test(input.name)) {
      if (input.size > 24_000_000) throw new Error('Choose a Paint project under 24 MB.');
      const project = parsePaintProject(await input.text());
      const next = new PaintDocument(project.width, project.height);
      const layers = [];
      for (const layer of project.layers) {
        const resource = getImageResource(layer.source, undefined, 24_000_000); await resource.loaded;
        if (resource.image.naturalWidth !== project.width || resource.image.naturalHeight !== project.height) throw new Error('A layer has different dimensions from its project.');
        const c = document.createElement('canvas'); c.width = project.width; c.height = project.height; const ctx = c.getContext('2d')!; ctx.drawImage(resource.image, 0, 0);
        layers.push({ id: crypto.randomUUID(), name: layer.name, visible: layer.visible, opacity: layer.opacity, pixels: ctx.getImageData(0, 0, c.width, c.height).data });
      }
      if (!mounted.current) return;
      next.loadLayers(layers); if (dirty) setPendingProject(next); else acceptProject(next); return;
    }
    if (input.size > 3_000_000) throw new Error('Choose an image under 3 MB.');
    if (!/^image\/(png|jpeg|webp|bmp|gif)$/.test(input.type)) throw new Error('Choose a PNG, JPEG, WebP, BMP or GIF image. Animated images import their first frame.');
    const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(input); });
    // Decode arbitrary raster formats once, then store a bounded static PNG.
    const img = new Image(); await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not decode this image.')); img.src = source; }); validatePaintSize(img.naturalWidth, img.naturalHeight);
    importDecodedImage(img, input.name);
  });
  const download = (jpeg = false) => { try { const c = composite(doc, null, jpeg ? '#ffffff' : undefined), a = document.createElement('a'); a.href = c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.92); a.download = `knotleaf-paint.${jpeg ? 'jpg' : 'png'}`; a.click(); setDirty(false); setNotice('Image downloaded.'); } catch { setError('Could not download this image.'); } };
  const downloadProject = () => {
    try {
      const project: PaintProject = { format: 'knotleaf.paint', version: 1, width: doc.width, height: doc.height, layers: doc.layers.map(layer => ({ name: layer.name, visible: layer.visible, opacity: layer.opacity, source: layerCanvas(doc.width, doc.height, layer.pixels).toDataURL('image/png') })) };
      const serialized = JSON.stringify(project); parsePaintProject(serialized);
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'knotleaf-paint.kpaint'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setDirty(false); setNotice('Editable project saved with all layers.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this project.'); }
  };
  const insert = () => { try { const source = composite(doc, null, insertFormat === 'jpeg' ? '#ffffff' : undefined).toDataURL(insertFormat === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92); onInsert(source, doc.width, doc.height); setDirty(false); setNotice('Inserted onto the board. Layers remain available in this Paint workspace.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not insert image.'); } };
  const close = () => { cancel(); onClose(); };
  if (typeof document === 'undefined') return null;
  return createPortal(<dialog ref={dialog} onCancel={e => { e.preventDefault(); close(); }} onClose={onClose} aria-labelledby="paint-title" className="m-auto h-[min(900px,96dvh)] w-[min(1320px,96vw)] max-w-none overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 p-0 text-neutral-100 backdrop:bg-black/70">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 p-3"><h2 id="paint-title" className="mr-auto text-sm font-semibold">Paint workspace</h2>
        <button className={button} disabled={!doc.canUndo || busy} onClick={() => history()} aria-label="Undo paint edit"><Undo2 className="h-4 w-4" /></button><button className={button} disabled={!doc.canRedo || busy} onClick={() => history(true)} aria-label="Redo paint edit"><Redo2 className="h-4 w-4" /></button>
        <button className={button} disabled={busy} onClick={() => file.current?.click()}><Upload className="mr-1 inline h-3 w-3" />Open image / project</button>
        <input ref={file} type="file" accept=".kpaint,image/png,image/jpeg,image/webp,image/bmp,image/gif" aria-label="Import image into Paint" className="hidden" onChange={e => { const image = e.target.files?.[0]; if (image) void importFile(image); e.target.value = ''; }} />
        <button className={button} disabled={busy} onClick={downloadProject}>Save editable project</button>
        <button className={button} disabled={busy} onClick={() => download()}><Download className="mr-1 inline h-3 w-3" />PNG</button><button className={button} disabled={busy} onClick={() => download(true)}>JPEG</button>
        <label className="text-xs text-neutral-400">Board format <select aria-label="Board image format" className="rounded bg-neutral-800 p-1" value={insertFormat} onChange={e => setInsertFormat(e.target.value)}><option value="png">PNG · transparent</option><option value="jpeg">JPEG · white background</option></select></label>
        <button className={`${button} border-blue-500 bg-blue-600 text-white`} disabled={busy} onClick={insert}>Insert onto board</button><button className={button} onClick={close} aria-label="Close Paint workspace"><X className="h-4 w-4" /></button>
      </header>
      {pendingProject && <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-amber-700 p-2 text-xs">Replace this draft with the imported project? Save this draft first.<button className={button} onClick={() => acceptProject(pendingProject)}>Open imported project</button><button className={button} onClick={() => setPendingProject(null)}>Keep current draft</button></div>}
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-800 p-2" role="toolbar" aria-label="Paint tools">{tools.map(([id, name]) => <button key={id} aria-pressed={tool === id} className={`${button} ${tool === id ? 'border-blue-500 bg-blue-600 text-white' : ''}`} disabled={busy} onClick={() => { cancel(); setTool(id); }}>{name}</button>)}</div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <fieldset disabled={busy} aria-label="Paint settings" className="flex max-h-[30dvh] w-full shrink-0 flex-wrap gap-3 overflow-auto border-b border-neutral-800 p-3 md:max-h-none md:w-56 md:flex-col md:flex-nowrap md:border-b-0 md:border-r">
          <div className="min-w-40 space-y-2"><ColorControl label="Paint stroke color" value={color} onChange={setColor} /><ColorControl label="Paint fill color" value={fillColor} onChange={setFillColor} /><button className={button} onClick={() => { setColor(fillColor); setFillColor(color); }}>Swap colors</button></div>
          <label className="text-xs text-neutral-400">Size (px)<input className={field} type="number" min="1" max="100" value={size} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) setSize(Math.max(1, Math.min(100, e.target.valueAsNumber))); }} /></label>
          <label className="text-xs text-neutral-400">Brush<select className={field} value={brush} onChange={e => setBrush(e.target.value)}><option value="round">Round</option><option value="square">Square</option><option value="marker">Marker</option><option value="spray">Airbrush</option></select></label>
          <label className="text-xs text-neutral-400">Opacity {Math.round(opacity * 100)}%<input aria-label="Paint opacity" className="block w-full" type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={e => setOpacity(e.target.valueAsNumber)} /></label>
          <FillControls prefix="Paint background" style={fillStyle} opacity={fillOpacity} onStyle={setFillStyle} onOpacity={setFillOpacity} />
          <button className={button} onClick={() => perform(() => { const pixels = new Uint8ClampedArray(doc.width * doc.height * 4), c = layerCanvas(doc.width, doc.height, pixels), ctx = c.getContext("2d")!; drawBackgroundFill(ctx, { fill: fillColor, fillStyle, fillOpacity }, () => ctx.rect(0, 0, doc.width, doc.height), { x: 0, y: 0, width: doc.width, height: doc.height }); doc.importPixels(ctx.getImageData(0, 0, doc.width, doc.height).data, doc.width, doc.height, "Background", false, true); })}>Add background layer</button>
          <label className="text-xs text-neutral-300"><input type="checkbox" checked={filled} onChange={e => setFilled(e.target.checked)} /> Fill shapes</label>
          <label className="text-xs text-neutral-400">Fill tolerance<input className={field} type="number" min="0" max="255" value={tolerance} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) setTolerance(Math.max(0, Math.min(255, e.target.valueAsNumber))); }} /></label>
          {tool === 'text' && <div className="space-y-2"><label className="text-xs text-neutral-400">Text to place<textarea value={text} onChange={e => setText(e.target.value)} rows={3} className={`${field} resize-none`} /></label><label className="text-xs text-neutral-400">Font<select className={field} value={font} onChange={e => setFontFamily(e.target.value as FontFamily)}>{FONT_OPTIONS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label><label className="text-xs text-neutral-400">Text size<input className={field} type="number" min="8" max="256" value={fontSize} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) setFontSize(Math.max(8, Math.min(256, e.target.valueAsNumber))); }} /></label><p className="text-xs text-neutral-500">Click the image to place your text.</p></div>}
          <details className="min-w-40 border-t border-neutral-800 pt-2"><summary className="cursor-pointer text-xs text-neutral-300">Image size & transforms</summary><div className="mt-2 space-y-2">
            {(['width', 'height'] as const).map(key => <label key={key} className="block text-xs text-neutral-400">{key === 'width' ? 'Width (px)' : 'Height (px)'}<input className={field} type="number" min="1" max="4096" value={Number.isFinite(dimensions[key]) ? dimensions[key] : ''} onChange={e => setDimensions(d => ({ ...d, [key]: e.target.valueAsNumber }))} /></label>)}
            <label className="block text-xs text-neutral-400"><input type="checkbox" checked={scaleImage} onChange={e => setScaleImage(e.target.checked)} /> Scale artwork with canvas</label>
            <button className={button} onClick={() => perform(() => { doc.resize(dimensions.width, dimensions.height, scaleImage); setSelection(null); })}>Apply size</button>
            <div className="flex flex-wrap gap-1">{([['left', 'Rotate left'], ['right', 'Rotate right'], ['horizontal', 'Flip horizontal'], ['vertical', 'Flip vertical']] as const).map(([op, label]) => <button className={button} key={op} onClick={() => perform(() => { doc.transform(op); setSelection(null); })}>{label}</button>)}</div>
          </div></details>
          <details className="min-w-40 border-t border-neutral-800 pt-2" open={tool === 'select'}><summary className="cursor-pointer text-xs text-neutral-300">Selection & crop</summary><div className="mt-2 space-y-2"><p className="text-xs text-neutral-500">Drag an area, then drag inside it to move pixels on the active layer. Copy and cut use the active layer; crop affects all layers.</p>
            <button className={button} onClick={() => { setTool('select'); setSelection({ x: 0, y: 0, width: doc.width, height: doc.height }); }}>Select all</button>
            {selection && <div className="grid grid-cols-2 gap-1">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key} className="text-xs text-neutral-400">{key}<input type="number" className={field} value={selection[key]} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) setSelection(clampRect({ ...selection, [key]: e.target.valueAsNumber }, doc.width, doc.height)); }} /></label>)}</div>}
            <div className="flex flex-wrap gap-1"><button className={button} disabled={!selection} onClick={() => copy()}>Copy</button><button className={button} disabled={!selection} onClick={() => copy(true)}>Cut</button><button className={button} disabled={!hasClipboard} onClick={paste}>Paste</button><button className={button} disabled={!selection} onClick={() => selection && perform(() => { doc.checkpoint(); clearPixels(doc.active.pixels, doc.width, selection); })}>Erase area</button><button className={button} disabled={!selection} onClick={() => selection && perform(() => { doc.crop(selection); setSelection(null); })}>Crop to selection</button></div>
          </div></details>
          <section className="min-w-40 border-t border-neutral-800 pt-2" aria-label="Paint layers"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs text-neutral-300">Layers</h3><button className={button} disabled={doc.layers.length >= MAX_PAINT_LAYERS} onClick={() => perform(() => { doc.addLayer(); })} aria-label="Add paint layer"><Plus className="h-3 w-3" /></button></div>
            {[...doc.layers].reverse().map(layer => <div key={layer.id} className={`mb-1 rounded border p-2 ${layer.id === doc.activeId ? 'border-blue-500' : 'border-neutral-800'}`}><div className="flex gap-1"><button className="min-w-0 flex-1 truncate text-left text-xs" aria-pressed={layer.id === doc.activeId} onClick={() => { cancel(); doc.setActive(layer.id); setVersion(v => v + 1); }}>{layer.name}</button><button className="text-neutral-400" aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => perform(() => { doc.updateLayer(layer.id, { visible: !layer.visible }); })}>{layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button></div>
            {layer.id === doc.activeId && <div className="mt-2 space-y-1"><label className="block text-xs text-neutral-500">Layer name<input className={field} defaultValue={layer.name} key={layer.id + layer.name} onBlur={e => { if (e.target.value.trim() && e.target.value !== layer.name) perform(() => { doc.updateLayer(layer.id, { name: e.target.value.trim().slice(0, 80) }); }); }} /></label><label className="block text-xs text-neutral-500">Layer opacity<input className="block w-full" type="range" min="0" max="1" step="0.1" value={layer.opacity} onChange={e => perform(() => { doc.updateLayer(layer.id, { opacity: e.target.valueAsNumber }); })} /></label><div className="flex gap-1">{([-1, 1] as const).map(direction => <button key={direction} className={button} aria-label={direction > 0 ? 'Move layer up' : 'Move layer down'} disabled={doc.layers.indexOf(layer) + direction < 0 || doc.layers.indexOf(layer) + direction >= doc.layers.length} onClick={() => perform(() => { doc.reorderLayer(layer.id, direction); })}>{direction > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}</button>)}<button className={button} disabled={doc.layers.length === 1} aria-label="Delete active layer" onClick={() => perform(() => { doc.deleteLayer(layer.id); })}><Trash2 className="h-3 w-3" /></button></div></div>}</div>)}
          </section>
          {selectedImage && <button className={button} disabled={busy} onClick={() => void runAsync(() => importImage(selectedImage.source, selectedImage.imageName))}>Import selected board image</button>}
          <button className={button} onClick={() => setConfirmNew(true)}>New image</button>{confirmNew && <div className="rounded border border-amber-700 p-2 text-xs text-neutral-300">Start a new image? Download or insert this draft first.<div className="mt-2 flex gap-1"><button className={button} onClick={() => { const next = new PaintDocument(); setDoc(next); setDimensions({ width: next.width, height: next.height }); setSelection(null); setDirty(false); setConfirmNew(false); }}>Start new image</button><button className={button} onClick={() => setConfirmNew(false)}>Keep draft</button></div></div>}
        </fieldset>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-neutral-950 p-4" onPaste={e => { const image = [...e.clipboardData.files].find(f => f.type.startsWith('image/')); if (image) { e.preventDefault(); void importFile(image); } }}>
          <canvas ref={canvas} tabIndex={0} aria-label="Paint image canvas" role="img" style={{ width: doc.width * zoom, height: doc.height * zoom, maxWidth: 'none', touchAction: 'none', backgroundColor: '#fff', backgroundImage: 'conic-gradient(#d4d4d8 25%, transparent 0 50%, #d4d4d8 0 75%, transparent 0)', backgroundSize: '16px 16px' }} className="block cursor-crosshair shadow-lg focus-visible:outline-2 focus-visible:outline-blue-500" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={e => { const mod = e.ctrlKey || e.metaKey; if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey); } else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setTool('select'); setSelection({ x: 0, y: 0, width: doc.width, height: doc.height }); } else if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copy(); } else if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); copy(true); } else if (mod && e.key.toLowerCase() === 'v' && clipboard.current) { e.preventDefault(); paste(); } }} />
        </div>
      </div>
      <footer className="flex min-h-10 shrink-0 flex-wrap items-center gap-3 border-t border-neutral-800 p-2 text-xs text-neutral-400"><span>{doc.width} × {doc.height} px</span><label>Zoom <select aria-label="Paint zoom" className="rounded bg-neutral-800 p-1" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label><span className="mr-auto">{busy ? 'Importing image…' : dirty ? 'Draft stays here while this board is open. Insert or download to save.' : 'Transparent PNG · JPEG uses a white background · Insert combines visible layers'}</span>{notice && <span role="status" className="text-blue-300">{notice}</span>}{error && <span role="alert" className="text-rose-300">{error}</span>}</footer>
    </div>
  </dialog>, document.body);
}
