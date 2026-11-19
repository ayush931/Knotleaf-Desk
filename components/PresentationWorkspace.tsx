"use client";
import "katex/dist/katex.min.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FontSelect } from "./FontSelect";
import { themeTypography } from "@/lib/presentations/design";
import { PresentationPlanner, type SlideAction } from "./PresentationPlanner";
import {
  moveSlide,
  duplicateSlide,
  insertSlides,
  writeSpeakerNotes,
} from "@/lib/presentations/authoring";
import { PresentationGuide } from "./PresentationGuide";
import { PresentationThemes } from "./PresentationThemes";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  X,
  Upload,
  Download,
  ImagePlus,
  BookOpen,
  CircleHelp,
  Trash2,
  Undo2,
  PanelsTopLeft,
  Grid2X2,
  MonitorPlay,
  FileCode2,
  NotebookPen,
  Layers,
  RotateCcw,
  Bug,
} from "lucide-react";
import {
  parseSlides,
  slideAt,
  notesToDeck,
  loadDeck,
  readDeck,
  deckKey,
  THEMES,
  removeSlide,
  revealCount,
  type Deck,
} from "@/lib/presentations/model";
import { PRESENTATION_SNIPPETS } from "@/lib/presentations/snippets";
import { usePresenterSession } from "@/lib/presentations/usePresenterSession";
import { PresentationLibrary } from "./PresentationLibrary";
import { PresentationSource } from "./PresentationSource";
import { PresentationHtml } from "./PresentationHtml";
import { PresentationCommands } from "./PresentationCommands";
import {
  listDecks,
  activeDeck,
  chooseDeck,
  newDeck,
  duplicateDeck,
  deleteDeck,
  writeDeck,
} from "@/lib/presentations/library";
import { lintPresentation } from "@/lib/presentations/lint.mjs";
import { PresentationPresenter } from "./PresentationPresenter";
import { SlideSurface, SlideStyles } from "./PresentationSlide";
import { PresentationDesign } from "./PresentationDesign";

import { exportDeck } from "@/lib/presentations/export";

const unsavedDecks = new Map<string, Deck>();

const button =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40";
type WorkspaceProps = {
  boardId: string;
  title: string;
  notes: string;
  onCanvasSnapshot: () => Promise<string[]>;
  onReportBug: () => void;
};
export function PresentationWorkspace(props: WorkspaceProps) {
  const [id, setId] = useState(() => {
      try {
        return activeDeck(props.boardId);
      } catch {
        return props.boardId;
      }
    }),
    [library, setLibrary] = useState(false),
    [error, setError] = useState(""),
    [items, setItems] = useState(() => {
      try {
        return listDecks();
      } catch {
        return [];
      }
    });
  useEffect(() => {
    const refresh = () => {
      try {
        setItems(listDecks());
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not read the presentation library.",
        );
      }
    };
    window.addEventListener("knotleaf-presentation-library", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("knotleaf-presentation-library", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const select = (next: string) => {
    try {
      chooseDeck(props.boardId, next);
      setId(next);
      setLibrary(false);
      setError("");
    } catch {
      setError(
        "Could not save the selected presentation. Check browser storage.",
      );
    }
  };
  const create = (kind: "markdown" | "html") => {
    try {
      select(
        newDeck(
          kind === "html" ? "Untitled document" : "Untitled presentation",
          kind,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create a presentation.",
      );
    }
  };
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
        >
          {error}
          <button data-ui-tone="neutral"
            aria-label="Dismiss library error"
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <PresentationEditor
        key={id}
        {...props}
        boardId={id}
        onLibrary={() => setLibrary(true)}
        onNew={create}
        libraryCount={items.length}
      />
      {library && (
        <PresentationLibrary
          items={items}
          currentId={id}
          onClose={() => setLibrary(false)}
          onOpen={select}
          onCreate={create}
          onDuplicate={(value) => {
            try {
              select(duplicateDeck(value, unsavedDecks.get(value)));
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not duplicate presentation.",
              );
            }
          }}
          onDelete={(value) => {
            try {
              deleteDeck(value);
              unsavedDecks.delete(value);
              if (value === id) {
                const next =
                  listDecks()[0]?.id || newDeck("Untitled presentation");
                select(next);
              }
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not delete presentation.",
              );
            }
          }}
        />
      )}
    </div>
  );
}
function PresentationEditor({
  boardId,
  title,
  notes,
  onCanvasSnapshot,
  onReportBug,
  onLibrary,
  onNew,
  libraryCount,
}: WorkspaceProps & {
  onLibrary: () => void;
  onNew: (kind: "markdown" | "html") => void;
  libraryCount: number;
}) {
  const [initial] = useState(() => {
    try {
      return {
        deck: unsavedDecks.get(boardId) || loadDeck(boardId, title),
        error: "",
      };
    } catch (reason) {
      return {
        deck: null,
        error: `Your saved presentation could not be opened. It has been left untouched. ${reason instanceof Error ? reason.message : ""}`,
      };
    }
  });
  const [deck, setDeck] = useState<Deck | null>(initial.deck),
    [error, setError] = useState(initial.error),
    [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "failed">("saving"),
    [index, setIndex] = useState(0),
    [showSource, setShowSource] = useState(true),
    [narrowPane, setNarrowPane] = useState<"source" | "preview">("preview"),
    [help, setHelp] = useState(false),
    [themeGallery, setThemeGallery] = useState(false),
    [designOpen, setDesignOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [planner, setPlanner] = useState<"organize" | "starters" | null>(null),
    [commandsOpen, setCommandsOpen] = useState(false),
    [grid, setGrid] = useState(false),
    [rehearsal, setRehearsal] = useState<{ slide: number; step: number } | null>(null),
    [lintOpen, setLintOpen] = useState(false),
    [editorWidth, setEditorWidth] = useState(40),
    [exportFormat, setExportFormat] = useState<"pdf" | "html" | "md" | "json">(
      "pdf",
    );
  const [presenting, setPresenting] = useState(false);
  const sourceRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null),
    presentButton = useRef<HTMLButtonElement>(null),
    guideButton = useRef<HTMLButtonElement>(null),
    pending = useRef<Deck | null>(null),
    draft = useRef(initial.deck),
    filmstrip = useRef<HTMLElement>(null),
    mounted = useRef(false),
    busyRef = useRef(false);
  const slides = React.useMemo(
    () => parseSlides(deck?.source || ""),
    [deck?.source],
  );
  const active = Math.min(index, slides.length - 1);
  const reveals = deck?.kind === "html" ? 0 : revealCount(slides[active].source);
  const rehearsing = rehearsal?.slide === active;
  const previewStep = rehearsing ? Math.min(rehearsal.step, reveals) : Infinity;
  const projector = usePresenterSession(boardId, deck, setIndex);
  const issues = React.useMemo(
    () => (deck?.kind === "html" ? [] : lintPresentation(deck?.source || "")),
    [deck?.source, deck?.kind],
  );
  const [undoDelete, setUndoDelete] = useState<{
    source: string;
    index: number;
    label?: string;
    slideIds?: string[];
  } | null>(null);
  const [imported, setImported] = useState<Deck | null>(null);
  const save = useCallback((value: Deck) => {
    writeDeck(boardId, value);
    if (unsavedDecks.get(boardId) === value) unsavedDecks.delete(boardId);
    if (pending.current === value) pending.current = null;
  }, [boardId]);
  const saveAndReport = useCallback((value: Deck) => {
    try {
      save(value);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  }, [save]);
  useEffect(() => {
    if (!deck) return;
    if (!pending.current && draft.current === deck) {
      pending.current = deck;
      unsavedDecks.set(boardId, deck);
    }
    const timer = setTimeout(() => {
      if (draft.current === deck) saveAndReport(deck);
    }, 400);
    return () => clearTimeout(timer);
  }, [deck, boardId, saveAndReport]);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      if (pending.current)
        try {
          save(pending.current);
        } catch {
          /* Keep existing saved data intact when storage fails. */
        }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      mounted.current = false;
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, [save]);
  const update = (next: Partial<Deck>, replacement?: Deck) => {
    const value = draft.current;
    if (!value || !mounted.current) return;
    const merged = replacement ?? { ...value, ...next };
      if (
        !replacement && next.source !== undefined &&
        value.slideIds &&
        next.slideIds === undefined
      )
        merged.slideIds = parseSlides(next.source).map(
          (_, i) => value.slideIds?.[i] || crypto.randomUUID(),
        );
    draft.current = merged;
    pending.current = merged;
    unsavedDecks.set(boardId, merged);
    setDeck(merged);
    setSaveStatus("saving");
    setError("");
    if (next.source !== undefined) {
      setUndoDelete(null);
      projector.stopFollowing();
    }
  };
  const goToSlide = (position: number, focusSource = false, sourceSlides = slides) => {
    const next = Math.max(0, Math.min(position, sourceSlides.length - 1));
    projector.stopFollowing();
    setRehearsal(null);
    setIndex(next);
    if (focusSource) {
      setShowSource(true);
      setNarrowPane("source");
    }
    const moveCaret = () => {
      const editor = sourceRef.current;
      if (focusSource) editor?.focus({ preventScroll: true });
      editor?.setSelectionRange(sourceSlides[next].start, sourceSlides[next].start);
      if (editor && sourceSlides[next].start === 0) editor.scrollTop = 0;
    };
    if (!focusSource && sourceRef.current?.value === draft.current?.source) moveCaret();
    else requestAnimationFrame(moveCaret);
  };
  useEffect(() => {
    const strip = filmstrip.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!strip || !current) return;
    const frame = strip.getBoundingClientRect();
    const card = current.getBoundingClientRect();
    if (card.left < frame.left) strip.scrollLeft += card.left - frame.left - 8;
    else if (card.right > frame.right) strip.scrollLeft += card.right - frame.right + 8;
  }, [active, slides.length]);
  const undoStructure = () => {
    if (!undoDelete) return;
    update({
      source: undoDelete.source,
      slideIds: undoDelete.slideIds || slides.map((_, i) => String(i)),
    });
    goToSlide(undoDelete.index, false, parseSlides(undoDelete.source));
    setUndoDelete(null);
  };
  const changeSlide = (action: SlideAction, position: number) => {
    if (!deck) return;
    const next =
      action === "up"
        ? Math.max(0, position - 1)
        : action === "down"
          ? Math.min(slides.length - 1, position + 1)
          : action === "duplicate"
            ? position + 1
            : Math.max(0, position - 1);
    const source =
      action === "delete"
        ? removeSlide(deck.source, position)
        : action === "duplicate"
          ? duplicateSlide(deck.source, position)
          : moveSlide(deck.source, position, next);
    if (source === deck.source) return;
    const ids = slides.map((_, i) => deck.slideIds?.[i] || String(i));
    if (action === "duplicate")
      ids.splice(position + 1, 0, crypto.randomUUID());
    else if (action === "delete") {
      ids.splice(position, 1);
      if (!ids.length) ids.push(crypto.randomUUID());
    } else {
      const [id] = ids.splice(position, 1);
      ids.splice(next, 0, id);
    }
    update({ source, slideIds: ids });
    setUndoDelete({
      source: deck.source,
      slideIds: deck.slideIds || slides.map((_, i) => String(i)),
      index: active,
      label: action === "delete" ? "Undo delete" : "Undo change",
    });
    goToSlide(next, false, parseSlides(source));
  };
  const addSlides = (addition: string, after: number, label: string, edit = false) => {
    const current = draft.current;
    if (!current || !addition.trim()) return;
    const before = parseSlides(current.source);
    const { source: inserted, index: next } = insertSlides(current.source, addition, after);
    const result = parseSlides(inserted);
    const ids = before.map((_, i) => current.slideIds?.[i] || String(i));
    const previousIds = [...ids];
    const newIds = parseSlides(addition).map(() => crypto.randomUUID());
    if (result.length !== (current.source.trim() ? before.length : 0) + newIds.length) {
      setError("Close any unfinished code or math blocks before inserting slides.");
      return;
    }
    ids.splice(next, current.source.trim() ? 0 : ids.length, ...newIds);
    update({ source: inserted, slideIds: ids });
    setUndoDelete({
      source: current.source,
      slideIds: previousIds,
      index: active,
      label,
    });
    goToSlide(next, edit, result);
  };
  const insert = (value: string) => {
    const current = draft.current;
    if (!current || !value) return;
    const editor = sourceRef.current;
    const start = editor?.selectionStart ?? (current.kind === "html"
      ? current.source.length
      : parseSlides(current.source)[active]?.end ?? current.source.length),
      end = editor?.selectionEnd ?? start;
    const source = current.source.slice(0, start) + value + current.source.slice(end);
    update({ source });
    if (current.kind !== "html") setIndex(slideAt(parseSlides(source), start + value.length));
    setShowSource(true);
    setNarrowPane("source");
    setTimeout(() => {
      sourceRef.current?.focus();
      sourceRef.current?.setSelectionRange(
        start + value.length,
        start + value.length,
      );
    }, 0);
  };
  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError("");
    setBusy("Preparing…");
    try {
      await task();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "This action could not be completed. Your presentation is unchanged.",
      );
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  };
  const stop = () => {
    setPresenting(false);
    setTimeout(() => presentButton.current?.focus(), 0);
  };
  if (!deck)
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-sm">
        <p role="alert">{error || "Opening presentation…"}</p>
        {error && (
          <button data-ui-tone="info"
            className={button}
            onClick={() => {
              const raw = localStorage.getItem(deckKey(boardId));
              if (raw)
                void import("@/lib/presentations/export").then(
                  ({ downloadDeck }) =>
                    downloadDeck(
                      raw,
                      `${title}-recovery.json`,
                      "application/json",
                    ),
                );
            }}
          >
            Download saved data for recovery
          </button>
        )}
      </section>
    );
  return (
    <section
      onKeyDownCapture={(event) => {
        if (
          event.nativeEvent.isComposing ||
          (event.target as HTMLElement).closest("dialog[open]")
        )
          return;
        const mod = event.ctrlKey || event.metaKey,
          key = event.key.toLowerCase();
        if (
          mod &&
          [
            "k",
            "o",
            "enter",
            "s",
            ...(deck.kind !== "html" ? ["/", "g"] : []),
          ].includes(key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (key === "k") setCommandsOpen(true);
          else if (key === "o") onLibrary();
          else if (key === "/") setHelp((value) => !value);
          else if (key === "enter") setPresenting(true);
          else if (key === "s")
            void run(() =>
              exportDeck(deck, event.shiftKey ? "pdf" : "md", setBusy),
            );
          else if (key === "g") setGrid((value) => !value);
        } else if (
          deck.kind !== "html" &&
          event.altKey &&
          !(event.target as HTMLElement).closest("select") &&
          ["arrowleft", "arrowup", "arrowright", "arrowdown"].includes(key)
        ) {
          event.preventDefault();
          goToSlide(active + (key === "arrowleft" || key === "arrowup" ? -1 : 1), true);
        } else if (
          deck.kind !== "html" &&
          mod &&
          event.shiftKey &&
          key === "l"
        ) {
          event.preventDefault();
          setThemeGallery(true);
        } else if (deck.kind !== "html" && mod && key === "d") {
          event.preventDefault();
          addSlides("## New slide", active, "Undo new slide", true);
        } else if (
          deck.kind !== "html" &&
          mod &&
          ["b", "i", "e"].includes(key) &&
          event.target === sourceRef.current
        ) {
          event.preventDefault();
          const editor = sourceRef.current!;
          const mark = key === "b" ? "**" : key === "i" ? "*" : "`";
          insert(
            mark +
              deck.source.slice(editor.selectionStart, editor.selectionEnd) +
              mark,
          );
        }
      }}
      aria-label="Presentation workspace"
      className="presentation-studio flex min-h-0 min-w-0 flex-1 flex-col select-text"
    >
      <SlideStyles />
      <div className="presentation-masthead">
        <div className="presentation-identity">
          <span className="presentation-mark" aria-hidden="true">
            <PanelsTopLeft size={19} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <input
              aria-label="Presentation title"
              value={deck.title}
              onChange={(event) => update({ title: event.target.value })}
              className="min-w-0 max-w-full rounded border border-transparent bg-transparent"
            />
            <span role="status" className="presentation-save">
              {{ saved: "Saved on this device", failed: "Not saved", saving: "Saving…" }[saveStatus]}
            </span>
          </div>
        </div>
        <div className="presentation-delivery">
          <button className={button} onClick={onLibrary}>
            Library <span className="text-neutral-500">{libraryCount}</span>
          </button>
          <button
            className={button}
            onClick={() => {
              saveAndReport(deck);
              if (!projector.open(active)) {
                setError("The audience window was blocked. Use Present or allow pop-ups for this site.");
              }
            }}
          >
            <MonitorPlay size={14} />
            <span>Audience window</span>
          </button>
          <button ref={presentButton} className={`${button} ui-primary presentation-present`} onClick={() => setPresenting(true)}>
            <Play size={14} />
            Present
          </button>
        </div>
      </div>
      <div className="presentation-toolbar">
        <button className={button} onClick={() => setCommandsOpen(true)} title="Presentation commands · Ctrl/Cmd+K">
          <Plus size={14} />
          Insert
        </button>
        {deck.kind !== "html" && (
          <>
            <button
              className={button}
              aria-label="Choose presentation theme"
              aria-haspopup="dialog"
              onClick={() => setThemeGallery(true)}
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded border border-white/20"
                style={{ backgroundImage: THEMES[deck.theme].wash }}
              />
              Themes
            </button>
            <PresentationThemes
              open={themeGallery}
              value={deck.theme}
              deck={deck}
              slide={slides[active]}
              onChange={(theme) => update({ theme })}
              onClose={() => setThemeGallery(false)}
            />
            <button className={button} onClick={() => setDesignOpen(true)}>
              Design
            </button>
            <PresentationDesign
              open={designOpen}
              deck={deck}
              slide={slides[active]}
              onChange={update}
              onClose={() => setDesignOpen(false)}
            />
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              Layout{" "}
              <select
                value={deck.layout}
                onChange={(event) =>
                  update({ layout: event.target.value as Deck["layout"] })
                }
                className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1.5 text-neutral-200"
              >
                <option value="standard">Standard</option>
                <option value="center">Centered</option>
                <option value="split">Two columns</option>
              </select>
            </label>
            <button
              className={button}
              onClick={() => setHelp((value) => !value)}
              aria-expanded={help}
              ref={guideButton}
              aria-label="Presentation writing guide"
            >
              <CircleHelp size={14} />
              Guide
            </button>
          </>
        )}
        <div className="presentation-tools-divider" aria-hidden="true" />
        {deck.kind !== "html" && (
          <div
            role="group"
            aria-label="Slide content typography"
            className="flex items-center gap-2"
          >
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              Font
              <FontSelect
                aria-label="Presentation font"
                defaultLabel="Theme default"
                value={deck.bodyFont || deck.headingFont || ""}
                onChange={(event) => {
                  const font = (event.target.value ||
                    undefined) as Deck["bodyFont"];
                  update({ bodyFont: font, headingFont: font });
                }}
                className="max-w-40 rounded border border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs text-neutral-200"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-neutral-400">
              Size
              <select
                aria-label="Presentation font size"
                value={deck.bodySize || ""}
                onChange={(event) =>
                  update({
                    bodySize: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs text-neutral-200"
              >
                <option value="">
                  Theme · {themeTypography(deck.theme).size}px
                </option>
                {Array.from({ length: 53 }, (_, index) => index + 12).map(
                  (size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}
        <button
          className={`${button} presentation-source-toggle`}
          aria-pressed={showSource}
          onClick={() => setShowSource((value) => !value)}
        >
          {showSource
            ? "Hide editor"
            : deck.kind === "html"
              ? "Edit HTML"
              : "Edit Markdown"}
        </button>
        <div className="presentation-pane-switch" role="group" aria-label="Presentation pane">
          <button className={button} aria-pressed={narrowPane === "source"} onClick={() => { setShowSource(true); setNarrowPane("source"); }}>
            Source
          </button>
          <button className={button} aria-pressed={narrowPane === "preview"} onClick={() => setNarrowPane("preview")}>
            Preview
          </button>
        </div>
        <button
          className={button}
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
        >
          <Upload size={13} />
          Import
        </button>
        <button
          className={button}
          onClick={() => imageRef.current?.click()}
          disabled={!!busy}
        >
          <ImagePlus size={13} />
          Image
        </button>
        {deck.kind !== "html" && (
          <details className="relative">
            <summary className={`${button} cursor-pointer list-none`}>
              <BookOpen size={13} />
              Insert from board
            </summary>
            <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-lg">
              <button
                className="w-full rounded p-2 text-left text-xs hover:bg-neutral-800 disabled:opacity-40"
                disabled={!notes.trim() || !!busy}
                onClick={(event) => {
                  addSlides(notesToDeck(notes), Infinity, "Undo notes import");
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                }}
              >
                Append notes as slides
              </button>
              <button
                className="w-full rounded p-2 text-left text-xs hover:bg-neutral-800 disabled:opacity-40"
                disabled={!!busy}
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  void run(async () => {
                    const images = await onCanvasSnapshot();
                    if (!mounted.current) return;
                    if (!images.length)
                      throw new Error(
                        "Add elements or frames to the canvas first.",
                      );
                    addSlides(
                      images
                        .map(
                          (source, i) =>
                            `## ${images.length > 1 ? `Frame ${i + 1}` : "Canvas"}\n\n![Canvas snapshot](${source})`,
                        )
                        .join("\n\n---\n\n"),
                      Infinity,
                      "Undo canvas import",
                    );
                  });
                }}
              >
                Append canvas / frames
              </button>
            </div>
          </details>
        )}
        <div className="ml-auto flex items-center gap-1">
          <select
            aria-label="Presentation export format"
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs"
            value={exportFormat}
            onChange={(event) =>
              setExportFormat(event.target.value as typeof exportFormat)
            }
          >
            <option value="pdf">
              {deck.kind === "html" ? "PDF · browser print" : "PDF"}
            </option>
            <option value="html">Standalone HTML</option>
            <option value="md">
              {deck.kind === "html" ? "HTML source" : "Markdown"}
            </option>
            <option value="json">Presentation backup</option>
          </select>
          <button data-ui-tone="info"
            className={button}
            disabled={!!busy}
            onClick={() =>
              void run(() => exportDeck(deck, exportFormat, setBusy))
            }
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>
      {commandsOpen && (
        <PresentationCommands
          onClose={() => setCommandsOpen(false)}
          commands={[
            {
              id: "library",
              label: "Open presentation library",
              description:
                "Browse, duplicate, or delete local decks and documents",
              run: onLibrary,
            },
            {
              id: "new",
              label: "New presentation",
              description:
                "Create a fresh Markdown deck without losing this one",
              run: () => onNew("markdown"),
            },
            {
              id: "html",
              label: "New HTML document",
              description: "Create a document with its own styles",
              run: () => onNew("html"),
            },
            {
              id: "organize",
              label: "Organize slides",
              description:
                "Move, duplicate, delete and undo with visual previews",
              run: () => setPlanner("organize"),
            },
            {
              id: "starters",
              label: "Insert a story starter",
              description:
                "Ready-made outlines for a lesson, update, pitch or workshop",
              run: () => setPlanner("starters"),
            },
            {
              id: "themes",
              label: "Choose theme",
              description: "Professional palettes with visual previews",
              run: () => setThemeGallery(true),
            },
            {
              id: "design",
              label: "Design and motion",
              description:
                "Templates, backgrounds, typography, and transitions",
              run: () => setDesignOpen(true),
            },
            {
              id: "guide",
              label: "Writing guide",
              description: "Explore every supported writing command",
              run: () => setHelp(true),
            },
            {
              id: "lint",
              label: "Check slides",
              description:
                "Find incomplete fences, dense content, and image issues",
              run: () => setLintOpen(true),
            },
            ...(deck.kind === "html"
              ? []
              : PRESENTATION_SNIPPETS.map(([label, description, example]) => ({
                  id: label,
                  label,
                  description,
                  run: () => insert(example),
                }))),
          ].filter(
            (command) =>
              deck.kind !== "html" ||
              ![
                "themes",
                "design",
                "guide",
                "lint",
                "organize",
                "starters",
              ].includes(command.id),
          )}
        />
      )}
      <ConfirmDialog
        open={!!imported}
        variant="replace-presentation"
        name={imported?.title}
        onClose={() => setImported(null)}
        onConfirm={() => {
          if (imported) {
            update(imported, imported);
            setGrid(false);
            goToSlide(0, false, parseSlides(imported.source));
          }
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={deck.kind === "html" ? ".html,.htm,.json,text/html,application/json" : ".md,.markdown,.json,text/markdown,application/json"}
        className="hidden"
        aria-label="Import presentation"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void run(async () => {
            const text = await file.text();
            if (!mounted.current) return;
            if (/\.json$/i.test(file.name)) {
              setImported(readDeck(text));
            } else if (draft.current?.kind === "html") {
              if (!/\.html?$/i.test(file.name)) throw new Error("Choose an HTML document or a presentation backup.");
              setImported({ ...draft.current, source: text, allowScripts: false });
            } else {
              if (!/\.(?:md|markdown)$/i.test(file.name)) throw new Error("Choose a Markdown file or a presentation backup.");
              if (!text.trim()) throw new Error("This Markdown file is empty.");
              addSlides(text, Infinity, "Undo Markdown import");
            }
          });
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Add presentation images"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          if (!files.length) return;
          void run(async () => {
            const values = await Promise.all(
              files.map(
                (file) =>
                  new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      resolve(
                        deck.kind === "html"
                          ? `\n<img src="${reader.result}" alt="Uploaded image">\n`
                          : `\n\n![${file.name.replace(/[\[\]\\\n]/g, "")} ](${reader.result})\n`,
                      );
                    reader.onerror = () =>
                      reject(new Error("Could not read this image."));
                    reader.readAsDataURL(file);
                  }),
              ),
            );
            if (mounted.current) insert(values.join(""));
          });
        }}
      />
      {help && deck.kind !== "html" && (
        <PresentationGuide
          deck={deck}
          onClose={() => {
            setHelp(false);
            requestAnimationFrame(() => guideButton.current?.focus());
          }}
          onInsert={(value) => {
            setHelp(false);
            insert(value);
          }}
          onAction={(action) => {
            if (action === "starters" || action === "organize")
              setPlanner(action);
            else if (action === "design") setDesignOpen(true);
            else if (action === "checks") setLintOpen(true);
            else setPresenting(true);
          }}
        />
      )}
      {saveStatus === "failed" && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 text-xs">
          <span>Browser storage is full or unavailable. Export a presentation backup to keep this draft.</span>
          <button className={button} onClick={() => saveAndReport(deck)}>Retry saving</button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-start justify-between gap-2 border-b border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-200"
        >
          {error}
          <button data-ui-tone="neutral"
            aria-label="Dismiss presentation error"
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {projector.following && (
        <button
          className="shrink-0 bg-neutral-500/10 px-3 py-1 text-left text-[10px] text-neutral-300"
          onClick={projector.stopFollowing}
        >
          Following audience · slide {active + 1} · Click to return to editing
        </button>
      )}
      {busy && (
        <div role="status" className="shrink-0 px-3 py-1 text-xs text-neutral-300">
          {busy}
        </div>
      )}
      {lintOpen && (
        <aside
          aria-label="Presentation checks"
          className="max-h-[28dvh] shrink-0 overflow-auto border-b border-neutral-700 bg-neutral-900 px-3 py-2 text-xs"
        >
          <div className="flex justify-between py-1">
            <strong>
              {issues.length
                ? `${issues.length} suggestions`
                : "No issues found"}
            </strong>
            <button data-ui-tone="neutral"
              aria-label="Close presentation checks"
              onClick={() => setLintOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          {issues.map((issue, i) => (
            <button
              key={i}
              className="block w-full rounded px-2 py-2 text-left hover:bg-neutral-800"
              onClick={() => {
                setShowSource(true);
                setNarrowPane("source");
                setIndex(issue.slide - 1);
                const offset = deck.source.split(/(?<=\n)/).slice(0, issue.line - 1).join("").length;
                setTimeout(() => {
                  sourceRef.current?.focus();
                  sourceRef.current?.setSelectionRange(offset, offset);
                }, 0);
              }}
            >
              <span
                className={
                  issue.severity === "error" ? "text-neutral-300" : "text-neutral-200"
                }
              >
                Slide {issue.slide} · Line {issue.line}
              </span>{" "}
              <span className="text-neutral-400">{issue.message}</span>
            </button>
          ))}
        </aside>
      )}
      <div className="presentation-body flex min-h-0 flex-1 max-md:flex-col" data-narrow-pane={narrowPane}>
        {showSource && (
          <div
            style={
              { "--editor-width": `${editorWidth}%` } as React.CSSProperties
            }
            className="presentation-editor flex min-h-0 w-[var(--editor-width)] min-w-0 flex-col max-md:flex-1 max-md:w-full"
          >
            <label
              htmlFor={`deck-source-${boardId}`}
              className="presentation-pane-label"
            >
              <FileCode2 size={14} />
              {deck.kind === "html" ? "HTML source" : "Markdown source"}
            </label>
            <PresentationSource
              kind={deck.kind}
              ref={sourceRef}
              id={`deck-source-${boardId}`}
              aria-label={
                deck.kind === "html"
                  ? "HTML document source"
                  : "Presentation Markdown"
              }
              spellCheck={false}
              value={deck.source}
              onChange={(event) => {
                update({ source: event.target.value });
                setIndex(
                  slideAt(
                    parseSlides(event.target.value),
                    event.target.selectionStart,
                  ),
                );
              }}
              onSelect={(event) => {
                projector.stopFollowing();
                setIndex(slideAt(slides, event.currentTarget.selectionStart));
              }}
              className="min-h-0 flex-1 resize-none bg-white dark:bg-black p-4 font-mono text-[13px] leading-6 text-neutral-200 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
            />
          </div>
        )}
        {showSource && (
          <div
            role="separator"
            aria-label="Resize presentation editor"
            aria-orientation="vertical"
            aria-valuemin={20}
            aria-valuemax={70}
            aria-valuenow={editorWidth}
            tabIndex={0}
            onDoubleClick={() => setEditorWidth(40)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                event.stopPropagation();
                setEditorWidth((value) =>
                  Math.max(
                    20,
                    Math.min(70, value + (event.key === "ArrowRight" ? 2 : -2)),
                  ),
                );
              }
            }}
            onPointerDown={(event) =>
              event.currentTarget.setPointerCapture(event.pointerId)
            }
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const rect =
                event.currentTarget.parentElement!.getBoundingClientRect();
              setEditorWidth(
                Math.max(
                  20,
                  Math.min(
                    70,
                    ((event.clientX - rect.left) / rect.width) * 100,
                  ),
                ),
              );
            }}
            onPointerUp={(event) =>
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            className="hidden w-1 shrink-0 cursor-col-resize bg-neutral-800 hover:bg-neutral-500 focus-visible:bg-neutral-500 md:block"
          />
        )}
        <div className="presentation-preview flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="presentation-preview-bar">
            <div className="min-w-0">
              <span className="presentation-caption">{deck.kind === "html" ? "Document preview" : grid ? "Slide overview" : `Slide ${active + 1} of ${slides.length}`}</span>
              {deck.kind !== "html" && !grid && <p className="truncate text-sm font-semibold">{slides[active].title}</p>}
            </div>
            {deck.kind !== "html" && (
              <div className="presentation-preview-actions">
                <button className={button} aria-label="Previous preview slide" disabled={active === 0} onClick={() => goToSlide(active - 1)}>
                  <ChevronLeft size={15} />
                </button>
                <button className={button} aria-label="Next preview slide" disabled={active === slides.length - 1} onClick={() => goToSlide(active + 1)}>
                  <ChevronRight size={15} />
                </button>
                <button className={button} aria-label="Slide overview" title="Slide overview" aria-pressed={grid} onClick={() => setGrid(!grid)}>
                  <Grid2X2 size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="presentation-stage-wrap min-h-0 flex-1">
            {deck.kind === "html" ? (
              <PresentationHtml
                source={deck.source}
                scripts={deck.allowScripts}
                annotationKey={`${boardId}:html`}
              />
            ) : grid ? (
              <div aria-label="Slide preview grid" className="presentation-overview">
                {slides.map((slide, i) => (
                  <button
                    key={deck.slideIds?.[i] || i}
                    className="presentation-thumbnail"
                    aria-label={`Open slide ${i + 1}: ${slide.title}`}
                    aria-current={i === active ? "step" : undefined}
                    onClick={() => { goToSlide(i); setGrid(false); }}
                  >
                    <div className="presentation-thumb-image" aria-hidden="true">
                      <SlideSurface slide={slide} deck={deck} lazy sharedStyles />
                    </div>
                    <span className="presentation-thumb-label"><b>{i + 1}</b><span>{slide.title}</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <SlideSurface
                key={deck.slideIds?.[active] || active}
                slide={slides[active]}
                deck={deck}
                step={previewStep}
                sharedStyles
                annotationKey={`${boardId}:${deck.slideIds?.[active] || active}`}
              />
            )}
          </div>
          {deck.kind !== "html" && (
            <div className="presentation-preview-footer">
              <details open={projector.following || undefined} className="presentation-speaker-notes">
                <summary>
                  <NotebookPen size={14} aria-hidden="true" />
                  Speaker notes
                  <span className="presentation-caption">Private</span>
                </summary>
                <div className="presentation-notes-content">
                  <label className="block text-xs text-neutral-400">
                    Excluded from audience HTML and PDF.
                    <textarea
                      aria-label="Private speaker notes"
                      value={slides[active].notes}
                      onChange={(event) => update({ source: writeSpeakerNotes(deck.source, active, event.target.value) })}
                      placeholder="What do you want to say on this slide?"
                      rows={3}
                      className="mt-2 block w-full resize-none rounded border border-neutral-700 bg-neutral-950 p-2 text-xs leading-5 text-neutral-200 outline-none focus:border-neutral-500"
                    />
                  </label>
                </div>
              </details>
              {!grid && reveals > 0 && (
                <div className="presentation-reveal" role="group" aria-label="Rehearse reveals">
                  <Layers size={14} aria-hidden="true" />
                  {rehearsing && (
                    <>
                      <span role="status">Reveal {previewStep} / {reveals}</span>
                      <button className={button} aria-label="Previous reveal" disabled={previewStep === 0} onClick={() => setRehearsal({slide: active, step: previewStep - 1})}>
                        <ChevronLeft size={14} />
                      </button>
                      <button className={button} aria-label="Next reveal" disabled={previewStep === reveals} onClick={() => setRehearsal({slide: active, step: previewStep + 1})}>
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                  <button
                    className={button}
                    onClick={() => setRehearsal(rehearsing ? null : { slide: active, step: 0 })}
                  >
                    {rehearsing && <RotateCcw size={13} />}
                    {rehearsing ? "Show all reveals" : "Rehearse reveals"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {deck.kind === "html" ? (
        <div className="presentation-sequence-header border-t border-neutral-800">
          <label className="flex items-center gap-2 py-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={!!deck.allowScripts}
              onChange={(event) => update({ allowScripts: event.target.checked })}
              className="accent-black dark:accent-white"
            />
            Run embedded scripts in an isolated preview
          </label>
          <button type="button" className={`${button} ml-auto`} aria-label="Report bug" title="Report a bug" onClick={onReportBug}>
            <Bug size={13} />
          </button>
        </div>
      ) : (
        <div className="presentation-sequence">
          <div className="presentation-sequence-header">
            <span className="mr-1">Slides <strong>{slides.length}</strong></span>
            <button
              className={button}
              onClick={() => addSlides("## New slide", active, "Undo new slide", true)}
            >
              <Plus size={13} />
              New slide
            </button>
            <button className={button} onClick={() => setPlanner("starters")}>
              Starters
            </button>
            <button className={button} onClick={() => setPlanner("organize")}>
              Organize
            </button>
            <button data-ui-tone="danger"
              className={button}
              aria-label="Delete current slide"
              onClick={() => changeSlide("delete", active)}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete slide</span>
            </button>
            {undoDelete && (
              <button className={button} onClick={undoStructure}>
                <Undo2 size={13} />
                {undoDelete.label || "Undo delete"}
              </button>
            )}
            <button type="button" className={`${button} ml-auto`} aria-expanded={lintOpen} onClick={() => setLintOpen(!lintOpen)}>
              {issues.length ? `Check slides · ${issues.length}` : "Check slides"}
            </button>
            <button type="button" className={button} aria-label="Report bug" title="Report a bug" onClick={onReportBug}>
              <Bug size={13} />
            </button>
          </div>
          <nav ref={filmstrip} aria-label="Presentation slides" className="presentation-filmstrip">
            {slides.map((slide, i) => (
              <button
                key={deck.slideIds?.[i] || i}
                aria-label={`Slide ${i + 1}: ${slide.title}`}
                aria-current={i === active ? "step" : undefined}
                className="presentation-thumbnail"
                onClick={() => goToSlide(i)}
              >
                <div className="presentation-thumb-image" aria-hidden="true">
                  <SlideSurface slide={slide} deck={deck} lazy sharedStyles />
                </div>
                <span className="presentation-thumb-label"><b>{i + 1}</b><span>{slide.title}</span></span>
              </button>
            ))}
          </nav>
        </div>
      )}
      {planner && deck.kind !== "html" && (
        <PresentationPlanner
          mode={planner}
          deck={deck}
          slides={slides}
          active={active}
          onClose={() => setPlanner(null)}
          onSelect={(position) => goToSlide(position)}
          onAction={changeSlide}
          onStarter={(source) => addSlides(source, active, "Undo starter")}
          onUndo={undoDelete ? undoStructure : undefined}
        />
      )}
      <PresentationPresenter
        key={presenting ? "presenting" : "closed"}
        open={presenting}
        deck={deck}
        index={active}
        onIndex={setIndex}
        onClose={stop}
        documentId={boardId}
      />
    </section>
  );
}
