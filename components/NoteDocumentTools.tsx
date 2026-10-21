"use client";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState, useId } from "react";
import {
  Underline,
  AlignLeft,
  Paintbrush,
  Highlighter,
  Settings2,
  X,
  Superscript,
  Subscript,
  Eraser,
} from "lucide-react";
import {
  NOTE_FONTS,
  NOTE_COLORS,
  NOTE_HIGHLIGHTS,
  type NoteAppearance,
} from "@/lib/notesDocument";
import { fontCssStack } from "@/draw/fonts";

export type NotePanel =
  | "appearance"
  | "color"
  | "highlight"
  | "alignment"
  | "links"
  | "export"
  | null;
export function NoteTypographyTools({
  editor,
  appearance,
  font,
  size,
}: {
  editor: Editor | null;
  appearance: NoteAppearance;
  font?: string;
  size?: string;
}) {
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (input.current && document.activeElement !== input.current)
      input.current.value = String(parseFloat(size || "") || appearance.size);
  }, [size, appearance.size]);
  const applySize = (focus = false) => {
    const value = input.current?.valueAsNumber;
    if (!Number.isFinite(value) || value! < 8 || value! > 128) {
      setError("Use a text size from 8 to 128 px.");
      return;
    }
    setError("");
    const chain = editor?.chain();
    if (focus) chain?.focus();
    chain?.setFontSize(`${value}px`).run();
  };
  return (
    <>
      <select
        aria-label="Text font"
        title="Font for selected text or your next typing"
        className="h-8 w-24 shrink-0 rounded border border-neutral-700 bg-neutral-900 px-1.5 text-xs"
        value={font || ""}
        onChange={(e) => {
          const chain = editor?.chain().focus();
          if (e.target.value) chain?.setFontFamily(e.target.value).run();
          else chain?.unsetFontFamily().run();
        }}
      >
        <option value="">Default font</option>
        {NOTE_FONTS.map((f) => (
          <option
            key={f.id}
            value={f.id}
            style={{ fontFamily: fontCssStack(f.id) }}
          >
            {f.label}
          </option>
        ))}
      </select>
      <input
        ref={input}
        aria-label="Text size"
        title="Text size in pixels · Enter to apply"
        type="number"
        min="8"
        max="128"
        step="1"
        defaultValue={parseFloat(size || "") || appearance.size}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="h-8 w-12 shrink-0 rounded border border-neutral-700 bg-neutral-900 px-1.5 text-xs"
        onBlur={() => applySize()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applySize(true);
          }
        }}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          className="max-w-48 shrink-0 whitespace-normal text-xs text-rose-400"
        >
          {error}
        </span>
      )}
    </>
  );
}
export function NoteInlineStyleTools({
  editor,
  underline,
  highlight,
  superscript,
  subscript,
  onPanel,
}: {
  editor: Editor | null;
  underline: boolean;
  highlight: boolean;
  superscript: boolean;
  subscript: boolean;
  onPanel: (panel: NotePanel) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={`note-tool ${underline ? "text-blue-400" : ""}`}
        aria-label="Underline"
        aria-pressed={underline}
        title="Underline · Ctrl/Cmd+U"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        data-note-overlay-trigger
        aria-label="Text color"
        title="Text color"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPanel("color")}
      >
        <Paintbrush className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={`note-tool ${highlight ? "text-blue-400" : ""}`}
        data-note-overlay-trigger
        aria-label="Text highlight"
        title="Highlight color"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPanel("highlight")}
      >
        <Highlighter className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        data-note-overlay-trigger
        aria-label="Text alignment"
        title="Paragraph alignment"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPanel("alignment")}
      >
        <AlignLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        aria-label="Superscript"
        aria-pressed={superscript}
        title="Superscript"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleSuperscript().run()}
      >
        <Superscript className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        aria-label="Subscript"
        aria-pressed={subscript}
        title="Subscript"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleSubscript().run()}
      >
        <Subscript className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        aria-label="Clear text formatting"
        title="Clear formatting"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .unsetAllMarks()
            .clearNodes()
            .unsetTextAlign()
            .run()
        }
      >
        <Eraser className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="note-tool"
        data-note-overlay-trigger
        aria-label="Document appearance"
        title="Default font, reading width and spacing"
        onClick={() => onPanel("appearance")}
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </>
  );
}
export function NoteStylePanel({
  panel,
  editor,
  appearance,
  onAppearance,
  onClose,
}: {
  panel: NotePanel;
  editor: Editor | null;
  appearance: NoteAppearance;
  onAppearance: (value: NoteAppearance) => void;
  onClose: () => void;
}) {
  if (!panel || panel === "links" || panel === "export") return null;
  const title = {
    appearance: "Document appearance",
    color: "Text color",
    highlight: "Text highlight",
    alignment: "Text alignment",
  }[panel];
  return (
    <aside
      role="region"
      aria-label={title}
      className="absolute left-2 top-24 z-40 w-72 max-w-[calc(100%-1rem)] space-y-3 overflow-auto rounded-xl border border-neutral-700 bg-[#18181b] p-3 text-xs shadow-lg"
      style={{ maxHeight: "calc(100% - 110px)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-100">{title}</h3>
        <button
          type="button"
          aria-label={`Close ${title.toLowerCase()}`}
          className="note-tool"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {panel === "appearance" ? (
        <>
          <p className="leading-5 text-neutral-400">
            Reading preferences on this device. Selected text keeps its own
            formatting.
          </p>
          <label className="block space-y-1">
            Default font
            <select
              aria-label="Default note font"
              className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
              value={appearance.font}
              onChange={(e) =>
                onAppearance({
                  ...appearance,
                  font: e.target.value as NoteAppearance["font"],
                })
              }
            >
              {NOTE_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            Default size
            <select
              aria-label="Default note size"
              className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
              value={appearance.size}
              onChange={(e) =>
                onAppearance({ ...appearance, size: +e.target.value })
              }
            >
              {[12, 14, 16, 18, 20, 24].map((n) => (
                <option key={n} value={n}>
                  {n} px
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            Page width
            <select
              aria-label="Note page width"
              className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
              value={appearance.width}
              onChange={(e) =>
                onAppearance({
                  ...appearance,
                  width: e.target.value as NoteAppearance["width"],
                })
              }
            >
              <option value="reading">Reading</option>
              <option value="wide">Wide</option>
              <option value="full">Full width</option>
            </select>
          </label>
          <label className="block space-y-1">
            Line spacing
            <select
              aria-label="Note line spacing"
              className="w-full rounded border border-neutral-700 bg-neutral-900 p-2"
              value={appearance.lineHeight}
              onChange={(e) =>
                onAppearance({ ...appearance, lineHeight: +e.target.value })
              }
            >
              <option value="1.4">Compact</option>
              <option value="1.75">Comfortable</option>
              <option value="2.1">Airy</option>
            </select>
          </label>
        </>
      ) : panel === "alignment" ? (
        <div className="grid grid-cols-2 gap-2">
          {(["left", "center", "right", "justify"] as const).map((align) => (
            <button
              type="button"
              key={align}
              aria-label={`Align ${align}`}
              aria-pressed={editor?.isActive({ textAlign: align })}
              className="rounded border border-neutral-700 px-3 py-2 capitalize hover:bg-neutral-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor?.chain().focus().setTextAlign(align).run();
                onClose();
              }}
            >
              {align}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label={title}
            className="grid grid-cols-5 gap-2"
          >
            {(panel === "color" ? NOTE_COLORS : NOTE_HIGHLIGHTS).map(
              (color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={`${title} ${color}`}
                  title={color}
                  className="h-8 rounded border border-neutral-600 focus-visible:outline-2 focus-visible:outline-blue-500"
                  style={{ backgroundColor: color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const chain = editor?.chain().focus();
                    if (panel === "color") chain?.setColor(color).run();
                    else chain?.setHighlight({ color }).run();
                    onClose();
                  }}
                />
              ),
            )}
          </div>
          <label className="flex items-center justify-between gap-2">
            Custom color
            <input
              type="color"
              aria-label={`Custom ${title.toLowerCase()}`}
              defaultValue={panel === "color" ? "#7dd3fc" : "#665329"}
              className="h-8 w-12 rounded border border-neutral-700 bg-transparent"
              onChange={(e) => {
                const chain = editor?.chain().focus();
                if (panel === "color") chain?.setColor(e.target.value).run();
                else chain?.setHighlight({ color: e.target.value }).run();
              }}
            />
          </label>
          <button
            type="button"
            className="rounded border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const chain = editor?.chain().focus();
              if (panel === "color") chain?.unsetColor().run();
              else chain?.unsetHighlight().run();
              onClose();
            }}
          >
            Reset {panel === "color" ? "text color" : "highlight"}
          </button>
        </>
      )}
    </aside>
  );
}
