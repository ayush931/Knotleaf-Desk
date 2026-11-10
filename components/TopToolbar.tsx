"use client";

import React, { memo, useLayoutEffect, useRef } from "react";
import { TooltipButton } from "./TooltipButton";
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
  Highlighter,
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

const TOOLS: { id: Tool; label: string; key: string; hint?: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select", key: "V", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "hand", label: "Pan", key: "H", icon: <Hand className="w-4 h-4" /> },
  { id: "rectangle", label: "Rectangle", key: "R", icon: <Square className="w-4 h-4" /> },
  { id: "diamond", label: "Diamond", key: "D", icon: <Diamond className="w-4 h-4" /> },
  { id: "circle", label: "Ellipse", key: "O", icon: <Circle className="w-4 h-4" /> },
  { id: "arrow", label: "Arrow / connector", key: "A", icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: "line", label: "Line", key: "L", icon: <Minus className="w-4 h-4" /> },
  { id: "pencil", label: "Draw", key: "P", icon: <Pencil className="w-4 h-4" /> },
  { id: "highlighter", label: "Highlighter · fades after 0.2 seconds", key: "J", icon: <Highlighter className="w-4 h-4" /> },
  { id: "text", label: "Text & Bullets", key: "T", hint: "Click to type · drag a writing area · Shift for a square", icon: <Type className="w-4 h-4" /> },
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
  const iconBtn = `shrink-0 p-2 rounded flex items-center justify-center transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500`;

  return (
    <div ref={toolbar} className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100%-1rem)]">
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="flex items-center gap-0.5 p-1 rounded-md border flex-nowrap justify-start overflow-x-auto overscroll-x-contain drawing-panel shadow-sm"
      >
        <TooltipButton onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" className={iconBtn}>
          <Undo2 className="w-4 h-4" />
        </TooltipButton>
        <TooltipButton onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" className={iconBtn}>
          <Redo2 className="w-4 h-4" />
        </TooltipButton>
        <span className="h-5 w-px mx-1 bg-slate-200 dark:bg-slate-600" />

        {onUploadAssets&&<TooltipButton type="button" aria-label="Upload image or file" title="Upload image or file · stored on this device" disabled={uploadingAssets} onClick={onUploadAssets} className={iconBtn}><ImagePlus className="h-4 w-4"/></TooltipButton>}
        {TOOLS.map((t) => {
          const active = selectedTool === t.id;
          return (
            <React.Fragment key={t.id}>
            {["rectangle", "pencil", "text", "eraser"].includes(t.id) && <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-600" />}
            <TooltipButton
              onClick={() => setSelectedTool(t.id)}
              title={`${t.label} (${t.key})${t.hint ? ` · ${t.hint}` : ""}`}
              aria-label={`${t.label} (${t.key})`}
              aria-keyshortcuts={t.key.toLowerCase()}
              aria-pressed={active}
              className={`relative h-8 w-8 shrink-0 rounded flex items-center justify-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 ${
                active
                  ? "bg-blue-600 text-white shadow-sm ring-1 ring-inset ring-blue-500"
                  : "text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
              }`}
            >
              {t.icon}
            </TooltipButton>
            </React.Fragment>
          );
        })}

        <span className="h-5 w-px mx-1 bg-slate-200 dark:bg-slate-600" />
        <TooltipButton
          onClick={onOpenIconPicker}
          title="Insert icon (I)"
          aria-label="Insert icon (I)" aria-keyshortcuts="i"
          className="shrink-0 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500 transition"
        >
          <Shapes className="w-4 h-4" />

        </TooltipButton>
      </div>
    </div>
  );
});

TopToolbar.displayName = "TopToolbar";
