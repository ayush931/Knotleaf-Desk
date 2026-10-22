import { test, expect } from "bun:test";
import {
  cardBackground,
  DOCUMENT_CARD_FILL,
  CODE_CARD_FILL,
} from "../draw/cardAppearance.ts";
test("legacy default cards receive distinct quiet colors without changing geometry or content", () => {
  const original = {
    isDocCard: true,
    fill: "#18181B",
    fillStyle: "solid",
    x: 10,
    y: 20,
    width: 300,
    height: 120,
    text: "Keep my writing",
  };
  expect(cardBackground(original)).toEqual({
    ...original,
    fill: DOCUMENT_CARD_FILL,
  });
  expect(cardBackground({ ...original, isCodeCard: true })).toEqual({
    ...original,
    isCodeCard: true,
    fill: CODE_CARD_FILL,
  });
  expect(original.fill).toBe("#18181B");
});
test("custom colors, explicit old-default colors, patterns, attachments and plain text retain their appearance", () => {
  for (const value of [
    { isDocCard: true, fill: "#453c56", fillStyle: "solid" },
    {
      isDocCard: true,
      fill: "#18181b",
      fillStyle: "solid",
      cardFillCustom: true,
    },
    { isDocCard: true, fill: "#18181b", fillStyle: "hachure" },
    { isDocCard: true, fill: "#18181b", fillStyle: "solid", attachment: {} },
    { fill: "#18181b", fillStyle: "solid" },
  ])
    expect(cardBackground(value)).toBe(value);
});
