"use client";
import { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
export interface NoteCommand {
  id: string;
  label: string;
  description: string;
  group: string;
  run: () => void;
}
export function NoteInsertMenu({
  commands,
  query,
  onQuery,
  index,
  onIndex,
  onRun,
  onClose,
  position,
  slash,
  owner,
}: {
  commands: NoteCommand[];
  query: string;
  onQuery: (query: string) => void;
  index: number;
  onIndex: (index: number) => void;
  onRun: (command: NoteCommand) => void;
  onClose: () => void;
  position: { top: number; left: number };
  slash: boolean;
  owner?: HTMLElement;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slash) input.current?.focus();
  }, [slash]);
  useEffect(() => {
    const selected = list.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    selected?.scrollIntoView({ block: "nearest" });
    if (list.current?.contains(document.activeElement)) selected?.focus();
  }, [index]);
  useEffect(() => {
    if (!slash || !owner) return;
    owner.setAttribute("aria-controls", listId);
    owner.setAttribute("aria-haspopup", "listbox");
    if (commands.length)
      owner.setAttribute("aria-activedescendant", `${listId}-${index}`);
    else owner.removeAttribute("aria-activedescendant");
    return () => {
      owner.removeAttribute("aria-controls");
      owner.removeAttribute("aria-haspopup");
      owner.removeAttribute("aria-activedescendant");
    };
  }, [slash, owner, listId, index, commands.length]);
  return (
    <div
      role="region"
      aria-label="Insert note block"
      className="absolute z-50 w-80 max-w-[calc(100%-1rem)] overflow-hidden rounded-xl border border-neutral-700 bg-[#18181b] text-xs shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: "min(360px,calc(100% - 100px))",
      }}
    >
      <div className="flex items-center gap-1 border-b border-neutral-800 p-2">
        {slash ? (
          <span className="min-w-0 flex-1 truncate px-1 text-neutral-400">
            /{query || " · Insert a block"}
          </span>
        ) : (
          <input
            ref={input}
            aria-label="Search note blocks"
            role="combobox"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={
              commands.length ? `${listId}-${index}` : undefined
            }
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search blocks or templates…"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-2"
          />
        )}
        {query && !slash && (
          <button
            type="button"
            aria-label="Clear block search"
            className="note-tool"
            onClick={() => {
              onQuery("");
              input.current?.focus();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          aria-label="Close block menu"
          className="note-tool"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label="Note blocks"
        className="max-h-72 overflow-y-auto p-1.5"
      >
        {commands.length ? (
          commands.map((command, i) => (
            <button
              type="button"
              role="option"
              id={`${listId}-${i}`}
              aria-selected={i === index}
              tabIndex={i === index ? 0 : -1}
              onFocus={() => onIndex(i)}
              key={command.id}
              className={`block w-full rounded-lg px-3 py-2 text-left ${i === index ? "bg-blue-500/15 text-blue-300" : "text-neutral-200 hover:bg-neutral-800"}`}
              onMouseEnter={() => onIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRun(command)}
            >
              <span className="block font-medium">
                {command.label}
                <span className="ml-2 text-[10px] font-normal text-neutral-500">
                  {command.group}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] text-neutral-400">
                {command.description}
              </span>
            </button>
          ))
        ) : (
          <p role="status" className="p-3 text-neutral-400">
            No blocks found. Try “heading”, “table”, or “meeting”.
          </p>
        )}
      </div>
    </div>
  );
}
