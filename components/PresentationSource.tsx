"use client";
import {
  forwardRef,
  useRef,
  useMemo,
  type TextareaHTMLAttributes,
} from "react";
import hljs from "highlight.js/lib/core";
import markdown from "highlight.js/lib/languages/markdown";
import xml from "highlight.js/lib/languages/xml";
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("xml", xml);
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const PresentationSource = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { kind?: "markdown" | "html" }
>(function PresentationSource(
  { value, kind = "markdown", className = "", onScroll, onKeyDown, ...props },
  ref,
) {
  const overlay = useRef<HTMLPreElement>(null);
  const source = String(value || "");
  const html = useMemo(
    () =>
      source.length > 80000
        ? escape(source)
        : hljs.highlight(source, {
            language: kind === "html" ? "xml" : "markdown",
            ignoreIllegals: true,
          }).value,
    [source, kind],
  );
  return (
    <div className="presentation-source relative min-h-0 flex-1 overflow-hidden bg-[#18181b]">
      <style>{`.presentation-source .hljs-section{color:#93baff;font-weight:600}.presentation-source .hljs-strong{color:#e2e8f0;font-weight:700}.presentation-source .hljs-emphasis{font-style:italic;color:#b5c4d8}.presentation-source .hljs-code,.presentation-source .hljs-string{color:#a8beb8}.presentation-source .hljs-link,.presentation-source .hljs-attr{color:#9bb9d7}.presentation-source .hljs-comment{color:#787f8b}.presentation-source .hljs-tag{color:#adb6c8}`}</style>
      <pre
        ref={overlay}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-6 text-neutral-300"
        style={{ tabSize: 2 }}
      >
        <code
          style={{ font: "inherit" }}
          dangerouslySetInnerHTML={{ __html: html + "\n" }}
        />
      </pre>
      <textarea
        {...props}
        ref={ref}
        value={value}
        wrap="soft"
        className={`${className} resize-none absolute inset-0 h-full w-full bg-transparent! text-transparent! caret-white selection:bg-blue-500/35 selection:text-transparent`}
        style={{ tabSize: 2, ...props.style }}
        onScroll={(event) => {
          if (overlay.current) {
            overlay.current.scrollTop = event.currentTarget.scrollTop;
            overlay.current.scrollLeft = event.currentTarget.scrollLeft;
          }
          onScroll?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.nativeEvent.isComposing) return;
          const field = event.currentTarget;
          if (event.key === "Tab" && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            document.execCommand("insertText", false, "  ");
          } else if (
            kind === "markdown" &&
            event.key === "Enter" &&
            field.selectionStart === field.selectionEnd &&
            !event.shiftKey
          ) {
            const line =
              source.slice(0, field.selectionStart).split("\n").pop() || "";
            const match = line.match(
              /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/,
            );
            if (!match) return;
            event.preventDefault();
            if (!match[4].trim()) {
              field.setSelectionRange(
                field.selectionStart - line.length,
                field.selectionStart,
              );
              document.execCommand("insertText", false, "\n");
            } else {
              const item = /^\d/.test(match[2])
                ? String(parseInt(match[2], 10) + 1) + match[2].slice(-1)
                : match[2];
              document.execCommand(
                "insertText",
                false,
                "\n" + match[1] + item + " " + (match[3] ? "[ ] " : ""),
              );
            }
          }
        }}
      />
    </div>
  );
});
