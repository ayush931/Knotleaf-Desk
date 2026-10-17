"use client";

import React, { memo, useLayoutEffect, useRef } from "react";
import { Tool, Theme } from "@/draw/types";
import {
  MousePointer2,
  Hand,
  Square,
  Diamond,
  Circle,
  ArrowUpRight,
  Minus,
  Pencil,
  Type,
  FileText,
  Code2,
  StickyNote,
  Frame,
  Eraser,
  Undo2,
  Redo2,
  Shapes,
} from "lucide-react";

interface TopToolbarProps {
  selectedTool: Tool;
  setSelectedTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenIconPicker: () => void;
  theme: Theme;
  onHeightChange?: (height: number) => void;
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", key: "V", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "hand", label: "Pan", key: "H", icon: <Hand className="w-4 h-4" /> },
  { id: "rectangle", label: "Rectangle", key: "R", icon: <Square className="w-4 h-4" /> },
  { id: "diamond", label: "Diamond", key: "D", icon: <Diamond className="w-4 h-4" /> },
  { id: "circle", label: "Ellipse", key: "O", icon: <Circle className="w-4 h-4" /> },
  { id: "arrow", label: "Arrow / connector", key: "A", icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: "line", label: "Line", key: "L", icon: <Minus className="w-4 h-4" /> },
  { id: "pencil", label: "Draw", key: "P", icon: <Pencil className="w-4 h-4" /> },
  { id: "text", label: "Text & Bullets", key: "T", icon: <Type className="w-4 h-4" /> },
  { id: "doc", label: "Doc Card", key: "N", icon: <FileText className="w-4 h-4" /> },
  { id: "code", label: "Code card", key: "C", icon: <Code2 className="w-4 h-4" /> },
  { id: "sticky", label: "Sticky note", key: "S", icon: <StickyNote className="w-4 h-4" /> },
  { id: "frame", label: "Frame", key: "F", icon: <Frame className="w-4 h-4" /> },
  { id: "eraser", label: "Eraser", key: "E", icon: <Eraser className="w-4 h-4" /> },
];

export const TopToolbar = memo(function TopToolbar({
  selectedTool,
  setSelectedTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenIconPicker,
  onHeightChange,
}: TopToolbarProps) {
  const toolbar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = toolbar.current;
    if (!element || !onHeightChange) return;
    const update = () => onHeightChange(element.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);
  const iconBtn = `p-2 rounded-lg flex items-center justify-center transition disabled:opacity-35 disabled:pointer-events-none text-neutral-400 hover:bg-neutral-800 hover:text-white`;

  return (
    <div ref={toolbar} className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100%-0.75rem)]">
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="flex items-center gap-0.5 p-1 rounded-xl border shadow-lg backdrop-blur-xl flex-wrap justify-center bg-[#18181b]/95 border-[#27272a] shadow-black/50"
      >
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" className={iconBtn}>
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" className={iconBtn}>
          <Redo2 className="w-4 h-4" />
        </button>
        <span className="h-5 w-px mx-1 bg-[#27272a]" />

        {TOOLS.map((t) => {
          const active = selectedTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTool(t.id)}
              title={`${t.label} (${t.key})`}
              aria-label={`${t.label} (${t.key})`}
              aria-keyshortcuts={t.key.toLowerCase()}
              aria-pressed={active}
              className={`relative h-10 w-9 rounded-lg flex items-center justify-center pb-2 transition cursor-pointer ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t.icon}
              <kbd aria-hidden="true" className={`absolute bottom-0.5 right-1 text-[8px] font-medium leading-none ${active ? "text-blue-100" : "text-neutral-500"}`}>{t.key}</kbd>
            </button>
          );
        })}

        <span className="h-5 w-px mx-1 bg-[#27272a]" />
        <button
          onClick={onOpenIconPicker}
          title="Insert icon (I)"
          aria-label="Insert icon (I)" aria-keyshortcuts="i"
          className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition"
        >
          <Shapes className="w-4 h-4" />
          <span className="hidden md:inline">Icons</span><kbd aria-hidden="true" className="text-[9px] text-purple-300">I</kbd>
        </button>
      </div>
    </div>
  );
});

TopToolbar.displayName = "TopToolbar";
