"use client";

import React from "react";
import { Copy, Minus, Palette, Trash2 } from "lucide-react";
import { PREMIUM_STROKES } from "@/lib/premiumPalette";

export function SelectionToolbar({
  left, top, placement = "above", selectionCount, activeStroke, strokeWidth, onColor, onStrokeWidth, onDuplicate, onDelete, onOpenAppearance,
}: {
  left: number;
  top: number;
  placement?: "above" | "below";
  selectionCount: number;
  activeStroke: string;
  strokeWidth: number;
  onColor: (color: string) => void;
  onStrokeWidth: (width: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenAppearance: () => void;
}) {
  return <div
    role="toolbar"
    aria-label="Selection quick actions"
    data-selection-toolbar="true"
    onPointerDown={event => event.stopPropagation()}
    className={`selection-toolbar absolute z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border p-1 text-neutral-700 shadow-lg dark:text-neutral-200 ${placement === "above" ? "-translate-y-full" : ""}`}
    style={{ left, top }}
  >
    <span className="selection-count hidden items-center rounded-lg px-1.5 text-[10px] font-semibold tabular-nums text-neutral-500 sm:flex">{selectionCount > 1 ? `${selectionCount}×` : "1×"}</span>
    <div role="group" aria-label="Selection colors" className="flex items-center gap-1">
      {PREMIUM_STROKES.slice(0, 5).map(choice => {
        const selected = activeStroke.toLowerCase() === choice.value.toLowerCase();
        return <button
          key={choice.value}
          type="button"
          onMouseDown={event => event.preventDefault()}
          onClick={() => onColor(choice.value)}
          aria-label={`Selection color ${choice.name}`}
          aria-pressed={selected}
          title={choice.name}
          className={`selection-swatch h-5 w-5 rounded-full border transition ${selected ? "is-selected scale-110" : "border-white/30 hover:scale-110"}`}
          style={{ backgroundColor: choice.value }}
        />;
      })}
    </div>
    <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
    <div role="group" aria-label="Stroke width" className="flex items-center gap-0.5">
      {[1, 2, 4].map(width => <button
        key={width}
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => onStrokeWidth(width)}
        aria-label={`Stroke width ${width}`}
        aria-pressed={strokeWidth === width}
        title={`${width}px stroke`}
        className={`flex h-6 w-6 items-center justify-center rounded-md ${strokeWidth === width ? "is-active" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
      ><Minus aria-hidden="true" className="h-3.5 w-3.5" style={{ strokeWidth: width === 4 ? 2.4 : width === 2 ? 1.7 : 1.1 }} /></button>)}
    </div>
    <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
    <button type="button" onMouseDown={event => event.preventDefault()} onClick={onOpenAppearance} aria-label="Style selection" title="Open appearance" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"><Palette aria-hidden="true" className="h-3.5 w-3.5" /></button>
    <button type="button" onMouseDown={event => event.preventDefault()} onClick={onDuplicate} aria-label="Duplicate selection from quick actions" title="Duplicate · Ctrl/Cmd+D" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"><Copy aria-hidden="true" className="h-3.5 w-3.5" /></button>
    <button type="button" onMouseDown={event => event.preventDefault()} onClick={onDelete} aria-label="Delete selection from quick actions" title="Delete · Del" className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
  </div>;
}
