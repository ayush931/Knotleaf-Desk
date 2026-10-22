"use client";
import { useEffect, useRef, useState, useId } from "react";
import { Search, X } from "lucide-react";
export interface PresentationCommand {
  id: string;
  label: string;
  description: string;
  run: () => void;
}
export function PresentationCommands({
  commands,
  onClose,
}: {
  commands: PresentationCommand[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    title = useId();
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const list = commands.filter((command) =>
    `${command.label} ${command.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const active = Math.min(index, Math.max(0, list.length - 1));
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={title}
      onCancel={onClose}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setIndex((value) => Math.min(value + 1, list.length - 1));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setIndex((value) => Math.max(0, value - 1));
        } else if (event.key === "Enter" && list[active]) {
          event.preventDefault();
          list[active].run();
          onClose();
        }
      }}
      className="mx-auto mt-[12dvh] w-[min(600px,94vw)] overflow-hidden rounded-xl border border-neutral-700 bg-[#18181b] p-0 text-neutral-200 backdrop:bg-black/70"
    >
      <h2 id={title} className="sr-only">
        Presentation commands
      </h2>
      <div className="flex items-center gap-2 border-b border-neutral-700 p-3">
        <Search size={17} className="text-neutral-500" />
        <input
          autoFocus
          aria-label="Search presentation commands"
          placeholder="Search actions, layouts, or writing examples…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          aria-label="Close presentation commands"
          onClick={onClose}
          className="rounded p-1 hover:bg-neutral-800"
        >
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[55dvh] overflow-auto p-2">
        {list.length ? (
          list.map((command, i) => (
            <button
              key={command.id}
              aria-current={i === active ? "true" : undefined}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                command.run();
                onClose();
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left ${i === active ? "bg-blue-500/10 text-blue-200" : "hover:bg-neutral-800"}`}
            >
              <strong className="text-sm font-medium">{command.label}</strong>
              <span className="mt-0.5 block text-xs text-neutral-400">
                {command.description}
              </span>
            </button>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-neutral-400">
            No matching commands.
          </p>
        )}
      </div>
      <p className="border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-500">
        ↑ ↓ to choose · Enter to run · Esc to close
      </p>
    </dialog>
  );
}
