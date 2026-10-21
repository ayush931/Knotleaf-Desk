import { FONT_OPTIONS, fontCssStack } from "@/draw/fonts";
import type { FontFamily } from "@/draw/types";

export const NOTE_FONTS = FONT_OPTIONS;
export const NOTE_COLORS = [
  "#e4e4e7",
  "#a1a1aa",
  "#fca5a5",
  "#fdba74",
  "#fde68a",
  "#86efac",
  "#7dd3fc",
  "#c4b5fd",
  "#f9a8d4",
];
export const NOTE_HIGHLIGHTS = [
  "#665329",
  "#633d3d",
  "#4d4532",
  "#324f42",
  "#304f63",
  "#4b3d64",
];
export interface NoteAppearance {
  font: FontFamily;
  size: number;
  lineHeight: number;
  width: "reading" | "wide" | "full";
}
export const DEFAULT_NOTE_APPEARANCE: NoteAppearance = {
  font: "sans",
  size: 16,
  lineHeight: 1.75,
  width: "reading",
};
export function normalizeNoteAppearance(input: unknown): NoteAppearance {
  const value = (
    input && typeof input === "object" ? input : {}
  ) as Partial<NoteAppearance>;
  return {
    font: NOTE_FONTS.some((f) => f.id === value.font) ? value.font! : "sans",
    size:
      Number.isFinite(value.size) && value.size! >= 12 && value.size! <= 24
        ? value.size!
        : 16,
    lineHeight: [1.4, 1.75, 2.1].includes(value.lineHeight!)
      ? value.lineHeight!
      : 1.75,
    width: ["reading", "wide", "full"].includes(value.width!)
      ? value.width!
      : "reading",
  };
}
export function normalizeNoteColor(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (/^#[a-f\d]{6}$/i.test(input)) return input.toLowerCase();
  const rgb = input.match(
    /^rgb\(\s*(\d{1,3})[, ]+\s*(\d{1,3})[, ]+\s*(\d{1,3})\s*\)$/i,
  );
  return rgb && rgb.slice(1).every((n) => +n <= 255)
    ? "#" +
        rgb
          .slice(1)
          .map((n) => (+n).toString(16).padStart(2, "0"))
          .join("")
    : null;
}
export function normalizeNoteFont(input: unknown): FontFamily | null {
  if (typeof input !== "string") return null;
  return (
    NOTE_FONTS.find(
      (f) =>
        f.id === input ||
        f.label.toLowerCase() === input.replace(/["']/g, "").toLowerCase() ||
        fontCssStack(f.id) === input,
    )?.id || null
  );
}
export const noteHref = (id: string) => `#note=${encodeURIComponent(id)}`;
export function readNoteHref(href: string): string | null {
  if (!href.startsWith("#note=")) return null;
  try {
    const id = decodeURIComponent(href.slice(6));
    return id && id.length <= 200 && !/[\u0000-\u001f]/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function linkedNoteIds(markdown: string): string[] {
  const source = markdown
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, "")
    .replace(/<code\b[\s\S]*?<\/code>/gi, "");
  const hrefs = [...source.matchAll(/\]\((#note=[^)\s]+)\)/g)].map(
    (match) => match[1],
  );
  for (const match of source.matchAll(/href\s*=\s*["'](#note=[^"']+)["']/gi))
    hrefs.push(match[1]);
  return [
    ...new Set(hrefs.map(readNoteHref).filter((id): id is string => !!id)),
  ];
}
export const NOTE_TEMPLATES = [
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda, decisions, and clear next steps.",
    content:
      "# Meeting notes\n\n## Agenda\n\n- \n\n## Discussion\n\n\n\n## Decisions\n\n- \n\n## Next steps\n\n- [ ] ",
  },
  {
    id: "lesson",
    name: "Lesson plan",
    description: "Objectives, teaching notes, and practice.",
    content:
      "# Lesson plan\n\n## Learning objectives\n\n- \n\n## Key ideas\n\n> **Remember**\n>\n> \n\n## Walkthrough\n\n1. \n\n## Practice\n\n- [ ] \n\n## Reflection\n\n",
  },
  {
    id: "daily",
    name: "Daily journal",
    description: "Priorities, quick thoughts, and reflection.",
    content:
      "# Daily journal\n\n## Today’s priorities\n\n- [ ] \n- [ ] \n- [ ] \n\n## Notes and ideas\n\n\n\n## What went well?\n\n\n\n## Tomorrow\n\n",
  },
  {
    id: "research",
    name: "Research notebook",
    description: "Questions, sources, findings, and follow-ups.",
    content:
      "# Research notebook\n\n## Question\n\n\n\n## Sources\n\n| Source | Key finding |\n| --- | --- |\n| | |\n\n## Findings\n\n\n\n## Open questions\n\n- [ ] ",
  },
  {
    id: "project",
    name: "Project brief",
    description: "Scope, milestones, risks, and ownership.",
    content:
      "# Project brief\n\n## Goal\n\n\n\n## Scope\n\n- \n\n## Milestones\n\n| Milestone | Owner | Status |\n| --- | --- | --- |\n| | | Planned |\n\n## Risks\n\n- \n\n## Next actions\n\n- [ ] ",
  },
  {
    id: "decision",
    name: "Decision record",
    description: "Context, alternatives, and the chosen direction.",
    content:
      "# Decision record\n\n## Context\n\n\n\n## Options\n\n1. \n2. \n\n## Decision\n\n> **Decision**\n>\n> \n\n## Consequences\n\n- \n\n## Follow-up\n\n- [ ] ",
  },
] as const;

export interface NotePage {
  id: string;
  title: string;
  markdownNotes: string;
}
