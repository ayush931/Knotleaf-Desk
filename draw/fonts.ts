import type { FontFamily } from "./types";

/** Shared font identity for canvas, editing and the appearance picker. */
export const FONT_FAMILIES = {
  sans: { label: "Inter", variable: "--font-inter", fallback: "Inter, ui-sans-serif, system-ui, sans-serif" },
  hand: { label: "Caveat", variable: "--font-caveat", fallback: 'Caveat, "Comic Sans MS", cursive' },
  mono: { label: "Fira Code", variable: "--font-fira", fallback: '"Fira Code", ui-monospace, monospace' },
  serif: { label: "Lora", variable: "--font-lora", fallback: 'Lora, Georgia, "Times New Roman", serif' },
  rounded: { label: "Nunito", variable: "--font-nunito", fallback: 'Nunito, "Arial Rounded MT Bold", ui-sans-serif, sans-serif' },
  condensed: { label: "Roboto Condensed", variable: "--font-condensed", fallback: '"Roboto Condensed", "Arial Narrow", sans-serif' },
  print: { label: "Patrick Hand", variable: "--font-patrick", fallback: '"Patrick Hand", "Comic Sans MS", cursive' },
} satisfies Record<FontFamily, { label: string; variable: string; fallback: string }>;

export const FONT_OPTIONS = (Object.keys(FONT_FAMILIES) as FontFamily[]).map(id => ({ id, ...FONT_FAMILIES[id] }));

export function fontCssStack(family: FontFamily): string {
  const font = FONT_FAMILIES[family] || FONT_FAMILIES.sans;
  return `var(${font.variable}), ${font.fallback}`;
}
