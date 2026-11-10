interface EditorLayoutInput {
  text: string;
  placeholder: string;
  measure: (text: string) => number;
  zoom: number;
  fontSize: number;
  screenX: number;
  screenY: number;
  preferredWidth?: number;
  /** Exact text alignment width, without editor-only padding. */
  contentWidth?: number;
  preservePosition?: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

/** Empty editors measure their hint too; keep the editing surface on screen. */
export function inlineEditorLayout(input: EditorLayoutInput) {
  const inset = 8;
  const content = input.text || input.placeholder;
  const measured = Math.max(...content.split("\n").map(input.measure)) * input.zoom + 16;
  const maxWidth = Math.max(1, input.viewportWidth - inset * 2);
  const exactWidth = input.text && input.contentWidth !== undefined ? Math.max(1, input.contentWidth) : undefined;
  const requestedWidth = input.preferredWidth || exactWidth || Math.max(32, measured);
  const width = input.preservePosition ? requestedWidth : Math.min(maxWidth, requestedWidth);
  const left = input.preservePosition ? input.screenX : Math.max(0, Math.min(input.screenX, input.viewportWidth - width - inset));
  const minHeight = Math.min(Math.max(1, input.viewportHeight - inset * 2), Math.ceil(input.fontSize * input.zoom * 1.5 + 4));
  const top = input.preservePosition ? input.screenY : Math.max(0, Math.min(input.screenY, input.viewportHeight - minHeight - inset));
  return { width, left, top, minHeight, maxHeight: Math.max(input.preservePosition ? minHeight : 1, input.viewportHeight - top - inset) };
}
