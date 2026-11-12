/** Curated, high-chroma drawing colors shared by the toolbar, inspector and starter flows. */
export interface ColorChoice {
  name: string;
  value: string;
}

export const PREMIUM_STROKES: readonly ColorChoice[] = [
  { name: 'Iris', value: '#A78BFA' },
  { name: 'Cobalt', value: '#60A5FA' },
  { name: 'Aqua', value: '#22D3EE' },
  { name: 'Jade', value: '#2DD4BF' },
  { name: 'Lime', value: '#A3E635' },
  { name: 'Amber', value: '#FBBF24' },
  { name: 'Coral', value: '#FB7185' },
  { name: 'Fuchsia', value: '#E879F9' },
];

export interface ColorMood {
  id: string;
  name: string;
  description: string;
  stroke: string;
  fill: string;
  glow: string;
}

/** Coordinated stroke + surface pairs for one-click styling. */
export const COLOR_MOODS: readonly ColorMood[] = [
  { id: 'aurora', name: 'Aurora', description: 'Violet light with deep indigo', stroke: '#A78BFA', fill: '#312E81', glow: '#22D3EE' },
  { id: 'citrus', name: 'Citrus', description: 'Warm amber with espresso', stroke: '#FBBF24', fill: '#3F2D0B', glow: '#A3E635' },
  { id: 'reef', name: 'Reef', description: 'Sea glass with deep teal', stroke: '#2DD4BF', fill: '#134E4A', glow: '#60A5FA' },
  { id: 'rose', name: 'Rose', description: 'Soft coral with wine', stroke: '#FB7185', fill: '#4C1D2E', glow: '#E879F9' },
  { id: 'mineral', name: 'Mineral', description: 'Cool blue with slate', stroke: '#93C5FD', fill: '#1E293B', glow: '#2DD4BF' },
];

export const PREMIUM_BACKGROUND_MOODS: readonly ColorChoice[] = [
  { name: 'Studio black', value: '#000000' },
  { name: 'Ink', value: '#0B0C10' },
  { name: 'Midnight', value: '#101425' },
  { name: 'Forest ink', value: '#0D1711' },
  { name: 'Plum', value: '#17101F' },
  { name: 'Paper', value: '#FBFAF7' },
  { name: 'Mist', value: '#F4F7FB' },
  { name: 'Sand', value: '#FAF3E6' },
];

/** Element-type colors keep the minimap legible and unmistakably product-made. */
export const ELEMENT_ACCENTS: Record<string, { dark: string; light: string }> = {
  rectangle: { dark: '#A78BFA', light: '#6D4FD6' },
  diamond: { dark: '#FBBF24', light: '#A16207' },
  circle: { dark: '#22D3EE', light: '#0E7490' },
  arrow: { dark: '#FB7185', light: '#BE123C' },
  line: { dark: '#FB923C', light: '#C2410C' },
  pencil: { dark: '#34D399', light: '#047857' },
  highlighter: { dark: '#FACC15', light: '#A16207' },
  text: { dark: '#E2E8F0', light: '#334155' },
  sticky: { dark: '#FDE68A', light: '#CA8A04' },
  frame: { dark: '#94A3B8', light: '#64748B' },
  icon: { dark: '#C4B5FD', light: '#7C3AED' },
  image: { dark: '#67E8F9', light: '#0891B2' },
};

export function elementAccent(type: string, light = false): string {
  return (ELEMENT_ACCENTS[type] || ELEMENT_ACCENTS.rectangle)[light ? 'light' : 'dark'];
}

export function normalizeRecentColors(value: unknown): string[] {
  if (!Array.isArray(value)) return PREMIUM_STROKES.slice(0, 5).map(choice => choice.value);
  const unique: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !/^#[\da-f]{6}$/i.test(item)) continue;
    const color = item.toUpperCase();
    if (!unique.includes(color)) unique.push(color);
    if (unique.length === 5) break;
  }
  return unique.length ? unique : PREMIUM_STROKES.slice(0, 5).map(choice => choice.value);
}
