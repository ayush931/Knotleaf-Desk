import { test, expect } from 'bun:test';
import { PDFDocument } from 'pdf-lib';
import { createProjectPdf, choosePageEnd } from '../draw/projectPdf.tsx';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8i8AAAAASUVORK5CYII=';
test('PDF exports independently support canvas, notes and the combined project', async () => {
  for (const [canvas, notes, count] of [[true, false, 1], [false, true, 2], [true, true, 3]]) {
    const bytes = await createProjectPdf({ title: 'Résumé नमस्ते', includeCanvas: canvas, includeNotes: notes, canvas: png, notes: [png, png] });
    const reopened = await PDFDocument.load(bytes);
    expect(reopened.getPageCount()).toBe(count); expect(reopened.getTitle()).toBe('Résumé नमस्ते'); expect(reopened.getCreator()).toBe('Knotleaf Desk');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  }
});
test('empty PDF sections remain downloadable and there are no zero-page PDFs', async () => {
  const pdf = await PDFDocument.load(await createProjectPdf({ title: 'Empty', includeCanvas: true, includeNotes: true }));
  expect(pdf.getPageCount()).toBe(2);
  await expect(createProjectPdf({ title: 'Invalid', includeCanvas: false, includeNotes: false })).rejects.toThrow('Choose');
});
test('PDF notes break before intersecting lines and always advance', () => {
  const lines = [{ top: 990, bottom: 1020 }, { top: 1030, bottom: 1060 }, { top: 2030, bottom: 2060 }];
  expect(choosePageEnd(0, 1048, 2500, lines)).toBe(1030);
  expect(choosePageEnd(1030, 1048, 2500, lines)).toBe(2078);
  expect(choosePageEnd(2078, 1048, 2500, lines)).toBe(2500);
  expect(choosePageEnd(0, 100, 2500, [{ top: 0, bottom: 2000 }])).toBe(100);
});


test('canvas PDF pages match artwork aspect ratio without added margins or labels',async()=>{
 const pdf=await PDFDocument.load(await createProjectPdf({title:'Canvas parity',canvas:png,includeCanvas:true,includeNotes:false}));
 expect(pdf.getPage(0).getWidth()).toBe(pdf.getPage(0).getHeight());
});
