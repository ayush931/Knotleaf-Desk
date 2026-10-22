import type { BackgroundFill } from "./backgroundFill";
export const DOCUMENT_CARD_FILL = "#242428";
export const CODE_CARD_FILL = "#111d2d";
/** Recognize the old shared default; explicit custom colors/patterns stay intact. */
export function cardBackground<
  T extends BackgroundFill & {
    isDocCard?: boolean;
    isCodeCard?: boolean;
    attachment?: unknown;
    cardFillCustom?: boolean;
  },
>(element: T): T {
  if (
    element.cardFillCustom ||
    element.attachment ||
    (!element.isDocCard && !element.isCodeCard) ||
    element.fill.toLowerCase() !== "#18181b" ||
    element.fillStyle !== "solid"
  )
    return element;
  return {
    ...element,
    fill: element.isCodeCard ? CODE_CARD_FILL : DOCUMENT_CARD_FILL,
  };
}
