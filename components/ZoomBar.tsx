"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Theme } from "@/draw/types";

interface ZoomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToContent: () => void;
  theme: Theme;
}

export function ZoomBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToContent,
}: ZoomBarProps) {
  return (
    <div
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-[#27272a] bg-[#18181b]/95 text-neutral-300 shadow-xl backdrop-blur-md select-none transition-all"
    >
      <button
        onClick={onZoomOut}
        title="Zoom Out (-)"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        onClick={onResetZoom}
        title="Reset Zoom to 100% (0)"
        className="px-2 py-1 text-xs font-mono font-semibold rounded-lg hover:bg-neutral-800/40 transition min-w-[50px] text-center"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        onClick={onZoomIn}
        title="Zoom In (+)"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-neutral-700/40 mx-1" />

      <button
        onClick={onFitToContent}
        title="Fit to Content"
        className="p-1.5 rounded-xl hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}
