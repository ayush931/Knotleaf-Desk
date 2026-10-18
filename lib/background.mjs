export const DEFAULT_BACKGROUND = { fill: '#1b1c1e', fillStyle: 'solid', fillOpacity: 1 };
export function normalizeBackground(value) {
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (!v || !/^#[\da-f]{6}$/i.test(v.fill) || !['solid', 'hachure', 'crosshatch', 'dots'].includes(v.fillStyle) || !Number.isFinite(v.fillOpacity) || v.fillOpacity < 0 || v.fillOpacity > 1) return { ...DEFAULT_BACKGROUND };
    return { fill: v.fill, fillStyle: v.fillStyle, fillOpacity: v.fillOpacity };
  } catch { return { ...DEFAULT_BACKGROUND }; }
}

export function isLightBackground(value) {
  const background = normalizeBackground(value), n = parseInt(background.fill.slice(1), 16);
  const brightness = ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) * background.fillOpacity + 235 * (1 - background.fillOpacity);
  return brightness > 150;
}
