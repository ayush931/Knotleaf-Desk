"use client";
import "katex/dist/katex.min.css";
import React, { useEffect, useRef, useState } from "react";
import { FontSelect } from "./FontSelect";
import { themeTypography } from "@/lib/presentations/design";
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
import { SlideSurface } from "./PresentationSlide";
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
          className="flex items-center justify-between bg-red-950 px-3 py-2 text-xs text-red-200"
        >
          {error}
          <button
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
              select(duplicateDeck(value));
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
    [saved, setSaved] = useState(false),
    [index, setIndex] = useState(0),
    [showSource, setShowSource] = useState(true),
    [help, setHelp] = useState(false),
    [themeGallery, setThemeGallery] = useState(false),
    [designOpen, setDesignOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [commandsOpen, setCommandsOpen] = useState(false),
    [grid, setGrid] = useState(false),
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
    pending = useRef<Deck | null>(null);
  const slides = React.useMemo(
    () => parseSlides(deck?.source || ""),
    [deck?.source],
  );
  const active = Math.min(index, slides.length - 1);
  const projector = usePresenterSession(boardId, deck, setIndex);
  const issues = React.useMemo(
    () => (deck?.kind === "html" ? [] : lintPresentation(deck?.source || "")),
    [deck?.source, deck?.kind],
  );
  const [undoDelete, setUndoDelete] = useState<{
    source: string;
    index: number;
  } | null>(null);
  const [imported, setImported] = useState<Deck | null>(null);
  useEffect(() => {
    if (!deck) return;
    pending.current = deck;
    unsavedDecks.set(boardId, deck);
    const timer = setTimeout(() => {
      try {
        writeDeck(boardId, deck);
        if (unsavedDecks.get(boardId) === deck) unsavedDecks.delete(boardId);
        setSaved(true);
      } catch {
        setError(
          "Presentation not saved: browser storage is full or unavailable. Download a presentation backup before leaving.",
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [deck, boardId]);
  useEffect(() => {
    const flush = () => {
      if (pending.current)
        try {
          writeDeck(boardId, pending.current);
          if (unsavedDecks.get(boardId) === pending.current)
            unsavedDecks.delete(boardId);
        } catch {
          /* Keep existing saved data intact when storage fails. */
        }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
    };
  }, [boardId]);
  const update = (next: Partial<Deck>) => {
    setDeck((value) => (value ? { ...value, ...next } : value));
    setSaved(false);
    setError("");
    if (next.source !== undefined) {
      setUndoDelete(null);
      projector.stopFollowing();
    }
  };
  const insert = (value: string) => {
    if (!deck) return;
    const editor = sourceRef.current;
    const start = editor?.selectionStart ?? deck.source.length,
      end = editor?.selectionEnd ?? start;
    update({
      source: deck.source.slice(0, start) + value + deck.source.slice(end),
    });
    setShowSource(true);
    setTimeout(() => {
      sourceRef.current?.focus();
      sourceRef.current?.setSelectionRange(
        start + value.length,
        start + value.length,
      );
    }, 0);
  };
  const run = async (task: () => Promise<void>) => {
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
          <button
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
        if (event.nativeEvent.isComposing) return;
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
          ["arrowleft", "arrowup", "arrowright", "arrowdown"].includes(key)
        ) {
          event.preventDefault();
          const next = Math.max(
            0,
            Math.min(
              active + (key === "arrowleft" || key === "arrowup" ? -1 : 1),
              slides.length - 1,
            ),
          );
          setIndex(next);
          sourceRef.current?.focus();
          sourceRef.current?.setSelectionRange(
            slides[next].start,
            slides[next].start,
          );
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
          insert("\n\n---\n\n## New slide\n\n");
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
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#151517] text-neutral-200 select-text"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <input
          aria-label="Presentation title"
          value={deck.title}
          onChange={(event) => update({ title: event.target.value })}
          className="min-w-0 w-36 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold focus:border-blue-500 focus:outline-none"
        />
        <button className={button} onClick={onLibrary}>
          Library <span className="text-neutral-500">{libraryCount}</span>
        </button>
        <button
          className={button}
          onClick={() => setCommandsOpen(true)}
          title="Presentation commands · Ctrl/Cmd+K"
        >
          Insert
        </button>
        <span role="status" className="mr-auto text-[10px] text-neutral-400">
          {saved
            ? "Saved on this device"
            : error.startsWith("Presentation not saved")
              ? "Not saved"
              : "Saving…"}
        </span>
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
              onChange={(theme) => update({ theme })}
              onClose={() => setThemeGallery(false)}
            />
            <button className={button} onClick={() => setDesignOpen(true)}>
              Design
            </button>
            <PresentationDesign
              open={designOpen}
              deck={deck}
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
              aria-label="Presentation writing guide"
            >
              <CircleHelp size={14} />
              Guide
            </button>
          </>
        )}
        <button
          className={button}
          onClick={() => {
            try {
              writeDeck(boardId, deck);
            } catch {
              /* The live channel can still send the unsaved draft. */
            }
            if (!projector.open(active)) {
              setError(
                "The audience window was blocked. Use Present for the expanded view, or allow pop-ups for this site.",
              );
            }
          }}
        >
          Audience window
        </button>
        <button
          ref={presentButton}
          className={`${button} border-blue-600! bg-blue-600! text-white! hover:bg-blue-500!`}
          onClick={() => {
            setPresenting(true);
          }}
        >
          <Play size={13} />
          Present
        </button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-neutral-800 px-3 py-2">
        {deck.kind !== "html" && (
          <>
            <button
              className={button}
              onClick={() => {
                const source = deck.source + "\n\n---\n\n## New slide\n\n";
                update({ source });
                setIndex(parseSlides(source).length - 1);
                setTimeout(() => {
                  sourceRef.current?.focus();
                  sourceRef.current?.setSelectionRange(
                    source.length,
                    source.length,
                  );
                }, 0);
              }}
            >
              <Plus size={13} />
              Slide
            </button>
            <button
              className={button}
              aria-label="Delete current slide"
              onClick={() => {
                update({ source: removeSlide(deck.source, active) });
                setUndoDelete({ source: deck.source, index: active });
                setIndex(Math.max(0, active - 1));
              }}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete slide</span>
            </button>
            {undoDelete && (
              <button
                className={button}
                onClick={() => {
                  update({ source: undoDelete.source });
                  setIndex(undoDelete.index);
                  setUndoDelete(null);
                }}
              >
                <Undo2 size={13} />
                Undo delete
              </button>
            )}
          </>
        )}
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
          className={button}
          aria-pressed={showSource}
          onClick={() => setShowSource((value) => !value)}
        >
          {showSource
            ? "Hide editor"
            : deck.kind === "html"
              ? "Edit HTML"
              : "Edit Markdown"}
        </button>
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
                  insert("\n\n---\n\n" + notesToDeck(notes));
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
                    if (!images.length)
                      throw new Error(
                        "Add elements or frames to the canvas first.",
                      );
                    insert(
                      images
                        .map(
                          (source, i) =>
                            `\n\n---\n\n## ${images.length > 1 ? `Frame ${i + 1}` : "Canvas"}\n\n![Canvas snapshot](${source})\n`,
                        )
                        .join(""),
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
          <button
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
              !["themes", "design", "guide", "lint"].includes(command.id),
          )}
        />
      )}
      <ConfirmDialog
        open={!!imported}
        variant="replace-presentation"
        name={imported?.title}
        onClose={() => setImported(null)}
        onConfirm={() => {
          if (imported) update(imported);
          setIndex(0);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.json,text/markdown,application/json"
        className="hidden"
        aria-label="Import presentation"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void run(async () => {
            const text = await file.text();
            if (/\.json$/i.test(file.name)) {
              setImported(readDeck(text));
            } else update({ source: deck.source + "\n\n---\n\n" + text });
            setIndex(0);
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
            insert(values.join(""));
          });
        }}
      />
      {help && deck.kind !== "html" && (
        <aside
          aria-label="Presentation writing guide"
          className="max-h-[45dvh] shrink-0 overflow-auto border-b border-neutral-700 bg-neutral-900 p-4 text-xs leading-6 text-neutral-300"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Your guide to writing slides
              </h2>
              <p className="text-neutral-400">
                Click an example to insert it at your cursor. The preview
                updates as you write.
              </p>
            </div>
            <button
              className={button}
              aria-label="Close writing guide"
              onClick={() => setHelp(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PRESENTATION_SNIPPETS.map(([name, description, example]) => (
              <button
                key={name}
                className="rounded-lg border border-neutral-700 bg-[#18181b] p-3 text-left hover:border-blue-500 focus-visible:outline-blue-500"
                onClick={() => insert(example)}
              >
                <strong className="text-blue-300">{name}</strong>
                <p className="leading-5 text-neutral-400">{description}</p>
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-neutral-300">
                  {example.trim()}
                </pre>
              </button>
            ))}
          </div>
          <p className="mt-3 text-neutral-400">
            Present: ← / → and Space to advance; B to blank; L for laser; Esc to
            exit. Delete slide removes the selected slide; Undo delete restores
            it. Markdown imports append slides; a presentation backup asks
            before replacing the deck. Presentations and uploaded images stay on
            this device and are not shared through a room. Export a backup to
            transfer your editable deck; HTML and PDF audience exports exclude
            speaker notes.
          </p>
        </aside>
      )}
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-start justify-between gap-2 border-b border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200"
        >
          {error}
          <button
            aria-label="Dismiss presentation error"
            onClick={() => setError("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {projector.following && (
        <button
          className="shrink-0 bg-blue-500/10 px-3 py-1 text-left text-[10px] text-blue-300"
          onClick={projector.stopFollowing}
        >
          Following audience · slide {active + 1} · Click to return to editing
        </button>
      )}
      {busy && (
        <div role="status" className="shrink-0 px-3 py-1 text-xs text-blue-300">
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
            <button
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
                setIndex(issue.slide - 1);
                const offset = deck.source
                  .split("\n")
                  .slice(0, issue.line - 1)
                  .join("\n").length;
                setTimeout(() => {
                  sourceRef.current?.focus();
                  sourceRef.current?.setSelectionRange(offset, offset);
                }, 0);
              }}
            >
              <span
                className={
                  issue.severity === "error" ? "text-red-300" : "text-amber-200"
                }
              >
                Slide {issue.slide} · Line {issue.line}
              </span>{" "}
              <span className="text-neutral-400">{issue.message}</span>
            </button>
          ))}
        </aside>
      )}
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        {showSource && (
          <div
            style={
              { "--editor-width": `${editorWidth}%` } as React.CSSProperties
            }
            className="flex min-h-0 w-[var(--editor-width)] min-w-0 flex-col border-r border-neutral-800 max-md:h-[40%] max-md:w-full max-md:border-b"
          >
            <label
              htmlFor={`deck-source-${boardId}`}
              className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500"
            >
              {deck.kind === "html"
                ? "HTML document · own styling"
                : `Markdown · ${slides.length} slides`}
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
              className="min-h-0 flex-1 resize-none bg-[#18181b] p-4 font-mono text-[13px] leading-6 text-neutral-200 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500"
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
            className="hidden w-1 shrink-0 cursor-col-resize bg-neutral-800 hover:bg-blue-500 focus-visible:bg-blue-500 md:block"
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-3">
            {deck.kind === "html" ? (
              <PresentationHtml
                source={deck.source}
                scripts={deck.allowScripts}
                annotationKey={`${boardId}:html`}
              />
            ) : grid ? (
              <div
                aria-label="Slide preview grid"
                className="grid h-full grid-cols-2 content-start gap-3 overflow-auto"
              >
                {slides.map((slide, i) => (
                  <button
                    key={`${i}:${slide.start}`}
                    className={`overflow-hidden rounded border ${i === active ? "border-blue-500" : "border-neutral-700"}`}
                    onClick={() => {
                      setIndex(i);
                      setGrid(false);
                    }}
                  >
                    <div className="pointer-events-none aspect-video">
                      <SlideSurface slide={slide} deck={deck} lazy />
                    </div>
                    <span className="block truncate p-1.5 text-left text-[10px] text-neutral-400">
                      {i + 1} · {slide.title}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <SlideSurface
                slide={slides[active]}
                deck={deck}
                annotationKey={`${boardId}:${active}`}
              />
            )}
          </div>
          {deck.kind !== "html" && (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2">
                <button
                  className={button}
                  aria-label="Previous preview slide"
                  disabled={active === 0}
                  onClick={() => setIndex(Math.max(0, active - 1))}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="truncate text-xs text-neutral-400">
                  {active + 1} / {slides.length} · {slides[active].title}
                </span>
                <button
                  className={button}
                  aria-label="Next preview slide"
                  disabled={active === slides.length - 1}
                  onClick={() =>
                    setIndex(Math.min(slides.length - 1, active + 1))
                  }
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <details
                open={projector.following || undefined}
                className="mx-3 mb-2 rounded border border-neutral-800 px-3 py-2 text-xs"
              >
                <summary className="cursor-pointer text-neutral-400">
                  Speaker notes · private{" "}
                  {projector.following ? "· following audience" : ""}
                </summary>
                <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-neutral-300">
                  {slides[active].notes ||
                    "Add <!-- notes: Your reminder --> to this slide."}
                </p>
              </details>
            </>
          )}
        </div>
      </div>
      {deck.kind === "html" && (
        <label className="flex shrink-0 items-center gap-2 border-t border-neutral-800 px-3 py-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={!!deck.allowScripts}
            onChange={(event) => update({ allowScripts: event.target.checked })}
            className="accent-blue-500"
          />
          Run embedded scripts in an isolated preview{" "}
          <span className="text-neutral-500">
            · Documents cannot access your boards or library.
          </span>
        </label>
      )}
      <div
        className={`flex shrink-0 items-center justify-end gap-2 border-t border-neutral-800 py-1 text-[10px] text-neutral-500 ${deck.kind === "html" ? "h-12 pl-28 pr-3" : "px-3"}`}
      >
        {deck.kind !== "html" && (
          <>
            <button
              onClick={() => setGrid((value) => !value)}
              className="rounded px-2 py-1 hover:bg-neutral-800"
            >
              {grid ? "Single slide" : "Grid preview"}
            </button>
            <button
              onClick={() => setLintOpen((value) => !value)}
              className="rounded px-2 py-1 hover:bg-neutral-800"
            >
              {issues.length ? `${issues.length} checks` : "Slides checked"}
            </button>
          </>
        )}
        <span>
          {deck.kind === "html"
            ? `${deck.source.length.toLocaleString()} characters`
            : `${deck.source.trim() ? deck.source.trim().split(/\s+/).length : 0} words`}
        </span>
      </div>
      {deck.kind !== "html" && (
        <nav
          aria-label="Presentation slides"
          className="flex h-16 shrink-0 items-center gap-2 overflow-x-auto border-t border-neutral-800 pl-28 pr-3 py-2"
        >
          {slides.map((slide, i) => (
            <button
              key={`${i}:${slide.start}`}
              aria-label={`Slide ${i + 1}: ${slide.title}`}
              aria-current={i === active ? "step" : undefined}
              onClick={() => setIndex(i)}
              className={`h-full w-36 shrink-0 truncate rounded border px-3 text-left text-xs ${active === i ? "border-blue-500 bg-blue-500/10 text-blue-200" : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"}`}
            >
              <span className="mr-2 text-neutral-500">{i + 1}</span>
              {slide.title}
            </button>
          ))}
        </nav>
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
