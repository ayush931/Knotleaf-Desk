"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, LayoutTemplate, LoaderCircle } from "lucide-react";
import { TEMPLATES, type TemplateDefinition } from "@/draw/templatesData";
import {
  drawElement,
  getElementBounds,
  loadCanvasFonts,
  unionBounds,
} from "@/draw/renderer";
import type { Theme } from "@/draw/types";

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (
    template: TemplateDefinition,
    replace: boolean,
  ) => void | Promise<void>;
  theme: Theme;
}
const categories = [
  ["all", "All"],
  ["architecture", "Architecture"],
  ["flowchart", "Flowcharts"],
  ["system-design", "System design"],
  ["agile", "Planning"],
] as const;

function TemplatePreview({ template }: { template: TemplateDefinition }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    const paint = () => {
      const surface = canvas.current,
        ctx = surface?.getContext("2d");
      if (disposed || !surface || !ctx) return;
      const bounds = unionBounds(
        template.elements.map((el) => getElementBounds(el, template.elements)),
      );
      if (!bounds) return;
      const scale = Math.min(
        (surface.width - 48) / Math.max(1, bounds.maxX - bounds.minX),
        (surface.height - 40) / Math.max(1, bounds.maxY - bounds.minY),
      );
      ctx.clearRect(0, 0, surface.width, surface.height);
      ctx.save();
      ctx.translate(surface.width / 2, surface.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(
        -(bounds.minX + bounds.maxX) / 2,
        -(bounds.minY + bounds.maxY) / 2,
      );
      for (const element of template.elements)
        drawElement(ctx, element, { theme: "dark", scene: template.elements });
      ctx.restore();
    };
    paint();
    void loadCanvasFonts()
      .then(paint)
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [template]);
  return (
    <canvas
      ref={canvas}
      width={600}
      height={260}
      aria-hidden="true"
      className="block aspect-[30/13] h-auto w-full rounded-lg border border-neutral-800 bg-[#121212]"
    />
  );
}

function TemplateDialog({
  onClose,
  onSelectTemplate,
}: Omit<TemplatesModalProps, "isOpen">) {
  const dialog = useRef<HTMLDialogElement>(null),
    search = useRef<HTMLInputElement>(null),
    pending = useRef(false);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [replace, setReplace] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const surface = dialog.current;
    surface?.showModal();
    search.current?.focus();
    return () => {
      surface?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const matches = useMemo(
    () =>
      TEMPLATES.filter(
        (template) =>
          (category === "all" || template.category === category) &&
          `${template.name} ${template.description} ${template.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [category, query],
  );
  const choose = async (template: TemplateDefinition) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(template.id);
    setError("");
    try {
      await onSelectTemplate(template, replace);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not add the template. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="template-title"
      aria-describedby="template-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onClose();
      }}
      className="m-auto w-[min(880px,calc(100vw-24px))] max-w-none max-h-[min(880px,92dvh)] overflow-hidden rounded-xl border border-neutral-700 bg-[#18181b] p-0 text-neutral-200 shadow-xl"
    >
      <div className="flex max-h-[min(880px,92dvh)] flex-col">
        <header className="shrink-0 space-y-3 border-b border-neutral-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="template-title"
                className="flex items-center gap-2 text-base font-semibold"
              >
                <LayoutTemplate className="h-4 w-4 text-blue-400" />
                Templates
              </h2>
              <p
                id="template-description"
                className="mt-1 text-xs text-neutral-400"
              >
                Editable diagrams, centered and fitted to your canvas. Starter
                documentation goes in Notes.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close templates"
              title="Close · Escape"
              disabled={!!busy}
              onClick={onClose}
              className="note-tool disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-neutral-500"
            />
            <input
              ref={search}
              aria-label="Search templates"
              placeholder="Search diagrams and planning boards…"
              value={query}
              disabled={!!busy}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-1.5 pl-9 pr-9 text-sm"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear template search"
                disabled={!!busy}
                onClick={() => {
                  setQuery("");
                  search.current?.focus();
                }}
                className="absolute right-1 top-0.5 note-tool"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label="Template categories"
            className="flex flex-wrap gap-1"
          >
            {categories.map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={category === id}
                disabled={!!busy}
                onClick={() => setCategory(id)}
                className={`rounded-md border px-2 py-1 text-xs ${category === id ? "border-blue-500/50 bg-blue-500/10 text-blue-300" : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <p role="status" className="mb-3 text-[11px] text-neutral-500">
            {busy
              ? "Adding template…"
              : `${matches.length} ${matches.length === 1 ? "template" : "templates"}`}
          </p>
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300"
            >
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {matches.map((template) => (
              <article
                key={template.id}
                className="flex min-w-0 flex-col rounded-xl border border-neutral-800 p-3"
              >
                <TemplatePreview template={template} />
                <h3 className="mt-3 text-sm font-semibold">{template.name}</h3>
                <p className="mb-3 mt-1 flex-1 text-xs leading-relaxed text-neutral-400">
                  {template.description}
                </p>
                <button
                  type="button"
                  aria-label={`Add template: ${template.name}`}
                  disabled={!!busy}
                  onClick={() => void choose(template)}
                  className="flex min-h-8 items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:cursor-default disabled:opacity-40"
                >
                  {busy === template.id ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <LayoutTemplate className="h-3.5 w-3.5" />
                  )}
                  {busy === template.id
                    ? "Adding…"
                    : replace
                      ? "Replace canvas"
                      : "Add to canvas"}
                </button>
              </article>
            ))}
          </div>
          {!matches.length && (
            <p className="py-12 text-center text-sm text-neutral-400">
              No matching templates. Try another search or category.
            </p>
          )}
        </div>
        <footer className="shrink-0 space-y-1 border-t border-neutral-800 p-4 text-xs">
          <label className="flex items-center gap-2 text-neutral-300">
            <input
              type="checkbox"
              checked={replace}
              disabled={!!busy}
              onChange={(event) => setReplace(event.target.checked)}
              className="accent-blue-500"
            />
            Replace current canvas
          </label>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            {replace
              ? "Replaces drawing elements; Undo restores them. Existing notes are kept."
              : "Adds beside existing artwork and brings the new diagram into view."}
          </p>
        </footer>
      </div>
    </dialog>
  );
}

export function TemplatesModal(props: TemplatesModalProps) {
  return props.isOpen ? <TemplateDialog {...props} /> : null;
}
