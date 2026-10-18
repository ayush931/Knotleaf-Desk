"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize, Scan } from "lucide-react";
import { Theme } from "@/draw/types";

interface ZoomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToContent: () => void;
  onFitToSelection?: () => void;
  hasSelection?: boolean;
  theme: Theme;
}

export function ZoomBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToContent,
  onFitToSelection,
  hasSelection = false,
}: ZoomBarProps) {
  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-[#27272a] bg-[#18181b]/95 text-neutral-300 shadow-sm shadow-black/10 backdrop-blur-md select-none transition-all"
    >
      <button
        onClick={onZoomOut}
        aria-label="Zoom out" title="Zoom Out (-)"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        onClick={onResetZoom}
        aria-label="Reset zoom" title="Reset Zoom to 100% (0)"
        className="px-2 py-1 text-xs font-mono font-semibold rounded-lg hover:bg-neutral-800/40 transition min-w-[50px] text-center"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        onClick={onZoomIn}
        aria-label="Zoom in" title="Zoom In (+)"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-neutral-700/40 mx-1" />

      {onFitToSelection && <button onClick={onFitToSelection} disabled={!hasSelection} aria-label="Fit selection" aria-keyshortcuts="Shift+2" title="Fit selection · Shift+2" className="rounded-xl p-1.5 text-neutral-400 transition hover:bg-neutral-800/40 hover:text-white disabled:opacity-30"><Scan className="h-4 w-4" /></button>}
      <button
        onClick={onFitToContent}
        aria-label="Fit board" aria-keyshortcuts="Shift+1" title="Fit board · Shift+1"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}
