import { themeTypography } from "./design";
import { parseSlides, type Deck } from "./model";
import { FONT_FAMILIES } from "@/draw/fonts";
const cache = new Map<string, Promise<string>>();
export async function presentationFontStyles(deck: Deck, standalone: boolean) {
  const ids = [
    ...new Set(
      [
        deck.theme,
        ...parseSlides(deck.source)
          .map((slide) => slide.theme)
          .filter(Boolean),
      ].flatMap((theme) => {
        const type = themeTypography(theme!);
        return [deck.headingFont || type.heading, deck.bodyFont || type.body];
      }),
    ),
  ];
  const { loadCanvasFonts } = await import("@/draw/renderer");
  await loadCanvasFonts(ids);
  const names = ids.flatMap((id) =>
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(FONT_FAMILIES[id].variable)
      .split(",")
      .map((value) => value.trim().replace(/^['"]|['"]$/g, "")),
  );
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let entries: CSSRuleList;
    try {
      entries = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(entries)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const face = rule as CSSFontFaceRule;
      const family = face.style
        .getPropertyValue("font-family")
        .replace(/^['"]|['"]$/g, "");
      if (!names.includes(family)) continue;
      rules.push(
        rule.cssText.replace(
          /url\(["']?([^)'"\s]+)["']?\)/g,
          (_, path: string) =>
            `url("${new URL(path, sheet.href || location.href).href}")`,
        ),
      );
    }
  }
  const css = rules.join("\n");
  if (!standalone) return css;
  if (cache.has(css)) return cache.get(css)!;
  const task = (async () => {
    let embedded = css;
    const urls = [
      ...new Set(
        Array.from(css.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]),
      ),
    ];
    for (const url of urls) {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          "Could not embed the selected presentation fonts. Try exporting again.",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 8192)
        text += String.fromCharCode(...bytes.subarray(i, i + 8192));
      embedded = embedded
        .split(url)
        .join(`data:font/woff2;base64,${btoa(text)}`);
    }
    return embedded;
  })().catch((error) => {
    cache.delete(css);
    throw error;
  });
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(css, task);
  return task;
}
