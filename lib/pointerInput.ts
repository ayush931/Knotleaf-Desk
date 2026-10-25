/** macOS Control-click is a secondary click even when the browser reports button 0. */
export function isContextPointer(event: { button: number; ctrlKey?: boolean }, platform = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent): boolean {
  return event.button === 2 || (event.button === 0 && !!event.ctrlKey && /Mac|iPhone|iPad|iPod/i.test(platform));
}

export function capturePointer(target: Element, id: number): void {
  try { target.setPointerCapture?.(id); } catch { /* Window listeners own the fallback. */ }
}

export function releasePointer(target: Element, id: number): void {
  try { if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id); } catch { /* Safari may already have released capture. */ }
}
