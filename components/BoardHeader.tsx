"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  Sparkles,
  Grid,
  Download,
  Check,
  Copy,
  FileCode,
  FileText,
  Play,
  Magnet,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { GridType, ViewMode } from "@/draw/types";

interface BoardHeaderProps {
  saveError: boolean;
  onRetrySave: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  collaboration?: React.ReactNode;
  title: string;
  onRenameTitle: (newTitle: string) => void;
  onToggleSidebar: () => void;
  onOpenTemplates: () => void;
  onClearBoard: () => void;
  gridType: GridType;
  onChangeGridType: (g: GridType) => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  selectionCount: number;
  onExportSvg: (selection: boolean, transparent: boolean) => void;
  onExportDrawio: (selection: boolean) => void;
  onExportPng: (selection: boolean, transparent: boolean, scale: number) => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onCopyClipboard: () => Promise<boolean>;
  onTogglePresentation: () => void;
  canInstall: boolean;
  onInstall: () => void;
  onShowShortcuts: () => void;
}

export function BoardHeader({
  title,
  collaboration,
  viewMode,
  saveError,
  onRetrySave,
  onChangeViewMode,
  onRenameTitle,
  onToggleSidebar,
  onOpenTemplates,
  onClearBoard,
  gridType,
  onChangeGridType,
  snapToGrid,
  onToggleSnap,
  selectionCount,
  onExportSvg,
  onExportDrawio,
  onExportPng,
  onExportJson,
  onExportMarkdown,
  onCopyClipboard,
  onTogglePresentation,
  canInstall,
  onInstall,
  onShowShortcuts,
}: BoardHeaderProps) {
  const [exportSelection, setExportSelection] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [exportScale, setExportScale] = useState(2);
  const [copyError, setCopyError] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (localTitle.trim()) {
      onRenameTitle(localTitle.trim());
    } else {
      setLocalTitle(title);
    }
  };

  const handleCopyImage = async () => {
    const success = await onCopyClipboard();
    setCopyError(!success);
    setCopiedSuccess(success);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const cycleGrid = () => {
    if (gridType === "dot") onChangeGridType("grid");
    else if (gridType === "grid") onChangeGridType("none");
    else onChangeGridType("dot");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-11 z-30 px-2 gap-2 flex items-center justify-between border-b backdrop-blur-md select-none bg-[#121212]/95 border-[#27272a] text-[#f4f4f5]">
      {/* Left Section: Menu & Title */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onToggleSidebar}
          title="Open Boards Workspace"
          aria-label="Open workspaces"
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          {/* The app mark is shared with the installed app and favicon. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/mark.svg" alt="" width={26} height={26} className="hidden sm:block shrink-0" />

          {isEditingTitle ? (
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="px-2 py-0.5 text-xs font-semibold rounded border border-blue-500 focus:outline-none bg-[#18181b] text-white max-w-[180px]"
            />
          ) : (
            <button
              onClick={() => {
                setLocalTitle(title);
                setIsEditingTitle(true);
              }}
              className="flex items-center gap-1 cursor-pointer group"
              title="Click to rename board"
            >
              <h1 className="text-xs font-semibold tracking-tight text-neutral-200 group-hover:text-blue-400 transition max-w-[80px] sm:max-w-[180px] truncate">
                {title || "Untitled Whiteboard"}
              </h1>
              <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100">
                ✎
              </span>
            </button>
          )}
        </div>

        {saveError ? <button role="status" onClick={onRetrySave} title="Storage is full or unavailable. Retry saving or export a JSON backup." className="rounded px-2 py-1 text-[10px] text-amber-400 hover:bg-amber-500/10">Not saved · retry</button> : <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Saved locally</span>}

      </div>

      <nav aria-label="Board view" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
        {(["canvas", "split", "notes"] as ViewMode[]).map(mode => <button key={mode} aria-pressed={viewMode === mode} onClick={() => onChangeViewMode(mode)} className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${viewMode === mode ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}>{mode}</button>)}
      </nav>
      {/* Right Section: Actions */}
      <div className="header-actions flex shrink-0 items-center gap-1">
        {collaboration}
        {/* Templates Button */}
        <button
          onClick={onOpenTemplates}
          title="Browse Diagram Templates"
          className="px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium flex items-center gap-1 hover:bg-purple-500/20 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Templates</span>
        </button>

        {/* Clear Board Button */}
        <button
          onClick={() => setClearOpen(true)}
          aria-label="Clear board"
          title="Clear Whiteboard to Blank Canvas"
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Snap to Grid Toggle */}
        <button
          onClick={onToggleSnap}
          title={snapToGrid ? "Snap to Grid: ON" : "Snap to Grid: OFF"}
          aria-label="Snap to grid"
          aria-pressed={snapToGrid}
          className={`hidden sm:flex p-1.5 rounded-lg text-xs transition cursor-pointer ${
            snapToGrid
              ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
              : "hover:bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>

        {/* Grid Style Toggle */}
        <button
          onClick={cycleGrid}
          title={`Grid Mode: ${gridType.toUpperCase()}`}
          aria-label="Cycle grid style"
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Presentation / Zen Mode */}
        <button
          onClick={onTogglePresentation}
          title="Zen Fullscreen Mode"
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
        </button>

        {canInstall && (
          <button
            onClick={onInstall}
            title="Install Whiteboard as an app"
            className="px-2.5 py-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1 hover:bg-blue-500/20 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Install app</span>
          </button>
        )}

        <button
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer text-xs font-bold w-7"
        >
          ?
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            aria-expanded={showExportMenu}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer ml-1"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 max-h-[calc(100dvh-60px)] overflow-y-auto rounded-xl border shadow-2xl p-1 space-y-0.5 z-50 backdrop-blur-xl animate-fade-in bg-[#18181b] border-[#27272a] text-[#f4f4f5]">
              <div className="space-y-2 border-b border-neutral-700/50 px-2.5 py-2 text-xs text-neutral-300">
                <label className="flex items-center gap-2"><input type="checkbox" checked={exportSelection && selectionCount > 0} disabled={!selectionCount} onChange={e => setExportSelection(e.target.checked)} />Selection only ({selectionCount})</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} />Transparent background</label>
                <label className="flex items-center justify-between gap-2">PNG quality<select aria-label="PNG quality" value={exportScale} onChange={e => setExportScale(Number(e.target.value))} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"><option value={1}>1x</option><option value={2}>2x</option><option value={3}>3x</option></select></label>
              </div>
              <button onClick={() => { onExportSvg(exportSelection && selectionCount > 0, transparent); setShowExportMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-neutral-800"><FileCode className="h-3.5 w-3.5 text-blue-400" />Export SVG · vector</button>
              <button onClick={() => { onExportDrawio(exportSelection && selectionCount > 0); setShowExportMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-neutral-800"><FileCode className="h-3.5 w-3.5 text-amber-400" />Export draw.io · editable</button>
              <button
                onClick={() => {
                  onExportPng(exportSelection && selectionCount > 0, transparent, exportScale);
                  setShowExportMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-neutral-800 text-left transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>Export PNG ({exportScale}x)</span>
              </button>

              <button
                onClick={() => {
                  handleCopyImage();
                  setShowExportMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-neutral-800 text-left transition cursor-pointer"
              >
                {copiedSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-purple-500" />
                )}
                <span>{copiedSuccess ? "Copied image" : copyError ? "Copy failed — try PNG" : "Copy to Clipboard"}</span>
              </button>

              <button
                onClick={() => {
                  onExportJson();
                  setShowExportMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-neutral-800 text-left transition cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-500" />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => {
                  onExportMarkdown();
                  setShowExportMenu(false);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-neutral-800 text-left transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export Notes (.md)</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={onClearBoard} />
    </header>
  );
}
