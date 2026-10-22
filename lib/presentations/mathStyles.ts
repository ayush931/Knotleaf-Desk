// Copy only KaTeX's own rules, not the surrounding application stylesheet.
// Static font assets are embedded into standalone exports so equations work offline.
let standaloneStyles: Promise<string> | undefined;
export async function presentationMathStyles(
  standalone: boolean,
): Promise<string> {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let entries: CSSRuleList;
    try {
      entries = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(entries)) {
      if (!/katex/i.test(rule.cssText)) continue;
      let text = rule.cssText;
      if (rule.type === CSSRule.FONT_FACE_RULE)
        text = text.replace(/src:\s*[^;}]+/, (source) => {
          const woff = source.match(
            /url\([^)]*\.woff2[^)]*\)\s*format\(["']woff2["']\)/,
          );
          return woff ? `src: ${woff[0]}` : source;
        });
      text = text.replace(
        /url\(["']?([^)'"\s]+)["']?\)/g,
        (_, path: string) =>
          `url("${new URL(path, sheet.href || location.href).href}")`,
      );
      rules.push(text);
    }
  }
  if (!rules.length)
    throw new Error(
      "Equation styles are still loading. Try exporting again in a moment.",
    );
  const css = rules.join("\n");
  if (!standalone) return css;
  standaloneStyles ||= (async () => {
    const urls = [
      ...new Set(
        Array.from(css.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]),
      ),
    ];
    let embedded = css;
    // Fetch sequentially to avoid competing with drawing, calls, and editing.
    for (const url of urls) {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          "Could not embed the equation fonts. Check your connection and export again.",
        );
      const data = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < data.length; index += 8192)
        binary += String.fromCharCode(...data.subarray(index, index + 8192));
      embedded = embedded
        .split(url)
        .join(`data:font/woff2;base64,${btoa(binary)}`);
    }
    return embedded;
  })().catch((error) => {
    standaloneStyles = undefined;
    throw error;
  });
  return standaloneStyles;
}
