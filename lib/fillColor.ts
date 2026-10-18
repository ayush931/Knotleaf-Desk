/** Separate legacy RGBA color alpha from the editable background opacity. */
export function parseFillColor(value: string): { color: string; opacity: number } {
  if (value === 'transparent' || value === 'none') return { color: '#ffffff', opacity: 0 };
  if (/^#[\da-f]{3}$/i.test(value)) return { color: '#' + value.slice(1).split('').map(c => c + c).join(''), opacity: 1 };
  if (/^#[\da-f]{6}$/i.test(value)) return { color: value, opacity: 1 };
  const rgba = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/);
  if (rgba) return { color: '#' + rgba.slice(1, 4).map(c => Math.max(0, Math.min(255, Number(c))).toString(16).padStart(2, '0')).join(''), opacity: Math.max(0, Math.min(1, Number(rgba[4] ?? 1))) };
  return { color: '#ffffff', opacity: 1 };
}
