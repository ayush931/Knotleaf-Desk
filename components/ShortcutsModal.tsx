"use client";

import React from "react";
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
      ["V", "Select"],
      ["H / Space+drag", "Pan"],
      ["R", "Rectangle"],
      ["D", "Diamond"],
      ["O", "Ellipse"],
      ["A", "Arrow (snaps to shape ports)"],
      ["L", "Line"],
      ["P", "Draw"],
      ["T", "Text"],
      ["C", "Code card (inline editor)"],
      ["N", "Doc Card (rich formatted note)"],
      ["S", "Sticky note"],
      ["F", "Frame"],
      ["E", "Eraser"],
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
    ],
  },
  {
    title: "Canvas & Document",
    items: [
      ["Double-click", "Write here; edit existing text"],
      ["Alt+drag", "Move without alignment snapping"],
      ["Click Checkbox", "Toggle checklist directly on canvas"],
      ["Enter", "Continue list / checklist bullet"],
      ["Tab / Shift+Tab", "Indent / outdent list item"],
      ["Ctrl/Cmd+B / I / U", "Bold / italic / underline text"],
      ["Ctrl/Cmd+Shift+X", "Strikethrough text"],
      ["Ctrl+Shift+> / <", "Increase / decrease font size"],
      ["Ctrl+Enter or Esc", "Finish editing"],
    ],
  },
  {
    title: "View",
    items: [
      ["Ctrl + scroll / pinch", "Zoom"],
      ["+ / - / 0", "Zoom in / out / reset"],
      ["Shift+1", "Fit to content"],
      ["?", "Show this sheet"],
      ["Left / Right in presentation", "Previous / next frame"],
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 shadow-2xl p-6 bg-[#18181b] text-white"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg opacity-60 hover:opacity-100">
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
                    <kbd className="shrink-0 px-2 py-0.5 rounded border border-neutral-700 bg-neutral-800 text-[11px] font-mono text-neutral-300">{keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
