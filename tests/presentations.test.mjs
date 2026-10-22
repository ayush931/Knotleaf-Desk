import { test, expect, beforeAll, afterAll } from "bun:test";
import { JSDOM } from "jsdom";
import {
  parseSlides,
  revealParts,
  removeSlide,
  slideAt,
  notesToDeck,
  readDeck,
  loadDeck,
  deckKey,
  STARTER,
  THEMES,
} from "../lib/presentations/model.ts";
let browser, renderSlide, audienceHtml;
const previous = new Map();
beforeAll(async () => {
  browser = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://desk.example/",
  }).window;
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Node",
    "DOMParser",
    "localStorage",
    "Event",
    "CustomEvent",
  ]) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key === "window" ? browser : browser[key],
    });
  }
  ({ renderSlide } = await import("../lib/presentations/render.ts"));
  ({ audienceHtml } = await import("../lib/presentations/export.ts"));
});
afterAll(() => {
  browser.close();
  for (const [key, descriptor] of previous)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
});
test("slide boundaries preserve source offsets and ignore delimiters and private-note examples inside fences and math", () => {
  const source =
    "# Intro\n\n```md\n---\n<!-- notes: literal -->\n```\n\n$$\na\n---\nb\n$$\n\n---\n## Next\n<!-- notes: private\n---\nreminder -->\n";
  const slides = parseSlides(source);
  expect(slides).toHaveLength(2);
  expect(slides[0].source).toContain("<!-- notes: literal -->");
  expect(slides[1].notes).toBe("private\n---\nreminder");
  expect(slides[1].source).not.toContain("private");
  expect(source.slice(slides[1].start)).toContain("## Next");
  expect(slideAt(slides, source.indexOf("## Next"))).toBe(1);
});
test("deleting first, middle, last, and sole slides preserves remaining writing and private notes", () => {
  const source =
    "# A\n<!-- notes: Keep A -->\n\n---\n# B\n```md\n---\n```\n\n---\n# C\n";
  for (const [index, titles] of [
    [0, ["B", "C"]],
    [1, ["A", "C"]],
    [2, ["A", "B"]],
  ]) {
    const result = parseSlides(removeSlide(source, index));
    expect(result.map((slide) => slide.title)).toEqual(titles);
    if (index !== 0) expect(result[0].notes).toBe("Keep A");
  }
  expect(removeSlide("# Only", 0)).toBe("");
  expect(removeSlide(source, 9)).toBe(source);
  expect(parseSlides("")).toHaveLength(1);
});
test("reveal markers in code remain literal and real markers create steps", () => {
  expect(
    revealParts("```html\n<!-- step -->\n```\n\n<!-- step -->\nNext"),
  ).toHaveLength(2);
});
test("notes become slides at headings without splitting code examples", () => {
  const source = "# First\nText\n```md\n## Code\n```\n## Second\nText";
  expect(parseSlides(notesToDeck(source)).map((slide) => slide.title)).toEqual([
    "First",
    "Second",
  ]);
});
test("versioned imports reject malformed settings and prototype keys without touching stored data", () => {
  const valid = {
    version: 1,
    source: STARTER,
    title: "Demo",
    theme: "midnight",
    layout: "standard",
  };
  expect(readDeck(JSON.stringify(valid))).toEqual(valid);
  for (const value of [
    { ...valid, version: 2 },
    { ...valid, source: 4 },
    { ...valid, theme: "__proto__" },
    { ...valid, layout: "unsafe" },
  ])
    expect(() => readDeck(JSON.stringify(value))).toThrow();
  localStorage.setItem(deckKey("broken"), "not-json");
  expect(() => loadDeck("broken", "Untitled")).toThrow();
  expect(localStorage.getItem(deckKey("broken"))).toBe("not-json");
  expect(loadDeck("new", "My title").title).toBe("My title");
});
test("Markdown, syntax highlighting and trusted math render while active HTML is removed", async () => {
  const html = await renderSlide({
    source:
      '## Heading\n\n**Bold**\n\n<script>alert(1)</script>\n<img src=x onerror="alert(1)">\n[bad](javascript:alert(1))\n\n```js\nconst value = "safe";\n```\n\n$$\nE = mc^2\n$$',
  });
  expect(html).toContain("<h2>Heading</h2>");
  expect(html).toContain("hljs-keyword");
  expect(html).toContain("<math");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain('href="javascript:');
});
test("audience exports strip private notes, expand reveals and preserve per-slide designs", async () => {
  const sections = await audienceHtml({
    version: 1,
    title: "Private demo",
    theme: "midnight",
    layout: "standard",
    source:
      "# Public\n<!-- notes: SECRET-NOTES -->\n<!-- step -->\nNext point\n\n---\n<!-- theme: paper -->\n<!-- layout: center -->\n# Ending",
  });
  expect(sections).toHaveLength(2);
  expect(sections.join("")).not.toContain("SECRET-NOTES");
  expect(sections[0]).toContain("Next point");
  expect(sections[0]).not.toContain('data-hidden="true"');
  expect(sections[1]).toContain('data-layout="center"');
  expect(sections[1]).toContain(THEMES.paper.background);
});

test("theme and layout examples inside code never change slide appearance", () => {
  const slide = parseSlides(
    "```md\n# Literal title\n<!-- theme: paper -->\n<!-- layout: center -->\n```\n# Real title",
  )[0];
  expect(slide.title).toBe("Real title");
  expect(slide.theme).toBeUndefined();
  expect(slide.layout).toBeUndefined();
});

test("compatible per-item reveals keep a single list and work alongside step markers", async () => {
  const { revealCount } = await import("../lib/presentations/model.ts");
  const source =
    "## Steps\n\n- First\n- Second {reveal}\n- Third {reveal}\n\n<!-- step -->\n\nDone";
  const html = await renderSlide({ source });
  expect((html.match(/<ul>/g) || []).length).toBe(1);
  expect(html).toContain('data-step="1"');
  expect(html).toContain('data-step="2"');
  expect(html).toContain('data-step="3"');
  expect(html).not.toContain("{reveal}");
  expect(revealCount(source)).toBe(3);
});
test("inline math, bracket equations and image placement retain their layout directives", async () => {
  const html = await renderSlide({
    source:
      'Cost: $O(1)$. Also \\(x^2\\).\n\n\\[\nE=mc^2\n\\]\n\n![Architecture](https://example.com/image.png "right opacity:0.7")',
  });
  expect((html.match(/class="katex"/g) || []).length).toBe(3);
  expect(html).toContain('data-position="right"');
  expect(html).toContain("opacity: 0.7");
});
test("embeds are isolated and active Markdown attributes are removed", async () => {
  const html = await renderSlide({
    source:
      '<iframe src="https://example.com" srcdoc="<script>alert(1)</script>"></iframe>\n<video src="https://example.com/demo.mp4" autoplay onerror="alert(1)"></video>',
  });
  expect(html).toContain('sandbox="allow-scripts allow-presentation"');
  expect(html).not.toContain("srcdoc=");
  expect(html).not.toContain("onerror=");
  expect(html).not.toContain("autoplay");
});
test("presentation library creates, duplicates and deletes without resurrecting a removed document", async () => {
  const { newDeck, duplicateDeck, listDecks, deleteDeck, writeDeck } =
    await import("../lib/presentations/library.ts");
  const id = newDeck("Same title");
  const copy = duplicateDeck(id);
  const collision = newDeck("Same title");
  expect(listDecks().map((item) => item.title)).toContain("Same title (2)");
  expect(listDecks().find((item) => item.id === copy).title).toBe(
    "Same title copy",
  );
  const deck = readDeck(localStorage.getItem(deckKey(id)));
  deleteDeck(id);
  writeDeck(id, deck);
  expect(localStorage.getItem(deckKey(id))).toBeNull();
  expect(listDecks().some((item) => item.id === id)).toBe(false);
  expect(localStorage.getItem(deckKey(collision))).not.toBeNull();
});
test("lint catches structural errors without treating fenced examples as slide syntax", async () => {
  const { lintPresentation } = await import("../lib/presentations/lint.mjs");
  expect(
    lintPresentation("# Fine\n\n```md\n---\n{reveal}\n```").filter(
      (issue) => issue.severity === "error",
    ),
  ).toHaveLength(0);
  expect(
    lintPresentation("# Broken\n\n```js\nconst n=1").some(
      (issue) => issue.rule === "unclosed-code",
    ),
  ).toBe(true);
  expect(
    lintPresentation('![ ](diagram.png "opacity:3")').some(
      (issue) => issue.rule === "image-opacity",
    ),
  ).toBe(true);
  expect(
    lintPresentation("# Equation\n\n$$\nx").some(
      (issue) => issue.rule === "unclosed-math",
    ),
  ).toBe(true);
});
test("design imports validate bounded settings, font identities, and background URLs", () => {
  const deck = readDeck(
    JSON.stringify({
      version: 1,
      title: "Design",
      source: "# Test",
      theme: "gallery",
      layout: "standard",
      headingFont: "jetbrains-mono",
      bodyFont: "mono",
      transition: "zoom",
      template: "editorial",
      bodySize: 999,
      backgroundImage: "javascript:alert(1)",
      backgroundColor: "red",
      animateBackground: false,
    }),
  );
  expect(deck.headingFont).toBe("jetbrains-mono");
  expect(deck.bodySize).toBe(64);
  expect(deck.transition).toBe("zoom");
  expect(deck.backgroundImage).toBeUndefined();
  expect(deck.backgroundColor).toBeUndefined();
  expect(deck.animateBackground).toBe(false);
});

test("shared content typography scales headings and secondary text with the body", async () => {
  const { themeVariables } = await import("../lib/presentations/export.ts");
  const { SLIDE_CSS } = await import("../lib/presentations/styles.ts");
  const deck = { version: 1, title: "Type", source: "# Title", theme: "midnight", layout: "standard", headingFont: "jetbrains-mono", bodyFont: "jetbrains-mono", bodySize: 45 };
  const variables = themeVariables(deck);
  expect(variables["--deck-size"]).toBe("45px");
  expect(variables["--deck-scale"]).toBe("1.5");
  expect(variables["--deck-heading"]).toBe(variables["--deck-body"]);
  expect(variables["--deck-code"]).toBe(variables["--deck-body"]);
  expect(SLIDE_CSS).toContain("font-size:calc(110px * var(--deck-scale,1))");
  expect(SLIDE_CSS).toContain("font-size:calc(26px * var(--deck-scale,1))");
  expect(SLIDE_CSS).not.toMatch(/font-size:\d+px/);
});
