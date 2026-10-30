"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SlideSurface } from "./PresentationSlide";
import { parseSlides } from "@/lib/presentations/model";
import { Check, X } from "lucide-react";
import { THEMES, type DeckTheme, type Deck, type Slide } from "@/lib/presentations/model";
/** A visual theme gallery, rather than a text-only font/color selector. */
export function PresentationThemes({
  open,
  value,
  deck,
  slide,
  onChange,
  onClose,
}: {
  open: boolean;
  value: DeckTheme;
  deck: Deck;
  slide: Slide;
  onChange: (theme: DeckTheme) => void;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<"all" | "light" | "dark">("all");
  const [preview, setPreview] = useState<"current" | "sample">("current");
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
      <div className="mb-4 flex flex-wrap items-center gap-3 border-y border-neutral-700 py-3 text-xs">
        <fieldset className="flex items-center gap-1" aria-label="Filter themes by appearance">
          <legend className="sr-only">Filter themes by appearance</legend>
          {(["all", "light", "dark"] as const).map(option => <button key={option} type="button" aria-pressed={tone === option} onClick={() => setTone(option)} className={`rounded-md px-3 py-1.5 capitalize focus-visible:outline-2 focus-visible:outline-blue-400 ${tone === option ? "bg-blue-600 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}>{option}</button>)}
        </fieldset>
        <label className="ml-auto flex items-center gap-2 text-neutral-300">Preview
          <select aria-label="Theme preview content" value={preview} onChange={event => setPreview(event.target.value as "current" | "sample")} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"><option value="current">Current slide</option><option value="sample">Sample slide</option></select>
        </label>
      </div>
      {slide.theme && preview === "current" && <p className="mb-3 text-xs text-amber-300">This slide has its own theme override. The gallery previews the deck theme; the override remains in effect after selection.</p>}
      {(deck.backgroundColor || deck.backgroundImage || deck.headingFont || deck.bodyFont || deck.bodySize || (deck.backdrop && deck.backdrop !== "theme")) && <p className="mb-3 text-xs text-neutral-400">Your custom background, typography and backdrop settings remain applied in these previews.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {open &&
          Object.entries(THEMES).filter(([, theme]) => {
            const hex = theme.background.slice(1);
            const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
            const light = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 >= 150;
            return tone === "all" || (tone === "light" ? light : !light);
          }).map(([id, theme]) => (
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
              <div aria-hidden="true" className="pointer-events-none aspect-video">
                <SlideSurface
                  lazy
                  slide={preview === "current" ? { ...slide, theme: undefined } : parseSlides("# A clear perspective.\n\nInsight. Direction. Next steps.\n\n**Built around your ideas.**")[0]}
                  deck={{ ...deck, theme: id as DeckTheme }}
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
