interface EditorLayoutInput {
  text: string;
  placeholder: string;
  measure: (text: string) => number;
  zoom: number;
  fontSize: number;
  screenX: number;
  screenY: number;
  preferredWidth?: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** Empty editors measure their hint too; keep the editing surface on screen. */
export function inlineEditorLayout(input: EditorLayoutInput) {
  const inset = 8;
  const content = input.text || input.placeholder;
  const measured = Math.max(...content.split("\n").map(input.measure)) * input.zoom + 16;
  const maxWidth = Math.max(1, input.viewportWidth - inset * 2);
  const width = Math.min(maxWidth, Math.max(32, input.preferredWidth || measured));
  const left = Math.max(0, Math.min(input.screenX, input.viewportWidth - width - inset));
  const minHeight = Math.min(Math.max(1, input.viewportHeight - inset * 2), Math.ceil(input.fontSize * input.zoom * 1.5 + 4));
  const top = Math.max(0, Math.min(input.screenY, input.viewportHeight - minHeight - inset));
  return { width, left, top, minHeight, maxHeight: Math.max(1, input.viewportHeight - top - inset) };
}
