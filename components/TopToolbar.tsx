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
  Search,
  type LucideIcon,
} from "lucide-react";

export interface ToolDefinition {
  id: Tool;
  label: string;
  key: string;
  hint?: string;
  icon: LucideIcon;
  group: "navigate" | "shape" | "write" | "finish";
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2, group: "navigate" },
  { id: "hand", label: "Pan", key: "H", icon: Hand, group: "navigate" },
  { id: "rectangle", label: "Rectangle", key: "R", icon: Square, group: "shape" },
  { id: "diamond", label: "Diamond", key: "D", icon: Diamond, group: "shape" },
  { id: "circle", label: "Ellipse", key: "O", icon: Circle, group: "shape" },
  { id: "arrow", label: "Arrow / connector", key: "A", icon: ArrowUpRight, group: "shape" },
  { id: "line", label: "Line", key: "L", icon: Minus, group: "shape" },
  { id: "pencil", label: "Draw", key: "P", icon: Pencil, group: "write" },
  { id: "highlighter", label: "Highlighter · fades after 0.2 seconds", key: "J", icon: Highlighter, group: "write" },
  { id: "text", label: "Text & Bullets", key: "T", hint: "Click to type · drag a writing area · Shift for a square", icon: Type, group: "write" },
  { id: "doc", label: "Doc Card", key: "N", icon: FileText, group: "write" },
  { id: "code", label: "Code card", key: "C", icon: Code2, group: "write" },
  { id: "sticky", label: "Sticky note", key: "S", icon: StickyNote, group: "write" },
  { id: "frame", label: "Frame", key: "F", icon: Frame, group: "write" },
  { id: "eyedropper", label: "Pick color", key: "K", icon: Pipette, group: "finish" },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser, group: "finish" },
];

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
  onOpenCommandPalette?: () => void;
  quickColors?: readonly string[];
  onQuickColor?: (color: string) => void;
}

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
  onOpenCommandPalette,
  quickColors = [],
  onQuickColor,
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
  const iconBtn = `tool-button shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white`;

  return (
    <div ref={toolbar} className="drawing-dock absolute top-0 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100%-1rem)]">
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="premium-toolbar flex items-center gap-0.5 p-1.5 rounded-xl border flex-nowrap justify-start overflow-x-auto overscroll-x-contain drawing-toolbar workspace-surface drawing-panel shadow-sm"
      >
        <TooltipButton data-ui-tone="pending" onMouseDown={event=>event.preventDefault()} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" className={iconBtn}>
          <Undo2 className="w-4 h-4" />
        </TooltipButton>
        <TooltipButton data-ui-tone="info" onMouseDown={event=>event.preventDefault()} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" className={iconBtn}>
          <Redo2 className="w-4 h-4" />
        </TooltipButton>
        <span aria-hidden="true" data-ui-divider="true" className="tool-divider" />

        {onUploadAssets && <TooltipButton type="button" aria-label="Upload image or file" title="Upload image or file · stored on this device" disabled={uploadingAssets} onClick={onUploadAssets} className={iconBtn}><ImagePlus className="h-4 w-4"/></TooltipButton>}
        {TOOL_DEFINITIONS.map((t, index) => {
          const active = selectedTool === t.id;
          const previous = TOOL_DEFINITIONS[index - 1];
          return (
            <React.Fragment key={t.id}>
              {previous && previous.group !== t.group && <span aria-hidden="true" data-ui-divider="true" className="tool-divider" />}
              <TooltipButton
                onClick={() => setSelectedTool(t.id)}
                title={`${t.label} (${t.key})${t.hint ? ` · ${t.hint}` : ""}`}
                aria-label={`${t.label} (${t.key})`}
                aria-keyshortcuts={t.key.toLowerCase()}
                aria-pressed={active}
                data-tool-group={t.group}
                className={`relative h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white ${
                  active
                    ? "ui-primary premium-tool-active text-white shadow-sm"
                    : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white"
                }`}
              >
                <t.icon className="h-4 w-4" />
              </TooltipButton>
            </React.Fragment>
          );
        })}

        <span aria-hidden="true" data-ui-divider="true" className="tool-divider" />
        <TooltipButton
          onClick={onOpenIconPicker}
          title="Insert icon (I)"
          aria-label="Insert icon (I)" aria-keyshortcuts="i"
          className="tool-button shrink-0 px-2 py-1.5 rounded flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-500/20 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white transition"
        >
          <Shapes className="w-4 h-4" />
        </TooltipButton>

        {onQuickColor && quickColors.length > 0 && <>
          <span aria-hidden="true" data-ui-divider="true" className="tool-divider quick-color-divider" />
          <div role="group" aria-label="Quick drawing colors" className="quick-colors flex items-center gap-1 px-1">
            {quickColors.slice(0, 5).map((color, index) => <button
              key={`${color}-${index}`}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => onQuickColor(color)}
              aria-label={`Drawing color ${color}`}
              title={`Draw with ${color}`}
              className="quick-color h-4 w-4 shrink-0 rounded-full border border-black/10 transition hover:scale-125 dark:border-white/20"
              style={{ backgroundColor: color }}
            />)}
          </div>
        </>}

        {onOpenCommandPalette && <>
          <span aria-hidden="true" data-ui-divider="true" className="tool-divider quick-color-divider" />
          <TooltipButton
            onClick={onOpenCommandPalette}
            title="Quick actions · Cmd/Ctrl+K"
            aria-label="Open quick actions"
            aria-keyshortcuts="Meta+k Control+k"
            className="tool-button ml-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-500/20 dark:hover:text-white"
          >
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
          </TooltipButton>
        </>}
      </div>
    </div>
  );
});

TopToolbar.displayName = "TopToolbar";
