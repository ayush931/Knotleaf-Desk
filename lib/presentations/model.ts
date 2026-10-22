import { EXTRA_THEMES, normalizeDesign, type DeckDesign } from "./design";
export const THEMES = {
  ...EXTRA_THEMES,
  midnight: {
    label: "Keynote · cinematic clarity",
    background: "#101622",
    ink: "#edf3ff",
    accent: "#7db5ff",
    muted: "#a4b6d0",
    wash: "radial-gradient(ellipse at 100% 0%, #1e3454 0%, #101622 65%)",
    heading: "Arial, sans-serif",
  },
  paper: {
    label: "Editorial · warm paper",
    background: "#f5f1e8",
    ink: "#272a31",
    accent: "#345f9c",
    muted: "#68685f",
    wash: "linear-gradient(135deg, #faf8f2 0%, #eee8da 100%)",
    heading: "Georgia, serif",
  },
  slate: {
    label: "Nordic · arctic structure",
    background: "#2e3440",
    ink: "#f3f3f4",
    accent: "#88c0d0",
    muted: "#b0b0bd",
    wash: "linear-gradient(135deg, #303037 0%, #1d1d21 100%)",
    heading: "Arial, sans-serif",
  },
  ocean: {
    label: "Executive · navy and warm brass",
    background: "#172a3d",
    ink: "#f0f8ff",
    accent: "#d2bea0",
    muted: "#a2bfce",
    wash: "radial-gradient(ellipse at 0% 100%, #1e4c5d 0%, #0f2936 70%)",
    heading: "Arial, sans-serif",
  },
  dusk: {
    label: "Modern Report · condensed headlines",
    background: "#252831",
    ink: "#f2f4f8",
    accent: "#adbdd2",
    muted: "#aab2c0",
    wash: "linear-gradient(140deg, #303641 0%, #24272f 100%)",
    heading: "Georgia, serif",
  },
  studio: {
    label: "Corporate · white and navy",
    background: "#f3f7ff",
    ink: "#162844",
    accent: "#2563eb",
    muted: "#5d708c",
    wash: "linear-gradient(120deg, #ffffff 0%, #e9f0fd 100%)",
    heading: "Arial, sans-serif",
  },
} as const;
export type DeckTheme = keyof typeof THEMES;
export type DeckLayout = "standard" | "center" | "split";
export interface Deck extends DeckDesign {
  version: 1;
  source: string;
  theme: DeckTheme;
  layout: DeckLayout;
  title: string;
}
export interface Slide {
  source: string;
  notes: string;
  title: string;
  start: number;
  end: number;
  theme?: DeckTheme;
  layout?: DeckLayout;
}
export const STARTER = `# Your next idea\n\nA presentation by you.\n\n---\n\n## Make your point\n\n- Write in Markdown\n- Separate slides with three dashes\n\n<!-- step -->\n\nReveal this part when you advance.\n\n<!-- notes: These notes are only visible to you in the editor. -->\n\n---\n\n## Bring it to life\n\n> A clear idea deserves room to breathe.\n\nUse images, code, diagrams, and equations.\n`;
/** Delimiters and private notes are recognized only outside fenced code. */
export function parseSlides(source: string): Slide[] {
  const lines = source.split(/(?<=\n)/);
  const slides: Slide[] = [];
  let start = 0,
    offset = 0,
    content = "",
    notes = "",
    jsonNotes: string | undefined,
    fence = "",
    fenceSize = 0,
    inNote = false,
    math = false,
    headingTitle = "",
    theme: string | undefined,
    layout: string | undefined;
  const finish = (end: number) => {
    const title = headingTitle || `Slide ${slides.length + 1}`;
    slides.push({
      source: content.trim(),
      notes: jsonNotes ?? notes.trim(),
      title,
      start,
      end,
      ...(theme && Object.hasOwn(THEMES, theme)
        ? { theme: theme as DeckTheme }
        : {}),
      ...(["standard", "center", "split"].includes(layout || "")
        ? { layout: layout as DeckLayout }
        : {}),
    });
    content = "";
    notes = "";
    jsonNotes = undefined;
    headingTitle = "";
    theme = layout = undefined;
  };
  for (const line of lines) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!inNote && !fence && line.trim() === "$$") {
      math = !math;
      content += line;
    } else if (!inNote && !math && marker) {
      if (!fence) {
        fence = marker[1][0];
        fenceSize = marker[1].length;
      } else if (
        marker[1][0] === fence &&
        marker[1].length >= fenceSize &&
        line.trim() === marker[1]
      )
        fence = "";
      content += line;
    } else if (
      !fence &&
      !math &&
      !inNote &&
      /^\s*<!--\s*notes-json:/.test(line)
    ) {
      const encoded = line.match(
        /^\s*<!--\s*notes-json:\s*(.*?)\s*-->\s*$/,
      )?.[1];
      try {
        const value = JSON.parse(encoded || "");
        if (typeof value === "string") jsonNotes = value;
      } catch {
        /* Malformed private notes remain private. */
      }
    } else if (!fence && !math && !inNote && /^\s*---\s*$/.test(line)) {
      finish(offset);
      start = offset + line.length;
    } else if (
      !fence &&
      !math &&
      (inNote || /^\s*<!--\s*notes?:/i.test(line))
    ) {
      const value = inNote ? line : line.replace(/^\s*<!--\s*notes?:\s*/i, "");
      const end = value.indexOf("-->");
      if (end >= 0) {
        notes += value.slice(0, end) + "\n";
        inNote = false;
        content += value.slice(end + 3);
      } else {
        notes += value;
        inNote = true;
      }
    } else {
      if (!fence && !math) {
        if (!headingTitle)
          headingTitle =
            line
              .trimEnd()
              .match(/^#{1,6}\s+(.+)$/)?.[1]
              ?.replace(/[*_`]/g, "")
              .trim() || "";
        theme =
          line.match(/^\s*<!--\s*theme:\s*([\w-]+)\s*-->\s*$/)?.[1] || theme;
        layout =
          line.match(/^\s*<!--\s*layout:\s*([\w-]+)\s*-->\s*$/)?.[1] || layout;
      }
      content += line;
    }
    offset += line.length;
  }
  finish(source.length);
  return slides;
}
export function slideAt(slides: Slide[], offset: number) {
  const index = slides.findIndex((slide) => offset <= slide.end);
  return index < 0 ? slides.length - 1 : index;
}
export function revealParts(source: string) {
  const parts = [""];
  let fence = "",
    size = 0;
  for (const line of source.split(/(?<=\n)/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
        size = marker[1].length;
      } else if (
        marker[1][0] === fence &&
        marker[1].length >= size &&
        line.trim() === marker[1]
      )
        fence = "";
    }
    if (
      !fence &&
      (/^\s*<!--\s*step\s*-->\s*$/.test(line) ||
        /^\s*\{reveal\}\s*$/.test(line))
    )
      parts.push("");
    else parts[parts.length - 1] += line;
  }
  return parts;
}
export function removeSlide(source: string, index: number): string {
  const slides = parseSlides(source);
  if (index < 0 || index >= slides.length) return source;
  if (slides.length === 1) return "";
  if (index === 0) return source.slice(slides[1].start);
  const before = source.slice(0, slides[index - 1].end);
  return (
    before +
    (index + 1 < slides.length
      ? "\n---\n" + source.slice(slides[index + 1].start)
      : "")
  );
}
export function notesToDeck(notes: string) {
  let fence = "",
    size = 0,
    result = "",
    hasContent = false;
  for (const line of notes.split("\n")) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
        size = marker[1].length;
      } else if (
        marker[1][0] === fence &&
        marker[1].length >= size &&
        line.trim() === marker[1]
      )
        fence = "";
    }
    if (!fence && /^#{1,2}\s/.test(line) && hasContent) result += "\n---\n\n";
    result += line + "\n";
    if (line.trim()) hasContent = true;
  }
  return result;
}
export function readDeck(text: string): Deck {
  const value = JSON.parse(text);
  if (
    value?.version !== 1 ||
    typeof value.source !== "string" ||
    typeof value.title !== "string" ||
    !Object.hasOwn(THEMES, value.theme) ||
    !["standard", "center", "split"].includes(value.layout)
  )
    throw new Error("This is not a supported Knotleaf presentation file.");
  return {
    ...normalizeDesign(value),
    version: 1,
    source: value.source,
    title: value.title,
    theme: value.theme,
    layout: value.layout,
  };
}
export function deckKey(boardId: string) {
  return `knotleaf.presentation.v1:${boardId}`;
}
export function loadDeck(boardId: string, title: string): Deck {
  const stored = localStorage.getItem(deckKey(boardId));
  return stored === null
    ? {
        version: 1,
        source: STARTER,
        title,
        theme: "midnight",
        layout: "standard",
      }
    : readDeck(stored);
}

export function revealCount(source: string) {
  let count = 0,
    fence = "",
    size = 0;
  for (const line of source.split("\n")) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
        size = marker[1].length;
      } else if (
        marker[1][0] === fence &&
        marker[1].length >= size &&
        line.trim() === marker[1]
      )
        fence = "";
      continue;
    }
    if (
      !fence &&
      (/^\s*<!--\s*step\s*-->\s*$/.test(line) || /\{reveal\}\s*$/.test(line))
    )
      count++;
  }
  return count;
}
