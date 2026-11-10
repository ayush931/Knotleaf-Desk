/** Code editing and canvas painting use the same font weight and CSS line box. */
export const CODE_FONT_WEIGHT = 400;
export const CODE_LINE_HEIGHT = 1.5;
export interface CodeViewState { scrollLeft: number; scrollTop: number; selectionStart: number; selectionEnd: number }
export function codeLineMetrics(ctx: CanvasRenderingContext2D, fontSize: number) {
  return lineBoxMetrics(ctx, fontSize, CODE_LINE_HEIGHT);
}

/** CSS half-leading shared by textarea and canvas text, for the current font. */
export function lineBoxMetrics(ctx: CanvasRenderingContext2D, fontSize: number, leading: number) {
  const metrics = ctx.measureText('Mg');
  const measured = Number.isFinite(metrics.fontBoundingBoxAscent) && Number.isFinite(metrics.fontBoundingBoxDescent) && metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent > 0;
  const ascent = measured ? metrics.fontBoundingBoxAscent : fontSize * .8;
  const descent = measured ? metrics.fontBoundingBoxDescent : fontSize * .2;
  const lineHeight = fontSize * leading;
  return {lineHeight, baseline: (lineHeight - ascent - descent) / 2 + ascent};
}
