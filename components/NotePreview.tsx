"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { loadPreferences } from "@/lib/preferences";
import { fontCssStack } from "@/draw/fonts";
import { notesToSafeHtml } from "@/lib/richNotes";
import { highlightCode } from "@/lib/code";
import { readNoteHref } from "@/lib/notesDocument";
export function NotePreview({
  value,
  onOpenNote,
}: {
  value: string;
  onOpenNote?: (id: string) => boolean;
}) {
  const [appearance] = useState(() => loadPreferences().noteAppearance);
  const html = useMemo(() => {
    const template = document.createElement("template");
    template.innerHTML = notesToSafeHtml(
      value ||
        "*Your notes will appear here. Switch to Edit to start writing.*",
    );
    template.content.querySelectorAll("pre code").forEach((code) => {
      code.innerHTML = highlightCode(
        code.textContent || "",
        code.className.replace("language-", "") || "auto",
      ).html;
      code.classList.add("hljs");
    });
    template.content
      .querySelectorAll('input[type="checkbox"]')
      .forEach((input) => input.setAttribute("disabled", ""));
    template.content.querySelectorAll("a").forEach((anchor) => {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    });
    return template.innerHTML;
  }, [value]);
  return (
    <article
      className="notes-rich mx-auto"
      style={
        {
          maxWidth:
            appearance.width === "full"
              ? "none"
              : appearance.width === "wide"
                ? 1080
                : 768,
          "--note-font-family": fontCssStack(appearance.font),
          "--note-font-size": `${appearance.size}px`,
          "--note-line-height": appearance.lineHeight,
        } as CSSProperties
      }
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest("a"),
          id = anchor && readNoteHref(anchor.getAttribute("href") || "");
        if (id && onOpenNote) {
          event.preventDefault();
          onOpenNote(id);
        }
      }}
    >
      <div className="tiptap" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
