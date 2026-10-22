import type { Deck } from "./model";
import { safeFilename } from "@/lib/projectFile";
import { downloadDeck } from "./export";
import { isolatedDocument } from "./htmlDocument";
import {
  STANDALONE_CSS,
  STANDALONE_RUNTIME,
  STANDALONE_CONTROLS,
} from "./standalone";
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function exportHtmlDocument(
  deck: Deck,
  format: "md" | "html" | "pdf",
  progress: (value: string) => void,
) {
  const name = safeFilename(deck.title);
  if (format === "md") {
    downloadDeck(deck.source, `${name}.html`, "text/html");
    return;
  }
  if (format === "pdf") {
    // Printing the live isolated document preserves its own @page rules, scripts,
    // charts, and modern CSS; a DOM rasterizer cannot faithfully reproduce these.
    progress("Opening the document print view. Choose Save as PDF.");
    window.dispatchEvent(
      new CustomEvent("knotleaf-print-html", {
        detail: { source: deck.source },
      }),
    );
    return;
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(deck.title)}</title><style>${STANDALONE_CSS}</style><body class="kl-present kl-document"><iframe class="kl-html-document" title="${escape(deck.title)}" sandbox="allow-scripts allow-presentation allow-modals" referrerpolicy="no-referrer" srcdoc="${escape(isolatedDocument(deck.source, !!deck.allowScripts))}"></iframe><main></main>${STANDALONE_CONTROLS}<script>${STANDALONE_RUNTIME}</script></body></html>`;
  downloadDeck(html, `${name}-presenter.html`, "text/html");
}
