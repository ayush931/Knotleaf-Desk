import { deckKey, readDeck, type Deck } from "./model";
export interface DeckSummary {
  id: string;
  title: string;
  kind: "markdown" | "html";
  updatedAt: number;
  size: number;
}
const INDEX = "knotleaf.presentations.library.v1";
const deleted = new Set<string>();
export function listDecks(): DeckSummary[] {
  const raw = localStorage.getItem(INDEX);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.title === "string" &&
        Number.isFinite(item.updatedAt),
    )
  )
    throw new Error(
      "The presentation library index could not be read. Existing documents have been left untouched.",
    );
  return value.sort((a, b) => b.updatedAt - a.updatedAt);
}
function publish() {
  window.dispatchEvent(new Event("knotleaf-presentation-library"));
}
export function writeDeck(id: string, deck: Deck) {
  if (deleted.has(id)) return;
  const list = listDecks().filter((item) => item.id !== id);
  list.unshift({
    id,
    title: deck.title,
    kind: deck.kind || "markdown",
    updatedAt: Date.now(),
    size: deck.source.length,
  });
  const key = deckKey(id);
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, JSON.stringify(deck));
  try {
    localStorage.setItem(INDEX, JSON.stringify(list));
  } catch (error) {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
    throw error;
  }
  publish();
}
export function newDeck(
  title: string,
  kind: "markdown" | "html" = "markdown",
  source?: string,
): string {
  return saveNewDeck({
    version: 1,
    title,
    kind,
    source: source ?? (kind === "html"
      ? '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<style>body{margin:0;padding:8vw;background:#f5f5f3;color:#253344;font:20px/1.6 system-ui}h1{font-size:clamp(40px,8vw,90px);line-height:1.1;letter-spacing:-.04em}section{max-width:920px;margin:auto}</style>\n<section><h1>A clear perspective.</h1><p>Your document starts here.</p></section>\n</html>'
      : "# A clear perspective\n\nYour next presentation starts here.\n"),
    theme: "midnight",
    layout: "standard",
    transition: "fade",
  });
}
function saveNewDeck(deck: Deck): string {
  const names = new Set(listDecks().map((item) => item.title));
  const base = deck.title || "Untitled presentation";
  let name = base,
    suffix = 2;
  while (names.has(name)) name = `${base} (${suffix++})`;
  const id = crypto.randomUUID();
  writeDeck(id, { ...deck, title: name });
  return id;
}
export function duplicateDeck(id: string, draft?: Deck): string {
  const raw = draft ? null : localStorage.getItem(deckKey(id));
  const deck = draft ?? (raw ? readDeck(raw) : null);
  if (!deck) throw new Error("The presentation could not be found.");
  return saveNewDeck({ ...deck, title: `${deck.title} copy` });
}
export function deleteDeck(id: string) {
  const next = listDecks().filter((item) => item.id !== id);
  localStorage.setItem(INDEX, JSON.stringify(next));
  deleted.add(id);
  localStorage.removeItem(deckKey(id));
  publish();
}
export function activeDeck(boardId: string) {
  return (
    localStorage.getItem(`knotleaf.presentation.active:${boardId}`) || boardId
  );
}
export function chooseDeck(boardId: string, id: string) {
  localStorage.setItem(`knotleaf.presentation.active:${boardId}`, id);
}
