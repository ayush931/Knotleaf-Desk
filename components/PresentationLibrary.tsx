"use client";
import { useEffect, useRef, useId, useState } from "react";
import {
  X,
  Plus,
  Copy,
  Trash2,
  FileText,
  Presentation,
  Search,
} from "lucide-react";
import type { DeckSummary } from "@/lib/presentations/library";
import { ConfirmDialog } from "./ConfirmDialog";
export function PresentationLibrary({
  items,
  currentId,
  onClose,
  onOpen,
  onCreate,
  onDuplicate,
  onDelete,
}: {
  items: DeckSummary[];
  currentId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: (kind: "markdown" | "html") => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    title = useId();
  const [query, setQuery] = useState(""),
    [deleting, setDeleting] = useState<DeckSummary | null>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={title}
        onCancel={onClose}
        onClose={onClose}
        className="m-auto max-h-[88dvh] w-[min(700px,94vw)] overflow-auto rounded-xl border border-neutral-700 bg-[#18181b] p-5 text-neutral-200 backdrop:bg-black/70"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id={title} className="font-semibold">
              Presentation library
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Your decks and HTML documents, saved on this device.
            </p>
          </div>
          <button
            autoFocus
            aria-label="Close presentation library"
            onClick={onClose}
            className="rounded p-2 hover:bg-neutral-800"
          >
            <X size={17} />
          </button>
        </header>
        <div className="my-4 flex flex-wrap gap-2">
          <button
            onClick={() => onCreate("markdown")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500"
          >
            <Plus size={14} />
            New presentation
          </button>
          <button
            onClick={() => onCreate("html")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs hover:bg-neutral-800"
          >
            <FileText size={14} />
            New HTML document
          </button>
          <label className="ml-auto flex min-w-0 items-center gap-2 rounded-lg border border-neutral-700 px-2 py-1">
            <Search size={14} className="text-neutral-500" />
            <input
              aria-label="Search presentation library"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search library"
              className="min-w-0 max-w-40 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <div className="divide-y divide-neutral-800">
          {items
            .filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${item.id === currentId ? "bg-blue-500/5" : ""}`}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 rounded p-1 text-left hover:bg-neutral-800"
                  onClick={() => onOpen(item.id)}
                >
                  {item.kind === "html" ? (
                    <FileText size={18} className="shrink-0 text-neutral-500" />
                  ) : (
                    <Presentation
                      size={18}
                      className="shrink-0 text-blue-300"
                    />
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-medium">
                      {item.title}
                    </strong>
                    <span className="text-[10px] text-neutral-500">
                      {item.kind === "html" ? "HTML document" : "Markdown deck"}{" "}
                      · {new Date(item.updatedAt).toLocaleDateString()}{" "}
                      {item.id === currentId ? "· Open" : ""}
                    </span>
                  </span>
                </button>
                <button
                  aria-label={`Duplicate ${item.title}`}
                  onClick={() => onDuplicate(item.id)}
                  className="rounded p-2 text-neutral-400 hover:bg-neutral-800"
                >
                  <Copy size={15} />
                </button>
                <button
                  aria-label={`Delete ${item.title}`}
                  onClick={() => setDeleting(item)}
                  className="rounded p-2 text-neutral-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
        {!items.length && (
          <p className="py-8 text-center text-sm text-neutral-400">
            Create a presentation or import a document to start your library.
          </p>
        )}
      </dialog>
      <ConfirmDialog
        open={!!deleting}
        variant="delete-presentation"
        name={deleting?.title}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete(deleting.id);
        }}
      />
    </>
  );
}
