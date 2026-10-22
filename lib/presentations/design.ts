import { FONT_OPTIONS, fontCssStack, type FontFamily } from "@/draw/fonts";
export const BACKDROPS = [
  "theme",
  "none",
  "grid",
  "dots",
  "topo",
  "beams",
  "waves",
  "mesh",
] as const;
export const COMPOSITIONS = [
  "classic",
  "minimal",
  "editorial",
  "spotlight",
] as const;
export const TRANSITIONS = ["slide", "fade", "zoom", "lift", "none"] as const;
export type Backdrop = (typeof BACKDROPS)[number];
export interface DeckDesign {
  kind?: "markdown" | "html";
  backdrop?: Backdrop;
  template?: (typeof COMPOSITIONS)[number];
  transition?: (typeof TRANSITIONS)[number];
  headingFont?: FontFamily;
  bodyFont?: FontFamily;
  bodySize?: number;
  animateBackground?: boolean;
  animateBlocks?: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundOpacity?: number;
  allowScripts?: boolean;
}
const palette = (
  label: string,
  background: string,
  ink: string,
  accent: string,
  muted: string,
  heading = "Arial, sans-serif",
) => ({
  label,
  background,
  ink,
  accent,
  muted,
  heading,
  wash: `radial-gradient(ellipse at 100% 0%, ${accent}18 0%, ${background} 75%)`,
});
export const EXTRA_THEMES = {
  blueprint: palette(
    "Blueprint · precise navy",
    "#172538",
    "#f0f4fa",
    "#9fbce3",
    "#adbbcd",
  ),
  linen: palette(
    "Solarized · low-glare reading",
    "#fdf6e3",
    "#586e75",
    "#268bd2",
    "#657b83",
    "Georgia, serif",
  ),
  glacier: palette(
    "Architect · precise and airy",
    "#edf2f5",
    "#263744",
    "#54748e",
    "#687d8c",
  ),
  obsidian: palette(
    "Simple Dark · pure typography",
    "#17181b",
    "#f1f2f4",
    "#acbdd7",
    "#a5a9b2",
  ),
  sand: palette(
    "Classic Report · formal serif",
    "#e9e5dd",
    "#33312d",
    "#626b78",
    "#77736c",
    "Georgia, serif",
  ),
  gallery: palette(
    "Swiss · bold typographic grid",
    "#fafafa",
    "#17191e",
    "#cf3b36",
    "#5f636b",
  ),
} as const;
export function normalizeDesign(value: Record<string, unknown>): DeckDesign {
  const next: DeckDesign = {};
  if (value.kind === "html" || value.kind === "markdown")
    next.kind = value.kind;
  if (BACKDROPS.includes(value.backdrop as Backdrop))
    next.backdrop = value.backdrop as Backdrop;
  if (COMPOSITIONS.includes(value.template as DeckDesign["template"] & string))
    next.template = value.template as DeckDesign["template"];
  if (
    TRANSITIONS.includes(value.transition as DeckDesign["transition"] & string)
  )
    next.transition = value.transition as DeckDesign["transition"];
  for (const key of ["headingFont", "bodyFont"] as const)
    if (FONT_OPTIONS.some((font) => font.id === value[key]))
      next[key] = value[key] as FontFamily;
  for (const key of [
    "animateBackground",
    "animateBlocks",
    "allowScripts",
  ] as const)
    if (typeof value[key] === "boolean") next[key] = value[key];
  if (typeof value.bodySize === "number" && Number.isFinite(value.bodySize))
    next.bodySize = Math.max(12, Math.min(64, value.bodySize));
  if (
    typeof value.backgroundColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(value.backgroundColor)
  )
    next.backgroundColor = value.backgroundColor;
  if (
    typeof value.backgroundImage === "string" &&
    /^(data:image\/(?:png|jpeg|webp|gif|svg\+xml|avif);|https?:\/\/)/i.test(
      value.backgroundImage,
    )
  )
    next.backgroundImage = value.backgroundImage;
  if (
    typeof value.backgroundOpacity === "number" &&
    Number.isFinite(value.backgroundOpacity)
  )
    next.backgroundOpacity = Math.max(0, Math.min(1, value.backgroundOpacity));
  return next;
}
export function resolvedFont(font: FontFamily | undefined, fallback: string) {
  if (!font) return fallback;
  return fontCssStack(font).replace(/var\((--[^)]+)\)/g, (_, key: string) =>
    typeof window === "undefined"
      ? "Arial"
      : window
          .getComputedStyle(document.documentElement)
          .getPropertyValue(key)
          .trim() || "Arial",
  );
}
export function themeBackdrop(theme: string, backdrop?: Backdrop) {
  if (backdrop && backdrop !== "theme") return backdrop;
  const backgrounds: Record<string, string> = {
    midnight: "mesh",
    paper: "none",
    slate: "topo",
    ocean: "none",
    dusk: "mesh",
    studio: "none",
    blueprint: "grid",
    ember: "beams",
    fern: "rings",
    linen: "none",
    rose: "orbs",
    glacier: "grid",
    indigo: "mesh",
    obsidian: "beams",
    citrus: "dots",
    velvet: "aurora",
    cobalt: "grid",
    sand: "waves",
    mint: "rings",
    gallery: "none",
  };
  return backgrounds[theme] || "orbs";
}

export function themeTypography(theme: string): {
  heading: FontFamily;
  body: FontFamily;
  size: number;
} {
  const map: Record<
    string,
    { heading: FontFamily; body: FontFamily; size: number }
  > = {
    midnight: { heading: "manrope", body: "sans", size: 30 },
    studio: { heading: "sans", body: "sans", size: 30 },
    paper: { heading: "playfair", body: "serif", size: 29 },
    slate: { heading: "manrope", body: "sans", size: 30 },
    blueprint: { heading: "space-grotesk", body: "sans", size: 29 },
    linen: { heading: "serif", body: "sans", size: 30 },
    gallery: { heading: "condensed", body: "sans", size: 29 },
    obsidian: { heading: "dm-sans", body: "manrope", size: 30 },
    ocean: { heading: "cormorant", body: "sans", size: 30 },
    dusk: { heading: "condensed", body: "dm-sans", size: 29 },
    glacier: { heading: "space-grotesk", body: "manrope", size: 29 },
    sand: { heading: "baskerville", body: "baskerville", size: 29 },
  };
  return map[theme] || map.midnight;
}
