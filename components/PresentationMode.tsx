"use client";

import React from "react";
import { X, Play } from "lucide-react";
import { Theme } from "@/draw/types";

interface PresentationModeProps {
  isActive: boolean;
  onExit: () => void;
  title: string;
  theme: Theme;
}

export function PresentationMode({
  isActive,
  onExit,
  title,
}: PresentationModeProps) {
  if (!isActive) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 animate-fade-in">
      <div
        className="px-4 py-2 rounded-2xl border border-[#27272a] bg-[#18181b]/95 text-white shadow-2xl backdrop-blur-md flex items-center gap-3"
      >
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
          <span className="text-xs font-semibold">{title}</span>
          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Zen Mode
          </span>
        </div>

        <button
          onClick={onExit}
          className="p-1 rounded-lg hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
          title="Exit Presentation (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
