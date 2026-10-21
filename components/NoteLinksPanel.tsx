"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Link2, Plus, X } from "lucide-react";
import { linkedNoteIds, type NotePage } from "@/lib/notesDocument";
export function NoteLinksPanel({
  noteId,
  value,
  pages,
  onInsert,
  onOpen,
  onCreate,
  onClose,
}: {
  noteId?: string;
  value: string;
  pages: NotePage[];
  onInsert: (page: NotePage) => void;
  onOpen?: (id: string) => boolean;
  onCreate?: (title: string) => NotePage;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [title, setTitle] = useState(""),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const available = pages.filter(
    (p) =>
      p.id !== noteId && p.title.toLowerCase().includes(query.toLowerCase()),
  );
  const outgoing = linkedNoteIds(value),
    backlinks = noteId
      ? pages.filter(
          (p) =>
            p.id !== noteId && linkedNoteIds(p.markdownNotes).includes(noteId),
        )
      : [];
  const open = (id: string) => {
    if (!onOpen?.(id)) setError("This note is unavailable on this device.");
  };
  return (
    <aside
      role="region"
      aria-label="Note links and backlinks"
      className="absolute left-2 top-24 z-40 w-80 max-w-[calc(100%-1rem)] overflow-y-auto rounded-xl border border-neutral-700 bg-[#18181b] p-3 text-xs shadow-lg"
      style={{ maxHeight: "calc(100% - 110px)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Note links</h3>
        <button
          type="button"
          aria-label="Close note links"
          className="note-tool"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 leading-5 text-neutral-400">
        Link notes in this workspace on this device. Ctrl/Cmd+click a link in
        your writing to open it.
      </p>
      <div className="mb-2 flex items-center gap-1">
        <input
          ref={input}
          aria-label="Search notes to link"
          placeholder="Find a note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-2"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear note link search"
            className="note-tool"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mb-4 max-h-44 space-y-1 overflow-auto">
        {available.length ? (
          available.map((page) => (
            <div key={page.id} className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Link note ${page.title}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-2 text-left hover:bg-neutral-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(page)}
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{page.title}</span>
              </button>
              <button
                type="button"
                aria-label={`Open note ${page.title}`}
                title="Open note"
                className="note-tool"
                onClick={() => open(page.id)}
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p role="status" className="py-2 text-neutral-500">
            {query
              ? "No matching notes."
              : "Create another note to link your ideas."}
          </p>
        )}
      </div>
      {onCreate && (
        <form
          noValidate
          className="mb-4 space-y-2 border-t border-neutral-800 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const name = title.trim();
            if (!name) {
              setError("Name the new note first.");
              return;
            }
            try {
              const page = onCreate(name);
              onInsert(page);
            } catch {
              setError(
                "Could not save the new note. Check browser storage and try again.",
              );
            }
          }}
        >
          <label htmlFor="linked-note-title" className="block text-neutral-400">
            New linked note
          </label>
          <div className="flex gap-1">
            <input
              id="linked-note-title"
              aria-invalid={!!error}
              aria-describedby={error ? "note-linking-error" : undefined}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              placeholder="Note title"
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-2"
            />
            <button
              type="submit"
              title="Create and link note"
              aria-label="Create and link note"
              className="rounded bg-blue-600 px-2 text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
      <section className="border-t border-neutral-800 py-3">
        <h4 className="mb-1 font-medium">
          Links from this note{" "}
          <span className="text-neutral-500">{outgoing.length}</span>
        </h4>
        {outgoing.length ? (
          outgoing.map((id) => {
            const page = pages.find((p) => p.id === id);
            return page ? (
              <button
                type="button"
                key={id}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-blue-400 hover:bg-neutral-800"
                onClick={() => open(id)}
              >
                {page.title}
              </button>
            ) : (
              <p key={id} className="px-2 py-1.5 text-neutral-500">
                Unavailable on this device
              </p>
            );
          })
        ) : (
          <p className="text-neutral-500">No linked notes yet.</p>
        )}
      </section>
      <section className="border-t border-neutral-800 pt-3">
        <h4 className="mb-1 font-medium">
          Backlinks <span className="text-neutral-500">{backlinks.length}</span>
        </h4>
        {backlinks.length ? (
          backlinks.map((page) => (
            <button
              key={page.id}
              type="button"
              className="block w-full truncate rounded px-2 py-1.5 text-left text-blue-400 hover:bg-neutral-800"
              onClick={() => open(page.id)}
            >
              {page.title}
            </button>
          ))
        ) : (
          <p className="leading-5 text-neutral-500">
            Notes that link here will appear here.
          </p>
        )}
      </section>
      {error && (
        <p id="note-linking-error" role="alert" className="mt-3 text-rose-400">
          {error}
        </p>
      )}
    </aside>
  );
}
