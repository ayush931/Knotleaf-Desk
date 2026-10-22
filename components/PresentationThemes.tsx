"use client";
import { useEffect, useId, useRef } from "react";
import { SlideSurface } from "./PresentationSlide";
import { parseSlides } from "@/lib/presentations/model";
import { Check, X } from "lucide-react";
import { THEMES, type DeckTheme } from "@/lib/presentations/model";
/** A visual theme gallery, rather than a text-only font/color selector. */
export function PresentationThemes({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: DeckTheme;
  onChange: (theme: DeckTheme) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto max-h-[88dvh] w-[min(840px,94vw)] overflow-auto rounded-xl border border-neutral-700 bg-[#18181b] p-5 text-neutral-100 backdrop:bg-black/70"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Choose your slide theme
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Each theme brings its own typography, composition, and backdrop.
            Your Markdown stays the same.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close theme gallery"
          autoFocus
          onClick={onClose}
          className="rounded-md p-2 hover:bg-neutral-800"
        >
          <X size={18} />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {open &&
          Object.entries(THEMES).map(([id, theme]) => (
            <button
              key={id}
              type="button"
              aria-label={`Use ${theme.label.split(" · ")[0]} theme`}
              aria-pressed={value === id}
              className={`overflow-hidden rounded-lg border text-left transition hover:border-blue-400 focus-visible:outline-blue-500 ${value === id ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-700"}`}
              onClick={() => {
                onChange(id as DeckTheme);
                onClose();
              }}
            >
              <div className="pointer-events-none aspect-video">
                <SlideSurface
                  lazy
                  slide={
                    parseSlides(
                      "# A clear perspective.\n\nInsight. Direction. Next steps.\n\n**Built around your ideas.**",
                    )[0]
                  }
                  deck={{
                    version: 1,
                    title: "Theme preview",
                    source: "",
                    theme: id as DeckTheme,
                    layout: "standard",
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 bg-neutral-900 px-3 py-2.5">
                <div>
                  <strong className="block text-xs">
                    {theme.label.split(" · ")[0]}
                  </strong>
                  <span className="text-[10px] text-neutral-400">
                    {theme.label.split(" · ")[1]}
                  </span>
                </div>
                {value === id && <Check size={15} className="text-blue-400" />}
              </div>
            </button>
          ))}
      </div>
    </dialog>
  );
}
