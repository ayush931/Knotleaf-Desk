"use client";

import React from "react";
import { BringToFront, Copy, Palette, SendToBack, Trash2 } from "lucide-react";
import type { CanvasElement } from "@/draw/types";
import { PREMIUM_STROKES } from "@/lib/premiumPalette";

const QUICK_COLORS = PREMIUM_STROKES.slice(0, 6);

interface SelectionActionBarProps {
  selection: CanvasElement[];
  onColor: (color: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onOpenAppearance: () => void;
}

const actionClass = "selection-action flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]";

/** A compact, always-reachable command bar for the current selection. */
export function SelectionActionBar({
  selection,
  onColor,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onOpenAppearance,
}: SelectionActionBarProps) {
  if (!selection.length) return null;
  const firstColor = selection[0].type === "icon" ? selection[0].iconColor : selection[0].stroke;
  const uniformColor = selection.every(element => {
    const color = element.type === "icon" ? element.iconColor : element.stroke;
    return !!color && !!firstColor && color.toLowerCase() === firstColor.toLowerCase();
  });

  return (
    <div
      role="toolbar"
      aria-label="Selection action bar"
      className="selection-action-bar absolute bottom-3 left-1/2 z-40 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-xl border drawing-panel px-1.5 py-1.5 text-neutral-700 shadow-sm max-sm:bottom-[4.25rem] dark:text-neutral-200"
    >
      <span className="selection-count" aria-label={`${selection.length} selected`}>
        {selection.length === 1 ? "1 selected" : `${selection.length} selected`}
      </span>
      <span aria-hidden="true" className="selection-divider" />
      <div role="group" aria-label="Selection colors" className="flex items-center gap-1">
        {QUICK_COLORS.map(choice => {
          const active = uniformColor && firstColor?.toLowerCase() === choice.value.toLowerCase();
          return (
            <button
              key={choice.value}
              type="button"
              aria-label={`Selection color ${choice.name}`}
              aria-pressed={!!active}
              title={`${choice.name} · apply to selection`}
              onClick={() => onColor(choice.value)}
              className={`selection-swatch ${active ? "is-active" : ""}`}
              style={{ backgroundColor: choice.value }}
            >
              <span aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span aria-hidden="true" className="selection-divider" />
      <button type="button" aria-label="Duplicate selected objects" title="Duplicate · Ctrl/Cmd+D" onClick={onDuplicate} className={actionClass}>
        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="selection-action-label">Duplicate</span>
      </button>
      <button type="button" aria-label="Bring selection to front" title="Bring to front · ]" onClick={onBringToFront} className={actionClass}>
        <BringToFront aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Send selection to back" title="Send to back · [" onClick={onSendToBack} className={actionClass}>
        <SendToBack aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Customize selection" title="Open Appearance" onClick={onOpenAppearance} className={actionClass}>
        <Palette aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="selection-action-label">Style</span>
      </button>
      <span aria-hidden="true" className="selection-divider" />
      <button type="button" aria-label="Delete selected objects" title="Delete · Del" onClick={onDelete} className={`${actionClass} selection-delete`}>
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
