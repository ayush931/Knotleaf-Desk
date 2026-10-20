import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Board } from './types';
import { safeFilename, type ExportScope } from '@/lib/projectFile';
import { encodeRaster } from './rasterEncoder';
import { renderToCanvas } from './export';
import { normalizeBackground, isLightBackground } from '@/lib/background.mjs';
import { fontStack, loadCanvasFonts } from './renderer';

export interface PdfImages { title: string; canvas?: string | Uint8Array | ArrayBuffer | null; notes?: (string | Uint8Array | ArrayBuffer)[]; includeCanvas: boolean; includeNotes: boolean; backgroundColor?: string }
/** PDF assembly is independent of browser capture, so pagination and output can be verified. */
export async function createProjectPdf(input: PdfImages): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title); pdf.setCreator('Knotleaf Desk'); pdf.setProducer('Knotleaf Desk');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const background = normalizeBackground({ fill:input.backgroundColor || '#121212', fillStyle:'solid', fillOpacity:1 });
  const color = parseInt(background.fill.slice(1),16), paper = rgb((color>>16)/255,((color>>8)&255)/255,(color&255)/255);
  const ink = isLightBackground(background) ? rgb(.09,.12,.17) : rgb(.9,.9,.9);
  const paintPage = (page: ReturnType<typeof pdf.addPage>) => page.drawRectangle({ x:0, y:0, width:page.getWidth(), height:page.getHeight(), color:paper });
  if (input.includeCanvas) {
    const image = input.canvas ? await pdf.embedPng(input.canvas) : null;
    if (image) {
      // Match the image aspect exactly: no letterboxing, headings or white page margins.
      const page = pdf.addPage([image.width/2,image.height/2]);
      page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});
    } else {
      const page = pdf.addPage([842,595]); paintPage(page);
      page.drawText('This canvas is empty.',{x:32,y:531,size:11,font,color:ink});
    }
  }
  if (input.includeNotes) {
    if (input.notes?.length) for (const data of input.notes) {
      const image = await pdf.embedPng(data), page = pdf.addPage([595,842]); paintPage(page);
      const scale = Math.min(531/image.width,746/image.height);
      page.drawImage(image,{x:32,y:794-image.height*scale,width:image.width*scale,height:image.height*scale});
    } else {
      const page = pdf.addPage([595,842]); paintPage(page);
      page.drawText('Notes',{x:32,y:794,size:14,font,color:ink});
      page.drawText('No notes yet.',{x:32,y:766,size:11,font,color:ink});
    }
  }
  if (!pdf.getPageCount()) throw new Error('Choose canvas, notes, or both.');
  return pdf.save();
}

export function choosePageEnd(start: number, pageHeight: number, totalHeight: number, lines: { top: number; bottom: number }[]): number {
  const target = Math.min(start + pageHeight, totalHeight);
  const crossing = lines.filter(line => line.top < target && line.bottom > target && line.top > start + 1);
  return crossing.length ? Math.min(...crossing.map(line => line.top)) : target;
}

async function captureNotes(board: Board): Promise<Uint8Array[]> {
  if (!board.markdownNotes.trim()) return [];
  const { default: html2canvas } = await import('html2canvas');
  await loadCanvasFonts();
  const background = normalizeBackground(board.background), light = isLightBackground(background);
  const ink = light ? '#17202b' : '#e5e5e5';
  const host = document.createElement('section');
  host.className = 'knotleaf-pdf-notes';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:absolute;left:-10000px;top:0;width:794px;padding:0 24px;box-sizing:border-box;background:${background.fill};color:${ink};font:14px/1.8 ${fontStack('sans')};overflow-wrap:anywhere;`;
  host.innerHTML = renderToStaticMarkup(<><style>{`
    .knotleaf-pdf-notes * { box-sizing:border-box; color:inherit; }
    .knotleaf-pdf-notes h1 { font-size:28px;line-height:1.3;margin:0 0 24px;font-weight:700; }
    .knotleaf-pdf-notes h2 { font-size:23px;margin:24px 0 12px;font-weight:700; }
    .knotleaf-pdf-notes h3 { font-size:19px;margin:20px 0 10px;font-weight:700; }
    .knotleaf-pdf-notes p,.knotleaf-pdf-notes ul,.knotleaf-pdf-notes ol { margin:12px 0; }
    .knotleaf-pdf-notes ul { list-style:disc;padding-left:26px; } .knotleaf-pdf-notes ol { list-style:decimal;padding-left:26px; }
    .knotleaf-pdf-notes pre { white-space:pre-wrap;word-break:break-word;background:${light ? "#f1f5f9" : "#18181b"};border-radius:6px;padding:14px;font:13px/1.6 monospace; }
    .knotleaf-pdf-notes code { font-family:monospace; } .knotleaf-pdf-notes strong { font-weight:700; } .knotleaf-pdf-notes em { font-style:italic; }
    .knotleaf-pdf-notes table { border-collapse:collapse;width:100%;table-layout:fixed;font-size:14px; }
    .knotleaf-pdf-notes td,.knotleaf-pdf-notes th { border:1px solid ${light ? "#cbd5e1" : "#3f3f46"};padding:8px;overflow-wrap:anywhere; }
    .knotleaf-pdf-notes blockquote { border-left:3px solid #3b82f6;padding-left:16px;margin:16px 0; }
    .knotleaf-pdf-notes a { color:${light ? "#2563eb" : "#60a5fa"};text-decoration:underline; }
  `}</style><h1>{board.title}</h1><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>[Image: {alt || 'linked image'}]</span> }}>{board.markdownNotes}</ReactMarkdown></>);
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    const origin = host.getBoundingClientRect().top;
    const lines: { top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.tagName === 'STYLE' || !node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) if (rect.height) lines.push({ top: rect.top - origin, bottom: rect.bottom - origin });
    }
    const total = host.scrollHeight, pages: Uint8Array[] = [];
    for (let start = 0; start < total;) {
      if (pages.length >= 500) throw new Error('Notes exceed 500 PDF pages. Download a project backup or Markdown instead.');
      const end = choosePageEnd(start, 1048, total, lines);
      const canvas = await html2canvas(host, { y: start, height: Math.ceil(end - start), width: 794, scale: 1.5, backgroundColor: background.fill, logging: false, windowWidth: 1024 });
      pages.push(new Uint8Array(await (await encodeRaster(canvas)).arrayBuffer())); canvas.width=0; canvas.height=0; start = end;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return pages;
  } finally { host.remove(); }
}

export async function exportProjectPdf(board: Board, scope: ExportScope) {
  const includeCanvas = scope !== 'notes', includeNotes = scope !== 'canvas';
  const canvas = includeCanvas ? await renderToCanvas(board.elements, board.theme, 2, false, board.elements, board.background, board.gridType || "dot") : null;
  const bytes = await createProjectPdf({ title: board.title, backgroundColor:normalizeBackground(board.background).fill, includeCanvas, includeNotes, canvas: canvas ? new Uint8Array(await (await encodeRaster(canvas)).arrayBuffer()) : null, notes: includeNotes ? await captureNotes(board) : [] });
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = `${safeFilename(board.title)}-${scope}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
