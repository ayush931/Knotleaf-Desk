import hljs from 'highlight.js/lib/common';
export const CODE_LANGUAGES = ['auto', 'plaintext', 'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'sql', 'json', 'xml', 'css', 'bash', 'yaml', 'markdown'];
type HighlightedCode = { language: string; html: string; lines: { text: string; color: string }[][] };
const cache = new Map<string, { value: HighlightedCode; bytes: number }>();
const CACHE_BYTES = 1_000_000;
let cachedBytes = 0;
const palette: Record<string, string> = { keyword: '#b8a8c4', literal: '#b8a8c4', string: '#afbaa8', comment: '#808995' };
export function highlightCode(code: string, requested = 'auto') {
  const source = code.slice(0, 100_000), key = requested + '\0' + source;
  const cached = cache.get(key); if (cached) return cached.value;
  const result = source.length > 16_384 ? hljs.highlight(source, { language: 'plaintext' }) : requested !== 'auto' && hljs.getLanguage(requested) ? hljs.highlight(source, { language: requested, ignoreIllegals: true }) : hljs.highlightAuto(source, CODE_LANGUAGES.filter(l => l !== 'auto' && hljs.getLanguage(l)));
  const lines: { text: string; color: string }[][] = [[]], colors = ['#d4d4d8'];
  for (const match of result.value.matchAll(/<span class="([^"]*)">|(<\/span>)|([^<]+)/g)) {
    if (match[1]) { const kind = match[1].split(/\s+/).find(c => c.startsWith('hljs-'))?.slice(5) || ''; colors.push(palette[kind] || colors.at(-1)!); }
    else if (match[2]) colors.pop();
    else { const value = match[3].replace(/&(amp|lt|gt|quot|#x27|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }[entity]!)); value.split('\n').forEach((text, i) => { if (i) lines.push([]); lines.at(-1)!.push({ text, color: colors.at(-1) || '#d4d4d8' }); }); }
  }
  const value = { html: result.value, language: result.language || 'plaintext', lines };
  const bytes = (key.length + value.html.length + source.length) * 2 + lines.reduce((total,line)=>total+line.length*64,0);
  if(bytes<=CACHE_BYTES){cache.set(key,{value,bytes});cachedBytes+=bytes;}
  while(cache.size>40||cachedBytes>CACHE_BYTES){const oldest=cache.keys().next().value!;cachedBytes-=cache.get(oldest)!.bytes;cache.delete(oldest);}
  return value;
}

export function expandCodeTabs(code: string) {
  return code.split('\n').map(line => { let column = 0; return Array.from(line).map(char => { if (char === '\t') { const count = 2 - column % 2; column += count; return ' '.repeat(count); } column++; return char; }).join(''); }).join('\n');
}
export function highlightNotesSource(notes: string) {
  const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  let html = '', block = '', fence = '', language = 'auto';
  const flush = () => { if (block) html += block.length <= 100_000 ? highlightCode(block, language).html : escape(block); block = ''; };
  for (const line of notes.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})([\w+-]*)[^\n]*\n?$/);
    if (!fence && marker) { fence = marker[1]; language = marker[2] || 'auto'; html += escape(line); }
    else if (fence && new RegExp(`^\\s{0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) { flush(); html += escape(line); fence = ''; }
    else if (fence) block += line;
    else html += escape(line);
  }
  flush(); return html;
}
