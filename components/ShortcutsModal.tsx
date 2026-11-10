"use client";

import React, { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { Theme } from "@/draw/types";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Tools",
    items: [
      ["Shift+Z", "Focus canvas / show controls"],
      ["V", "Select"],
      ["H / Space+drag", "Pan"],
      ["R", "Rectangle"],
      ["D", "Diamond"],
      ["O", "Ellipse"],
      ["A", "Arrow (snaps to shape ports)"],
      ["L", "Line"],
      ["P", "Draw"],
      ["J", "Highlighter (red, disappears after 0.2 seconds)"],
      ["T", "Text · click to type or drag a writing area"],
      ["C", "Code card (inline editor)"],
      ["N", "Doc Card (rich formatted note)"],
      ["S", "Sticky note"],
      ["F", "Frame"],
      ["E", "Eraser"],
      ["K", "Pick object color"],
      ["I", "Insert icon"],
      ["Esc", "Back to select"],
    ],
  },
  {
    title: "Edit",
    items: [
      ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo"],
      ["Ctrl+C / Ctrl+X / Ctrl+V", "Copy / cut / paste"],
      ["Ctrl+D", "Duplicate"],
      ["Ctrl+A", "Select all"],
      ["Ctrl/Cmd+F", "Find on board and in notes"],
      ["Delete / Backspace", "Delete selection"],
      ["Arrow keys", "Nudge (Shift = 10px)"],
      ["Ctrl+] / Ctrl+[", "Bring to front / send to back"],
      ["Shift+drag", "Add to selection; constrain shape or line"],
      ["Click, move, click", "Draw a shape, line or arrow without holding the button · Esc finishes"],
    ],
  },
  {
    title: "Canvas & Document",
    items: [
      ["Double-click shape border", "Select and resize"],
      ["Double-click blank space", "Write here in Select mode"],
      ["Double-click inside shape", "Write inside; Alt also works"],
      ["Drag center diamond", "Bend selected line or arrow"],
      ["Alt+drag", "Duplicate selection while dragging"],
      ["Click Checkbox", "Toggle checklist directly on canvas"],
      ["Enter", "Continue list / checklist bullet"],
      ["Tab / Shift+Tab", "Indent / outdent list item"],
      ["Ctrl/Cmd+B / I / U", "Bold / italic / underline text"],
      ["Ctrl/Cmd+Shift+X", "Strikethrough text"],
      ["Ctrl/Cmd+F or H in notes", "Find and replace notes"],
      ["F3 / Shift+F3 in notes", "Next / previous note match"],
      ["Cmd/Ctrl+Shift+> / <", "Increase / decrease font size (period / comma)"],
      ["Ctrl+Enter or Esc", "Finish editing"],
    ],
  },
  {
    title: "View",
    items: [
      ["Ctrl + scroll / pinch", "Zoom"],
      ["+ / - / 0", "Zoom in / out / reset"],
      ["Shift+1", "Fit board"],
      ["Shift+2", "Fit selection"],
      ["?", "Show this sheet"],
      ["Left / Right in presentation", "Previous / next frame"],
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose, theme }: ShortcutsModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <dialog ref={dialog} onCancel={onClose} aria-label="Keyboard shortcuts" className={`m-auto w-[min(768px,94vw)] max-h-[85dvh] overflow-y-auto rounded-2xl border p-6 shadow-2xl backdrop:bg-black/60 ${theme === "light" ? "border-neutral-200 bg-white text-neutral-900" : "border-neutral-800 bg-[#18181b] text-white"}`}>
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close keyboard shortcuts" className="p-1.5 rounded-lg opacity-60 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-50 mb-2">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.items.map(([keys, label]) => (
                  <li key={keys} className="flex items-center justify-between gap-3 text-sm">
                    <span className="opacity-80">{label}</span>
                    <kbd className={`shrink-0 max-w-[48%] px-2 py-0.5 rounded border text-[11px] font-mono ${theme === "light" ? "border-neutral-300 bg-neutral-100 text-neutral-700" : "border-neutral-700 bg-neutral-800 text-neutral-300"}`}>{keys.replace(/Ctrl(?!\/Cmd)/g, "Ctrl/Cmd")}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
