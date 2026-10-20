import { beforeAll, afterAll, test, expect } from 'bun:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { normalizeIconSvg, getIconImage } from '../draw/iconSvg.ts';
import { drawElement } from '../draw/renderer.ts';
import { boardToSvg } from '../draw/svgExport.ts';
import { exportToPng, exportToRaster } from '../draw/export.ts';
import { iconUrl, searchOnlineIcons, fetchOnlineIcon } from '../lib/onlineIcons.ts';

const saved = new Map(), draws = [], downloads = [];
let automatic = true;
const pending = [];
class ImageMock {
  set src(value) { this.source = value; const load = () => this.onload?.(); if (automatic) queueMicrotask(load); else pending.push(load); }
}
class Matrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  static fromMatrix(value) { return Object.assign(new Matrix(), value); }
}
const ctx = new Proxy({ measureText: text => ({ width: text.length * 7 }), drawImage: (...args) => draws.push(args) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
beforeAll(() => {
  for (const [key, value] of Object.entries({ DOMParser, XMLSerializer, Image: ImageMock, DOMMatrix: Matrix, document: { createElement: tag => tag === 'canvas' ? { getContext: () => ctx, toDataURL: () => 'data:image/png;base64,test' } : { click() { downloads.push(this.href); } } } })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
});
afterAll(() => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
const artwork = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16" fill="none" stroke="currentColor" stroke-width="2"><defs><linearGradient id="shade"><stop stop-color="#ff0000"/><stop offset="1" stop-color="#00ff00"/></linearGradient><mask id="hole"><rect width="32" height="16" fill="white"/></mask></defs><g transform="translate(2 1)" mask="url(#hole)"><path d="M0 0h20v10H0z" fill="url(#shade)"/></g></svg>';
const base = { id: 'icon', type: 'icon', iconId: 'online:test:group', iconName: 'group', category: 'online', x: 10, y: 20, width: 48, height: 48, stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0, iconColor: '#E2E8F0', badgeBg: '#fff', label: 'Old saved caption' };

test('text export waits for fonts and SVG retains the chosen family', async () => {
  const previous = document.fonts, ready = [], requested = [];
  document.fonts = { load: font => { requested.push(font); return new Promise(resolve => ready.push(resolve)); } };
  const text = { ...base, type: 'text', text: 'Serif sample', fontSize: 24, fontFamily: 'serif', textAlign: 'left', label: undefined };
  downloads.length = 0;
  try {
    const exporting = exportToPng([text], 'dark', true);
    expect(downloads).toHaveLength(0); expect(requested.some(font => font.includes('Lora'))).toBe(true);
    ready.forEach(resolve => resolve([])); await exporting;
    expect(downloads).toHaveLength(1); expect(boardToSvg([text], true)).toContain('Lora');
  } finally { if (previous) document.fonts = previous; else delete document.fonts; ready.forEach(resolve => resolve([])); }
});

test('online SVG retains root styles, groups, transforms, gradients and local masks', () => {
  const safe = normalizeIconSvg(artwork);
  expect(safe.viewBox).toBe('0 0 32 16');
  const root = new DOMParser().parseFromString(safe.svgMarkup, 'image/svg+xml').documentElement;
  expect(root.getAttribute('fill')).toBe('none'); expect(root.getAttribute('stroke')).toBe('currentColor');
  expect(root.getElementsByTagName('linearGradient').length).toBe(1);
  expect(root.getElementsByTagName('g')[0].getAttribute('transform')).toBe('translate(2 1)');
  expect(root.getElementsByTagName('g')[0].getAttribute('mask')).toBe('url(#hole)');
});

test('SVG sanitizer excludes executable markup and external references but keeps safe inline styling', () => {
  const safe = normalizeIconSvg('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject/><image href="https://example.com/image"/><g style="fill:#f00;stroke:currentColor;filter:url(https://example.com/filter)"><path d="M0 0h2v2z" onclick="evil()" fill="url(https://example.com/paint)"/><use href="#local"/><use href="https://example.com/icon.svg#x"/></g></svg>');
  expect(safe.svgMarkup).not.toMatch(/script|foreignObject|<image|onload|onclick|https:|style=/);
  expect(safe.svgMarkup).toContain('fill="#f00"'); expect(safe.svgMarkup).toContain('href="#local"');
  expect(() => normalizeIconSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 24"><path d="M0 0z"/></svg>')).toThrow('dimensions');
  expect(() => normalizeIconSvg('<!DOCTYPE svg><svg/>')).toThrow();
});

test('online canvas icons paint only the glyph, without saved badge backgrounds or captions', async () => {
  const safe = normalizeIconSvg(artwork);
  const image = getIconImage(safe.svgMarkup, safe.viewBox, base.iconColor);
  await image.loaded;
  const paints = [];
  const context = new Proxy({ drawImage: (...args) => paints.push(['image', ...args.slice(1)]), fillText: () => paints.push(['text']), fill: () => paints.push(['background']), stroke: () => paints.push(['border']) }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  drawElement(context, { ...base, ...safe }, { theme: 'dark' });
  expect(paints).toEqual([['image', 10, 20, 48, 48]]);
  expect(decodeURIComponent(image.image.source)).toContain('color="#E2E8F0"');
});

test('icon cache keys include artwork and color, and not just the library ID', async () => {
  const first = getIconImage('<path d="M0 0h4v4z"/>', '0 0 24 24', '#f00');
  const second = getIconImage('<path d="M0 0h8v8z"/>', '0 0 24 24', '#f00');
  const third = getIconImage('<path d="M0 0h4v4z"/>', '0 0 24 24', '#0f0');
  expect(first).not.toBe(second); expect(first).not.toBe(third);
  await Promise.all([first.loaded, second.loaded, third.loaded]);
});

test('PNG export waits for icon decoding and SVG export keeps transparent, unlabelled artwork', async () => {
  const safe = normalizeIconSvg(artwork.replace('translate(2 1)', 'translate(3 1)'));
  const icon = { ...base, ...safe };
  automatic = false; draws.length = 0; downloads.length = 0;
  try {
    const exporting = exportToPng([icon], 'dark', true);
    expect(downloads).toHaveLength(0); expect(pending).toHaveLength(1);
    pending.splice(0).forEach(load => load()); await exporting;
    expect(draws).toHaveLength(1); expect(downloads).toHaveLength(1);
    const svg = boardToSvg([icon], true);
    expect(svg).toContain('linearGradient'); expect(svg).toContain('mask="url(#icon-icon-hole)"');
    expect(svg).not.toContain('Old saved caption'); expect(svg).not.toContain('badge');
    expect(svg).toContain('width="48" height="48"');
  } finally { automatic = true; pending.splice(0).forEach(load => load()); }
});

test('online search encodes queries, validates and deduplicates IDs, and colors dark-mode previews', async () => {
  let requested;
  const ids = await searchOnlineIcons(' aws lambda ', new AbortController().signal, async url => { requested = url; return new Response(JSON.stringify({ icons: ['logos:aws-lambda', 'lucide:cloud', 'lucide:cloud', 'https://bad', null] })); });
  expect(requested).toContain('query=aws%20lambda'); expect(ids).toEqual(['logos:aws-lambda', 'lucide:cloud']);
  expect(iconUrl('lucide:cloud', true)).toContain('color=%23e2e8f0');
  expect(() => iconUrl('../bad')).toThrow();
});

test('aborted and failed searches cannot produce successful results', async () => {
  const controller = new AbortController();
  await expect(searchOnlineIcons('cloud', controller.signal, async () => { controller.abort(); return new Response('{"icons":["lucide:cloud"]}'); })).rejects.toMatchObject({ name: 'AbortError' });
  await expect(searchOnlineIcons('cloud', new AbortController().signal, async () => new Response('busy', { status: 429 }))).rejects.toThrow('busy');
  await expect(searchOnlineIcons('cloud', new AbortController().signal, async () => new Response('<html>error</html>'))).rejects.toThrow('invalid search response');
  expect(await fetchOnlineIcon('lucide:cloud', new AbortController().signal, async () => new Response(artwork))).toBe(artwork);
});


test('exported icon instances keep gradient and mask references separate', () => {
  const safe = normalizeIconSvg(artwork);
  const svg = boardToSvg([{ ...base, ...safe, id: 'first' }, { ...base, ...safe, id: 'second', x: 100 }], true);
  expect(svg).toContain('id="icon-first-shade"'); expect(svg).toContain('fill="url(#icon-first-shade)"');
  expect(svg).toContain('id="icon-second-shade"'); expect(svg).toContain('fill="url(#icon-second-shade)"');
});

test('embedded Paint images stay self-contained in SVG and PNG waits for decoding', async () => {
  const image = { ...base, type: 'image', source: 'data:image/png;base64,aW1hZ2UtcGFpbnQ=', imageName: 'Paint', width: 120, height: 80 };
  const svg = boardToSvg([image], true);
  expect(svg).toContain('<image x="10" y="20" width="120" height="80"'); expect(svg).toContain(image.source);
  automatic = false; downloads.length = 0;
  try {
    const exporting = exportToPng([image], 'dark', true);
    await new Promise(resolve => setTimeout(resolve, 0)); expect(downloads).toHaveLength(0);
    expect(pending).toHaveLength(1); pending.shift()(); await exporting;
    expect(downloads).toHaveLength(1);
    expect(draws.some(args => args[1] === 10 && args[2] === 20 && args[3] === 120 && args[4] === 80)).toBe(true);
  } finally { automatic = true; pending.length = 0; }
});

test('SVG exports clipped patterned fills with independent alpha and transparent canvas settings', () => {
  const shape = { ...base, type: 'rectangle', fill: '#3b82f6', fillStyle: 'hachure', fillOpacity: 0.3, opacity: 1, label: undefined };
  const svg = boardToSvg([shape], false, [shape], { fill: '#ec4899', fillStyle: 'dots', fillOpacity: 0 });
  expect(svg).toContain('<clipPath'); expect(svg).toContain('clip-path="url(#paint-clip-'); expect(svg).toContain('opacity="0.3"'); expect(svg).not.toContain('#ec4899');
  expect(svg).toContain('stroke="#fff"');
});


test('JPG and WebP downloads use the requested encoding and extension, and reject silent PNG fallback',async()=>{
 const original=document.createElement;const encoded=[],files=[];
 document.createElement=tag=>tag==='canvas'?{getContext:()=>ctx,toDataURL:(mime,quality)=>{encoded.push({mime,quality});return `data:${mime};base64,test`;}}:{click(){files.push({href:this.href,name:this.download});}};
 try{const shape={...base,type:'rectangle'};for(const format of ['jpeg','webp'])await exportToRaster([shape],'dark',format,true,2);
 expect(encoded.map(e=>e.mime)).toEqual(['image/jpeg','image/webp']);expect(files[0].name).toEndWith('.jpg');expect(files[1].name).toEndWith('.webp');expect(files[0].href).toStartWith('blob:');
 document.createElement=tag=>tag==='canvas'?{getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test'}:{click(){throw Error('Should not download a mislabeled file');}};
 await expect(exportToRaster([shape],'dark','webp')).rejects.toThrow('Choose PNG');await expect(exportToRaster([],'dark','jpeg')).rejects.toThrow('Add something');
 }finally{document.createElement=original;}
});


test('exports succeed when system fallback font faces are unavailable',async()=>{
 const previous=document.fonts,requested=[];
 document.fonts={load:query=>{requested.push(query);return query.includes(',')||query.includes('Fallback')?Promise.reject(Error('Missing local Arial')):Promise.resolve([]);}};
 try{downloads.length=0;await exportToPng([{...base,type:'text',text:'Linux export',fontFamily:'sans',fontSize:20}],'dark',true);expect(downloads).toHaveLength(1);expect(requested.length).toBeGreaterThan(0);}
 finally{if(previous)document.fonts=previous;else delete document.fonts;}
});
