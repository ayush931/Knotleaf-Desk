import type { BackgroundFill } from "./backgroundFill";
export const DOCUMENT_CARD_FILL = "#242428";
export const CODE_CARD_FILL = "#18181b";
export const MIN_CODE_WIDTH = 80;
export const MIN_CODE_HEIGHT = 32;
/** Resolve legacy default card colors; explicit custom colors/patterns stay intact. */
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
    !(element.isCodeCard ? ["#18181b", "#111d2d", "#10151e"].includes(element.fill.toLowerCase()) : element.fill.toLowerCase() === "#18181b") ||
    element.fillStyle !== "solid"
  )
    return element;
  return {
    ...element,
    fill: element.isCodeCard ? CODE_CARD_FILL : DOCUMENT_CARD_FILL,
  };
}
