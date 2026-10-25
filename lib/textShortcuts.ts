type TextSizeKey = { key: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; isComposing?: boolean };

/** Use physical punctuation keys as well as shifted characters across Mac keyboard layouts. */
export function textSizeShortcut(event: TextSizeKey): -2 | 0 | 2 {
  if (event.isComposing || event.altKey || !event.shiftKey || !(event.metaKey || event.ctrlKey)) return 0;
  if (event.code === "Period") return 2;
  if (event.code === "Comma") return -2;
  if (event.key === ">" || event.key === ".") return 2;
  if (event.key === "<" || event.key === ",") return -2;
  return 0;
}

/** Canvas font sizes share the range accepted by saved preferences and imported artwork. */
export function stepCanvasFontSize(size: number, delta: number): number {
  return Math.max(8, Math.min(512, Math.round(size + delta)));
}
