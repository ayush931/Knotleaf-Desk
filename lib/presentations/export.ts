import { presentationFontStyles } from "./fontStyles";
import {
  STANDALONE_CSS,
  STANDALONE_RUNTIME,
  STANDALONE_CONTROLS,
} from "./standalone";
import { resolvedFont, themeBackdrop, themeTypography } from "./design";
import { safeFilename } from "@/lib/projectFile";
import { parseSlides, THEMES, type Deck } from "./model";
import { renderSlide } from "./render";
import { presentationMathStyles } from "./mathStyles";
import { SLIDE_CSS } from "./styles";
const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export function themeVariables(deck: Deck): Record<string, string> {
  const theme = THEMES[deck.theme],
    type = themeTypography(deck.theme);
  return {
    "--deck-bg": deck.backgroundColor || theme.background,
    "--deck-ink": theme.ink,
    "--deck-accent": theme.accent,
    "--deck-muted": theme.muted,
    "--deck-wash": deck.backgroundColor ? "none" : theme.wash,
    "--deck-heading": resolvedFont(
      deck.headingFont || type.heading,
      theme.heading,
    ),
    "--deck-body": resolvedFont(deck.bodyFont || type.body, "Arial,sans-serif"),
    "--deck-size": `${deck.bodySize || type.size}px`,
    "--deck-scale": String(deck.bodySize ? deck.bodySize / type.size : 1),
    "--deck-code": deck.bodyFont
      ? resolvedFont(deck.bodyFont, "monospace")
      : "monospace",
    "--deck-image": deck.backgroundImage
      ? `url(${JSON.stringify(deck.backgroundImage)})`
      : "none",
    "--deck-image-opacity": String(deck.backgroundOpacity ?? 0.25),
  };
}
export function themeStyle(deck: Deck) {
  return Object.entries(themeVariables(deck))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}
export function decorateSlide(html: string, deck: Deck) {
  return (
    (deck.backgroundImage
      ? '<div class="kl-background-image" aria-hidden="true"></div>'
      : "") + html
  );
}
export function downloadDeck(
  content: BlobPart,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function audienceHtml(
  deck: Deck,
  onProgress?: (value: string) => void,
) {
  const slides = parseSlides(deck.source),
    sections = [];
  for (let index = 0; index < slides.length; index++) {
    onProgress?.(`Rendering slide ${index + 1} of ${slides.length}…`);
    sections.push(
      `<section class="kl-slide" data-theme="${slides[index].theme || deck.theme}" data-transition="${deck.transition || "fade"}" data-template="${deck.template || "classic"}" data-background="${themeBackdrop(slides[index].theme || deck.theme, deck.backdrop)}" data-motion="${deck.animateBackground !== false}" data-blocks="${deck.animateBlocks !== false}" data-layout="${slides[index].layout || deck.layout}" style="${escape(themeStyle({ ...deck, theme: slides[index].theme || deck.theme }))}" aria-label="Slide ${index + 1}">${decorateSlide(await renderSlide(slides[index]), deck)}</section>`,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return sections;
}
export async function exportDeck(
  deck: Deck,
  format: "md" | "json" | "html" | "pdf",
  progress: (value: string) => void,
) {
  const filename = safeFilename(deck.title);
  if (deck.kind === "html" && format !== "json") {
    const { exportHtmlDocument } = await import("./htmlExport");
    await exportHtmlDocument(deck, format, progress);
    return;
  }
  if (format === "md") {
    downloadDeck(deck.source, `${filename}.md`, "text/markdown");
    return;
  }
  if (format === "json") {
    downloadDeck(
      JSON.stringify(deck, null, 2),
      `${filename}.knotleaf-deck.json`,
      "application/json",
    );
    return;
  }
  const fontCss = await presentationFontStyles(deck, format === "html");
  const sections = await audienceHtml(deck, progress);
  const mathCss = sections.some((section) => section.includes('class="katex"'))
    ? await presentationMathStyles(format === "html")
    : "";
  if (format === "html") {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(deck.title)}</title><style>${SLIDE_CSS}${mathCss}${fontCss}${STANDALONE_CSS}</style><body class="kl-present"><main>${sections.join("")}</main>${STANDALONE_CONTROLS}<script>${STANDALONE_RUNTIME}</script></body></html>`;
    downloadDeck(html, `${filename}.html`, "text/html");
    return;
  }
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([
    import("html2canvas"),
    import("pdf-lib"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.setTitle(deck.title);
  pdf.setCreator("Knotleaf Desk");
  // An isolated document avoids inheriting application styles and unsupported color functions.
  const frame = document.createElement("iframe");
  frame.title = "Preparing presentation export";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0;pointer-events:none";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Could not prepare the presentation export.");
    doc.open();
    doc.write(
      `<!doctype html><html><head><style>${SLIDE_CSS}${mathCss}${fontCss}body{margin:0}</style></head><body></body></html>`,
    );
    doc.close();
    for (let index = 0; index < sections.length; index++) {
      progress(`Exporting slide ${index + 1} of ${sections.length}…`);
      doc.body.innerHTML = sections[index];
      const images = Array.from(doc.images);
      await Promise.all(
        images.map((image) => {
          if (!image.src.startsWith("data:") && !image.src.startsWith("blob:"))
            image.crossOrigin = "anonymous";
          return image.decode().catch(() => {
            throw new Error(
              "An image could not be exported. Upload the image locally and try again.",
            );
          });
        }),
      );
      void (doc.body.firstElementChild as HTMLElement).offsetHeight;
      await doc.fonts.ready;
      const canvas = await html2canvas(
        doc.body.firstElementChild as HTMLElement,
        {
          width: 1280,
          height: 720,
          scale: 1.5,
          backgroundColor: THEMES[deck.theme].background,
          useCORS: true,
          logging: false,
        },
      );
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Could not capture this slide.")),
          "image/png",
        ),
      );
      const image = await pdf.embedPng(await png.arrayBuffer());
      const page = pdf.addPage([960, 540]);
      page.drawImage(image, { x: 0, y: 0, width: 960, height: 540 });
      canvas.width = canvas.height = 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    downloadDeck(
      new Uint8Array(await pdf.save()),
      `${filename}.pdf`,
      "application/pdf",
    );
  } finally {
    frame.remove();
  }
}
