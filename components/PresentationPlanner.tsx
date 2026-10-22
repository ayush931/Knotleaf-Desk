"use client";
import { useEffect, useRef } from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, X, Undo2 } from "lucide-react";
import { parseSlides, type Deck, type Slide } from "@/lib/presentations/model";
import { STORY_STARTERS } from "@/lib/presentations/authoring";
import { SlideSurface } from "./PresentationSlide";
export type SlideAction = "up" | "down" | "duplicate" | "delete";
const button =
  "inline-flex items-center justify-center gap-1 rounded border border-neutral-700 px-2 py-1.5 text-xs hover:bg-neutral-800 focus-visible:outline-blue-500 disabled:opacity-30";
export function PresentationPlanner({
  mode,
  deck,
  slides,
  active,
  onClose,
  onSelect,
  onAction,
  onStarter,
  onUndo,
}: {
  mode: "organize" | "starters";
  deck: Deck;
  slides: Slide[];
  active: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  onAction: (action: SlideAction, index: number) => void;
  onStarter: (source: string) => void;
  onUndo?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const action = (kind: SlideAction, index: number) => {
    onAction(kind, index);
    const next =
      kind === "up"
        ? index - 1
        : kind === "down" || kind === "duplicate"
          ? index + 1
          : Math.max(0, index - 1);
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLButtonElement>(
          `[data-slide-index="${next}"] [data-slide-select]`,
        )
        ?.focus(),
    );
  };
  return (
    <dialog
      ref={dialog}
      aria-label={
        mode === "organize" ? "Organize slides" : "Choose a story starter"
      }
      onCancel={onClose}
      onClose={onClose}
      className="m-auto max-h-[88dvh] w-[min(960px,94vw)] overflow-auto rounded-xl border border-neutral-700 bg-[#18181b] p-4 text-neutral-200 backdrop:bg-black/70 sm:p-5"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === "organize" ? "Shape your story" : "Start with a story"}
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            {mode === "organize"
              ? "Move, duplicate, or remove slides. Speaker notes and reveals move with them."
              : "Choose a useful structure. These slides are added after your current slide."}
          </p>
        </div>
        {mode === "organize" && (
          <button className={button} disabled={!onUndo} onClick={onUndo}>
            <Undo2 size={13} />
            Undo change
          </button>
        )}
        <button
          className={button}
          autoFocus
          aria-label="Close slide planner"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mode === "organize"
          ? slides.map((slide, index) => (
              <article
                key={index}
                data-slide-index={index}
                className={`min-w-0 overflow-hidden rounded-lg border ${index === active ? "border-blue-500" : "border-neutral-700"}`}
              >
                <button
                  data-slide-select
                  aria-label={`Edit slide ${index + 1}: ${slide.title}`}
                  aria-pressed={index === active}
                  className="block w-full text-left hover:bg-neutral-800 focus-visible:outline-blue-500"
                  onClick={() => {
                    onSelect(index);
                    onClose();
                  }}
                >
                  <div className="pointer-events-none aspect-video">
                    <SlideSurface slide={slide} deck={deck} lazy />
                  </div>
                  <p className="truncate px-3 pt-2 text-xs">
                    <span className="mr-2 text-neutral-500">{index + 1}</span>
                    {slide.title}
                  </p>
                </button>
                <div className="flex flex-wrap gap-1 p-2">
                  <button
                    className={button}
                    disabled={index === 0}
                    aria-label={`Move slide ${index + 1} earlier`}
                    onClick={() => action("up", index)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className={button}
                    disabled={index === slides.length - 1}
                    aria-label={`Move slide ${index + 1} later`}
                    onClick={() => action("down", index)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className={button}
                    aria-label={`Duplicate slide ${index + 1}`}
                    onClick={() => action("duplicate", index)}
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    className={`${button} ml-auto`}
                    aria-label={`Delete slide ${index + 1}`}
                    onClick={() => action("delete", index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))
          : STORY_STARTERS.map((starter) => (
              <button
                key={starter.id}
                className="min-w-0 overflow-hidden rounded-lg border border-neutral-700 text-left hover:border-blue-500 focus-visible:outline-blue-500"
                aria-label={`Insert ${starter.title} starter`}
                onClick={() => {
                  onStarter(starter.source);
                  onClose();
                }}
              >
                <div className="pointer-events-none aspect-video">
                  <SlideSurface
                    slide={parseSlides(starter.source)[0]}
                    deck={deck}
                    lazy
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium">{starter.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    {starter.description}
                  </p>
                  <p className="mt-2 text-[10px] text-neutral-500">
                    {parseSlides(starter.source).length} slides · your current
                    theme
                  </p>
                </div>
              </button>
            ))}
      </div>
    </dialog>
  );
}
