"use client";
import { useEffect, useRef, useId, useState } from "react";
import { X } from "lucide-react";
import { THEMES, type Deck } from "@/lib/presentations/model";
import {
  BACKDROPS,
  COMPOSITIONS,
  TRANSITIONS,
} from "@/lib/presentations/design";
export function PresentationDesign({
  open,
  deck,
  onChange,
  onClose,
}: {
  open: boolean;
  deck: Deck;
  onChange: (value: Partial<Deck>) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDialogElement>(null),
    title = useId();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  const select =
    "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200";
  return (
    <dialog
      ref={ref}
      aria-labelledby={title}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto max-h-[88dvh] w-[min(660px,94vw)] overflow-auto rounded-xl border border-neutral-700 bg-[#18181b] p-5 text-neutral-200 backdrop:bg-black/70"
    >
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h2 id={title} className="font-semibold">
            Presentation design
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Composition, typography, and movement. Your Markdown stays intact.
          </p>
        </div>
        <button
          onClick={onClose}
          autoFocus
          aria-label="Close presentation design"
          className="rounded p-2 hover:bg-neutral-800"
        >
          <X size={18} />
        </button>
      </header>
      <fieldset>
        <legend className="mb-2 text-xs text-neutral-400">Composition</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COMPOSITIONS.map((name) => (
            <button
              key={name}
              aria-pressed={(deck.template || "classic") === name}
              onClick={() => onChange({ template: name })}
              className={`rounded-lg border p-3 text-left capitalize ${(deck.template || "classic") === name ? "border-blue-500 bg-blue-500/10 text-blue-200" : "border-neutral-700 hover:border-neutral-500"}`}
            >
              <div
                className={`mb-3 h-14 rounded bg-neutral-950 p-2 ${name === "spotlight" ? "flex flex-col items-center justify-center" : ""} ${name === "editorial" ? "border-t-2 border-blue-300" : ""}`}
              >
                <span
                  className={`mb-1 block h-1.5 w-8 rounded bg-blue-200 ${name === "spotlight" ? "w-12!" : ""}`}
                />
                <span className="mb-1 block h-1 w-12 rounded bg-neutral-600" />
                {name !== "minimal" && (
                  <span className="block h-1 w-9 rounded bg-neutral-700" />
                )}
              </div>
              <span className="text-xs">{name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-neutral-400">
          Backdrop
          <select
            aria-label="Presentation backdrop"
            className={select}
            value={deck.backdrop || "theme"}
            onChange={(event) =>
              onChange({ backdrop: event.target.value as Deck["backdrop"] })
            }
          >
            {BACKDROPS.map((value) => (
              <option key={value} value={value}>
                {value === "theme"
                  ? "Theme default"
                  : (
                      {
                        none: "Clean surface",
                        grid: "Fine grid",
                        dots: "Dot matrix",
                        topo: "Contour lines",
                        beams: "Diagonal rules",
                        waves: "Contour waves",
                        mesh: "Soft light wash",
                      } as Record<string, string>
                    )[value] || value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          Slide transition
          <select
            aria-label="Slide transition"
            className={select}
            value={deck.transition || "fade"}
            onChange={(event) =>
              onChange({ transition: event.target.value as Deck["transition"] })
            }
          >
            {TRANSITIONS.map((value) => (
              <option key={value} value={value}>
                {(
                  {
                    none: "None",
                    slide: "Slide",
                    fade: "Fade",
                    zoom: "Zoom",
                    lift: "Lift",
                  } as Record<string, string>
                )[value] || value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 text-xs text-neutral-400">
          Background color
          <input
            aria-label="Presentation background color"
            type="color"
            value={deck.backgroundColor || THEMES[deck.theme].background}
            onChange={(event) =>
              onChange({ backgroundColor: event.target.value })
            }
          />
          <button
            className="text-blue-300 hover:underline"
            type="button"
            onClick={() => onChange({ backgroundColor: undefined })}
          >
            Reset
          </button>
        </label>
      </div>
      <div className="mt-5 rounded-lg border border-neutral-700 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-neutral-400">
            Background image
          </span>
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            className="rounded border border-neutral-600 px-3 py-1.5 text-xs hover:bg-neutral-800"
          >
            {deck.backgroundImage ? "Replace image" : "Upload image"}
          </button>
          {deck.backgroundImage && (
            <button
              type="button"
              className="rounded px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
              onClick={() => onChange({ backgroundImage: undefined })}
            >
              Remove
            </button>
          )}
        </div>
        {deck.backgroundImage && (
          <label className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
            Image opacity
            <input
              aria-label="Background image opacity"
              className="min-w-0 flex-1 accent-blue-500"
              type="range"
              min="0"
              max="100"
              value={Math.round((deck.backgroundOpacity ?? 0.25) * 100)}
              onChange={(event) =>
                onChange({
                  backgroundOpacity: Number(event.target.value) / 100,
                })
              }
            />
            {Math.round((deck.backgroundOpacity ?? 0.25) * 100)}%
          </label>
        )}
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload presentation background"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              onChange({
                backgroundImage: String(reader.result),
                backgroundOpacity: deck.backgroundOpacity ?? 0.25,
              });
              setError("");
            };
            reader.onerror = () =>
              setError("Could not read this image. Try another file.");
            reader.readAsDataURL(file);
          }}
        />
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-neutral-700 pt-4 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={deck.animateBackground !== false}
            onChange={(event) =>
              onChange({ animateBackground: event.target.checked })
            }
            className="accent-blue-500"
          />
          Slow backdrop animation
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={deck.animateBlocks !== false}
            onChange={(event) =>
              onChange({ animateBlocks: event.target.checked })
            }
            className="accent-blue-500"
          />
          Stagger slide content
        </label>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Motion plays while presenting. The editor stays steady, and
        reduced-motion preferences are respected. PDF is always static.
      </p>
    </dialog>
  );
}
