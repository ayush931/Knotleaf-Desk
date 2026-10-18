export interface NoteMatch { start: number; end: number }
function literalPattern(query: string, matchCase: boolean) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
}
export function findNoteMatches(value: string, query: string, matchCase = false): NoteMatch[] {
  if (!query) return [];
  return [...value.matchAll(literalPattern(query, matchCase))].map(match => ({ start: match.index, end: match.index + match[0].length }));
}
export function replaceAllNoteMatches(value: string, query: string, replacement: string, matchCase = false) {
  let count = 0;
  const next = query ? value.replace(literalPattern(query, matchCase), () => { count++; return replacement; }) : value;
  return { value: next, count };
}
