import DOMPurify from "dompurify";
import { Marked } from "marked";
import { revealParts, type Slide } from "./model";
let sequence = 0;
let diagramQueue: Promise<unknown> = Promise.resolve();
const diagramCache = new Map<string, string>();
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const marker = /(?<!\\)\s*\{reveal\}\s*$/;
function stripReveal<T>(token: T): T {
  if (!token || typeof token !== "object") return token;
  const result = { ...token } as Record<string, unknown>;
  for (const key of ["text", "raw"])
    if (typeof result[key] === "string")
      result[key] = (result[key] as string).replace(marker, "");
  if (Array.isArray(result.tokens))
    result.tokens = result.tokens.map(stripReveal);
  return result as T;
}
export async function renderSlide(
  slide: Pick<Slide, "source">,
): Promise<string> {
  const marked = new Marked({ breaks: false, gfm: true });
  let fragment = 0;
  const slots: { key: string; render: () => Promise<string> }[] = [];
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const slot = (render: () => Promise<string>) => {
    const key = `KNOTLEAF${nonce}SLOT${slots.length}END`;
    slots.push({ key, render });
    return `<span data-kl-slot="${key}"></span>`;
  };
  const math = (text: string, displayMode: boolean) =>
    slot(async () => {
      const { default: katex } = await import("katex");
      return `${displayMode ? '<div class="kl-math">' : ""}${katex.renderToString(text, { displayMode, throwOnError: false, trust: false, maxExpand: 1000, output: "htmlAndMathml" })}${displayMode ? "</div>" : ""}`;
    });
  marked.use({
    renderer: {
      image({ href, text, title }) {
        const position = title
          ?.match(/\b(right|left|bg)\b/i)?.[1]
          .toLowerCase();
        const opacity = title?.match(/opacity\s*[:= ]\s*([\d.]+)/i)?.[1];
        return `<img src="${escape(href)}" alt="${escape(text)}"${position ? ` data-position="${position}"` : ""}${opacity ? ` data-opacity="${Math.max(0, Math.min(1, Number(opacity) || 0))}"` : ""}>`;
      },
      listitem(token) {
        const reveal = marker.test(token.text);
        const cleaned = reveal ? stripReveal(token) : token;
        return `<li${reveal ? ` data-step="${++fragment}"` : ""}>${token.task ? (token.checked ? "☑ " : "☐ ") : ""}${this.parser.parse(cleaned.tokens)}</li>`;
      },
      paragraph(token) {
        const reveal = marker.test(token.text);
        const cleaned = reveal ? stripReveal(token) : token;
        return `<p${reveal ? ` data-step="${++fragment}"` : ""}>${this.parser.parseInline(cleaned.tokens)}</p>`;
      },
      code({ text, lang }) {
        const language = (lang || "").split(/\s/)[0];
        if (language === "mermaid")
          return slot(async () => {
            const cached = diagramCache.get(text);
            if (cached) return cached;
            const task = diagramQueue.then(async () => {
              const { default: mermaid } = await import("mermaid");
              mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                theme: "neutral",
                suppressErrorRendering: true,
                flowchart: { htmlLabels: false },
              });
              const { svg } = await mermaid.render(
                `kl-diagram-${++sequence}`,
                text,
              );
              return DOMPurify.sanitize(svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                FORBID_TAGS: ["foreignObject"],
              });
            });
            diagramQueue = task.catch(() => {});
            const svg = await task;
            if (diagramCache.size >= 32)
              diagramCache.delete(diagramCache.keys().next().value!);
            diagramCache.set(text, svg);
            return svg;
          });
        return slot(async () => {
          const { default: hljs } = await import("highlight.js/lib/common");
          return `<pre><code>${language && hljs.getLanguage(language) ? hljs.highlight(text, { language, ignoreIllegals: true }).value : escape(text)}</code></pre>`;
        });
      },
    },
    extensions: [
      {
        name: "displayMath",
        level: "block",
        start: (src) => {
          const index = src.search(/\$\$|\\\[/);
          return index < 0 ? undefined : index;
        },
        tokenizer(src) {
          const match =
            /^\$\$([\s\S]*?)\$\$(?:\s*\n|$)/.exec(src) ||
            /^\\\[([\s\S]*?)\\\](?:\s*\n|$)/.exec(src);
          if (match)
            return { type: "displayMath", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return math(token.text as string, true);
        },
      },
      {
        name: "inlineMath",
        level: "inline",
        start: (src) => {
          const index = src.search(/\$(?!\$)|\\\(/);
          return index < 0 ? undefined : index;
        },
        tokenizer(src) {
          const match =
            /^\$(?!\$)([^$\n]+?)\$(?!\$)/.exec(src) ||
            /^\\\(([^\n]+?)\\\)/.exec(src);
          if (match)
            return { type: "inlineMath", raw: match[0], text: match[1] };
        },
        renderer(token) {
          return math(token.text as string, false);
        },
      },
    ],
  });
  const chunks = [];
  for (const [index, part] of revealParts(slide.source).entries()) {
    if (index > 0) fragment++;
    const base = fragment;
    let html = DOMPurify.sanitize(await marked.parse(part), {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["iframe"],
      FORBID_TAGS: ["style", "input", "form", "button"],
      FORBID_ATTR: [
        "style",
        "srcset",
        "class",
        "id",
        "name",
        "srcdoc",
        "autoplay",
      ],
    });
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll("a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    template.content.querySelectorAll("iframe").forEach((frame) => {
      frame.setAttribute("sandbox", "allow-scripts allow-presentation");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("allowfullscreen", "");
    });
    template.content
      .querySelectorAll("video,audio")
      .forEach((media) => media.setAttribute("controls", ""));
    template.content
      .querySelectorAll<HTMLElement>("img[data-opacity]")
      .forEach((image) => {
        image.style.opacity = String(
          Math.max(0, Math.min(1, Number(image.dataset.opacity) || 0)),
        );
      });
    html = template.innerHTML;
    for (const item of slots.splice(0)) {
      let rendered: string;
      try {
        rendered = await item.render();
      } catch (error) {
        rendered = `<pre class="kl-error">${escape(error instanceof Error ? error.message : "Could not render this block.")}</pre>`;
      }
      html = html.replace(`<span data-kl-slot="${item.key}"></span>`, rendered);
    }
    chunks.push(`<div data-step="${base}">${html}</div>`);
  }
  const output = document.createElement("template");
  output.innerHTML = chunks.join("");
  output.content
    .querySelectorAll<HTMLImageElement>("img[data-position]")
    .forEach((image) => {
      const step = image.closest<HTMLElement>("[data-step]")?.dataset.step;
      const parent = image.parentElement;
      if (step) image.dataset.step = step;
      output.content.append(image);
      if (
        parent?.tagName === "P" &&
        !parent.textContent?.trim() &&
        !parent.children.length
      )
        parent.remove();
    });
  return output.innerHTML;
}
