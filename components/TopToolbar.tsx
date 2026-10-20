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
  Pipette,
  ImagePlus,
} from "lucide-react";

interface TopToolbarProps {
  onUploadAssets?: () => void;
  uploadingAssets?: boolean;
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
  { id: "eyedropper", label: "Pick color", key: "K", icon: <Pipette className="w-4 h-4" /> },
  { id: "eraser", label: "Eraser", key: "E", icon: <Eraser className="w-4 h-4" /> },
];

export const TopToolbar = memo(function TopToolbar({
  onUploadAssets,
  uploadingAssets,
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
  const iconBtn = `shrink-0 p-2 rounded-lg flex items-center justify-center transition disabled:opacity-35 disabled:pointer-events-none text-neutral-400 hover:bg-neutral-800 hover:text-white`;

  return (
    <div ref={toolbar} className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100%-0.75rem)]">
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="flex items-center gap-0.5 p-1 rounded-xl border shadow-sm backdrop-blur-md flex-nowrap justify-start overflow-x-auto overscroll-x-contain bg-[#18181b]/95 border-[#27272a] shadow-black/10"
      >
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" className={iconBtn}>
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" className={iconBtn}>
          <Redo2 className="w-4 h-4" />
        </button>
        <span className="h-5 w-px mx-1 bg-[#27272a]" />

        {onUploadAssets&&<button type="button" aria-label="Upload image or file" title="Upload image or file · stored on this device" disabled={uploadingAssets} onClick={onUploadAssets} className={iconBtn}><ImagePlus className="h-4 w-4"/></button>}
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
              className={`relative h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition cursor-pointer ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t.icon}
            </button>
          );
        })}

        <span className="h-5 w-px mx-1 bg-[#27272a]" />
        <button
          onClick={onOpenIconPicker}
          title="Insert icon (I)"
          aria-label="Insert icon (I)" aria-keyshortcuts="i"
          className="shrink-0 px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition"
        >
          <Shapes className="w-4 h-4" />

        </button>
      </div>
    </div>
  );
});

TopToolbar.displayName = "TopToolbar";
