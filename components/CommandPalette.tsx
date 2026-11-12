"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CommandTone = "iris" | "aqua" | "coral" | "amber" | "jade" | "blue" | "neutral";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  description?: string;
  shortcut?: string;
  keywords?: string;
  icon: LucideIcon;
  tone?: CommandTone;
  run: () => void;
}

const TONES: Record<CommandTone, string> = {
  iris: "#A78BFA",
  aqua: "#22D3EE",
  coral: "#FB7185",
  amber: "#FBBF24",
  jade: "#34D399",
  blue: "#60A5FA",
  neutral: "#94A3B8",
};

const GROUP_ORDER = ["Tools", "Actions", "Canvas", "Color", "Theme", "Go"];

export function CommandPalette({ onClose, commands, title = "Quick actions" }: {
  onClose: () => void;
  commands: readonly PaletteCommand[];
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const previous = document.activeElement, node = dialog.current;
    node?.showModal();
    input.current?.focus({ preventScroll: true });
    return () => {
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? commands.filter(command => `${command.label} ${command.group} ${command.description || ""} ${command.keywords || ""}`.toLowerCase().includes(term))
      : commands;
    return [...matches].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.label.localeCompare(b.label));
  }, [commands, query]);

  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));

  useEffect(() => {
    const node = list.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, query]);

  const select = (command: PaletteCommand | undefined) => {
    if (!command) return;
    onClose();
    dialog.current?.close();
    requestAnimationFrame(() => command.run());
  };

  return (
    <dialog
      ref={dialog}
      data-command-palette="true"
      aria-label="Command palette"
      className="command-frame mx-auto mt-[max(10vh,64px)] w-[min(620px,calc(100%-24px))] max-h-[80dvh] overflow-hidden rounded-2xl p-0"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      } }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.target !== input.current) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!filtered.length) return;
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setActive((activeIndex + direction + filtered.length) % filtered.length);
        } else if (event.key === "Enter") {
          event.preventDefault();
          select(filtered[activeIndex]);
        }
      }}
    >
        <div className="command-panel flex max-h-[min(70dvh,560px)] flex-col">
          <div className="command-search flex items-center gap-3 border-b px-4">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              ref={input}
              value={query}
              onChange={event => { setQuery(event.target.value); setActive(0); }}
              aria-label="Search commands"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls="command-palette-results"
              aria-activedescendant={filtered.length ? `command-${filtered[activeIndex].id}` : undefined}
              placeholder="Search tools, actions and themes…"
              autoComplete="off"
              spellCheck={false}
              className="command-search-input h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
            {query && <button type="button" onClick={() => { setQuery(""); setActive(0); input.current?.focus(); }} aria-label="Clear command search" className="command-close flex h-7 w-7 shrink-0 items-center justify-center rounded-md"><X aria-hidden="true" className="h-3.5 w-3.5" /></button>}
            <span className="flex shrink-0 items-center gap-1.5">
              <kbd className="command-key hidden sm:inline-flex">ESC</kbd>
              <button type="button" onClick={onClose} aria-label="Close command palette" className="command-close flex h-7 w-7 items-center justify-center rounded-md">
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <div ref={list} id="command-palette-results" role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200">No matching actions</p>
                <p className="mt-1 text-xs text-neutral-500">Try “sticky”, “theme”, “fit” or a tool name.</p>
              </div>
            )}
            {filtered.map((command, index) => {
              const Icon = command.icon;
              const showGroup = command.group !== filtered[index - 1]?.group;
              const tone = TONES[command.tone || "neutral"];
              return (
                <React.Fragment key={command.id}>
                  {showGroup && <p className="command-group px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em]">{command.group}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    id={`command-${command.id}`}
                    tabIndex={-1}
                    data-command-index={index}
                    data-command-id={command.id}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(command)}
                    className={`command-row flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${index === activeIndex ? "is-active" : ""}`}
                  >
                    <span className="command-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ "--command-tone": tone } as React.CSSProperties}>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{command.label}</span>
                      {command.description && <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{command.description}</span>}
                    </span>
                    {command.shortcut && <kbd className="command-key hidden shrink-0 sm:inline-flex">{command.shortcut}</kbd>}
                    {index === activeIndex && <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-500" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <footer className="command-footer flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2.5 text-[10px] text-neutral-500">
            <span className="flex items-center gap-2"><kbd className="command-key">↑</kbd><kbd className="command-key">↓</kbd> to move <kbd className="command-key">↵</kbd> to run</span>
            <span className="flex items-center gap-1.5"><span className="command-dot" />Knotleaf command</span>
          </footer>
        </div>
    </dialog>
  );
}
