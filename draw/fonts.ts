import type { CanvasElement } from "./types";
export const FONT_GROUPS = [
  "Everyday",
  "Serif",
  "Handwriting",
  "Playful & display",
  "Monospace",
] as const;
const family = (
  label: string,
  variable: string,
  fallback: string,
  group: (typeof FONT_GROUPS)[number],
  quick = false,
) => ({ label, variable, fallback, group, quick });
/** Stable identities shared by canvas, notes, storage and exports. */
export const FONT_FAMILIES = {
  sans: family(
    "Inter",
    "--font-inter",
    "Inter, ui-sans-serif, system-ui, sans-serif",
    "Everyday",
    true,
  ),
  hand: family(
    "Caveat",
    "--font-caveat",
    'Caveat, "Comic Sans MS", cursive',
    "Handwriting",
    true,
  ),
  mono: family(
    "Fira Code",
    "--font-fira",
    '"Fira Code", ui-monospace, monospace',
    "Monospace",
    true,
  ),
  serif: family(
    "Lora",
    "--font-lora",
    'Lora, Georgia, "Times New Roman", serif',
    "Serif",
    true,
  ),
  rounded: family(
    "Nunito",
    "--font-nunito",
    'Nunito, "Arial Rounded MT Bold", ui-sans-serif, sans-serif',
    "Everyday",
    true,
  ),
  condensed: family(
    "Roboto Condensed",
    "--font-condensed",
    '"Roboto Condensed", "Arial Narrow", sans-serif',
    "Everyday",
    true,
  ),
  print: family(
    "Patrick Hand",
    "--font-patrick",
    '"Patrick Hand", "Comic Sans MS", cursive',
    "Handwriting",
    true,
  ),
  manrope: family(
    "Manrope",
    "--font-manrope",
    '"Manrope", sans-serif',
    "Everyday",
  ),
  "dm-sans": family(
    "DM Sans",
    "--font-dm-sans",
    '"DM Sans", sans-serif',
    "Everyday",
  ),
  "space-grotesk": family(
    "Space Grotesk",
    "--font-space-grotesk",
    '"Space Grotesk", sans-serif',
    "Everyday",
  ),
  outfit: family("Outfit", "--font-outfit", '"Outfit", sans-serif', "Everyday"),
  quicksand: family(
    "Quicksand",
    "--font-quicksand",
    '"Quicksand", sans-serif',
    "Everyday",
  ),
  comfortaa: family(
    "Comfortaa",
    "--font-comfortaa",
    '"Comfortaa", sans-serif',
    "Everyday",
  ),
  playfair: family(
    "Playfair Display",
    "--font-playfair",
    '"Playfair Display", serif',
    "Serif",
  ),
  cormorant: family(
    "Cormorant Garamond",
    "--font-cormorant",
    '"Cormorant Garamond", serif',
    "Serif",
  ),
  baskerville: family(
    "Libre Baskerville",
    "--font-baskerville",
    '"Libre Baskerville", serif',
    "Serif",
  ),
  "dm-serif": family(
    "DM Serif Display",
    "--font-dm-serif",
    '"DM Serif Display", serif',
    "Serif",
  ),
  kalam: family("Kalam", "--font-kalam", '"Kalam", cursive', "Handwriting"),
  shadows: family(
    "Shadows Into Light",
    "--font-shadows",
    '"Shadows Into Light", cursive',
    "Handwriting",
  ),
  indie: family(
    "Indie Flower",
    "--font-indie",
    '"Indie Flower", cursive',
    "Handwriting",
  ),
  marker: family(
    "Permanent Marker",
    "--font-marker",
    '"Permanent Marker", cursive',
    "Handwriting",
  ),
  architect: family(
    "Architects Daughter",
    "--font-architect",
    '"Architects Daughter", cursive',
    "Handwriting",
  ),
  fredoka: family(
    "Fredoka",
    "--font-fredoka",
    '"Fredoka", sans-serif',
    "Playful & display",
  ),
  baloo: family(
    "Baloo 2",
    "--font-baloo",
    '"Baloo 2", sans-serif',
    "Playful & display",
  ),
  righteous: family(
    "Righteous",
    "--font-righteous",
    '"Righteous", sans-serif',
    "Playful & display",
  ),
  lobster: family(
    "Lobster",
    "--font-lobster",
    '"Lobster", cursive',
    "Playful & display",
  ),
  bangers: family(
    "Bangers",
    "--font-bangers",
    '"Bangers", cursive',
    "Playful & display",
  ),
  abril: family(
    "Abril Fatface",
    "--font-abril",
    '"Abril Fatface", serif',
    "Playful & display",
  ),
  typewriter: family(
    "Special Elite",
    "--font-typewriter",
    '"Special Elite", monospace',
    "Monospace",
  ),
  "jetbrains-mono": family(
    "JetBrains Mono",
    "--font-jetbrains-mono",
    '"JetBrains Mono", monospace',
    "Monospace",
    true,
  ),
  "space-mono": family(
    "Space Mono",
    "--font-space-mono",
    '"Space Mono", monospace',
    "Monospace",
  ),
};
export type FontFamily = keyof typeof FONT_FAMILIES;
export const FONT_OPTIONS = (Object.keys(FONT_FAMILIES) as FontFamily[]).map(
  (id) => ({ id, ...FONT_FAMILIES[id] }),
);
export const QUICK_FONTS = FONT_OPTIONS.filter((font) => font.quick);
export function sceneFontFamilies(
  elements: readonly CanvasElement[],
): FontFamily[] {
  const families = new Set<FontFamily>(["sans", "mono"]);
  for (const element of elements) {
    if (
      "fontFamily" in element &&
      element.fontFamily &&
      element.fontFamily in FONT_FAMILIES
    )
      families.add(element.fontFamily);
  }
  return [...families];
}
export function fontCssStack(family: FontFamily): string {
  const font = FONT_FAMILIES[family] || FONT_FAMILIES.sans;
  return `var(${font.variable}), ${font.fallback}`;
}
