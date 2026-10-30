"use client";

import { loadPreferences, savePreferences } from "@/lib/preferences";
import { brandAsset } from "@/lib/brandAssets";

import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  MoreHorizontal,
  Maximize2,
  FolderOpen,
  HardDrive,
  Search,
  Sparkles,
  Grid,
  Download,
  Copy,
  Play,
  Magnet,
  Trash2,
} from "lucide-react";
import { AccountButton } from "./AccountButton";
import { InstallWebApp } from "./InstallWebApp";
import { RefreshWebApp } from "./RefreshWebApp";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RasterFormat } from "@/draw/export";
import type { ExportScope } from "@/lib/projectFile";
import { GridType, ViewMode } from "@/draw/types";

interface BoardHeaderProps {
  onBeforeRefresh: () => void | Promise<void>;
  recording?: boolean;
  saveError: boolean;
  onRetrySave: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  collaboration?: React.ReactNode;
  title: string;
  onFocusCanvas?: () => void;
  onRenameTitle: (newTitle: string) => void;
  onToggleSidebar: () => void;
  onOpenTemplates: () => void;
  onOpenBoardTools: () => void;
  onClearBoard: () => void;
  gridType: GridType;
  onChangeGridType: (g: GridType) => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  selectionCount: number;
  onExportSvg: (selection: boolean, transparent: boolean) => void | Promise<void>;
  onExportDrawio: (selection: boolean) => void;
  onExportImage: (format: RasterFormat, selection: boolean, transparent: boolean, scale: number) => void | Promise<void>;
  onExportJson: () => void;
  onExportProject: (scope: ExportScope) => void;
  onExportPdf: (scope: ExportScope) => Promise<void>;
  onImportFile: (file: File) => Promise<void>;
  onOpenUploadedFiles?: () => void;
  onExportMarkdown: () => void | Promise<void>;
  onCopyClipboard: (selection: boolean) => Promise<boolean>;
  onTogglePresentation: () => void;
  onShowShortcuts: () => void;
}

export function BoardHeader({
  onBeforeRefresh,
  onOpenUploadedFiles,
  recording,
  title,
  onFocusCanvas,
  collaboration,
  viewMode,
  saveError,
  onRetrySave,
  onChangeViewMode,
  onRenameTitle,
  onToggleSidebar,
  onOpenTemplates,
  onOpenBoardTools,
  onClearBoard,
  gridType,
  onChangeGridType,
  snapToGrid,
  onToggleSnap,
  selectionCount,
  onExportSvg,
  onExportDrawio,
  onExportImage,
  onExportJson,
  onExportProject,
  onExportPdf,
  onImportFile,
  onExportMarkdown,
  onCopyClipboard,
  onTogglePresentation,
  onShowShortcuts,
}: BoardHeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsButton = useRef<HTMLButtonElement>(null);
  const actionsPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionsPanel.current?.contains(event.target) && !actionsButton.current?.contains(event.target)) setActionsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [actionsOpen]);
  const [preferences] = useState(loadPreferences);
  const [scope, setScope] = useState<ExportScope>(preferences.exportScope);
  const [format, setFormat] = useState(preferences.exportFormat);
  const importFile = useRef<HTMLInputElement>(null);
  const [exportSelection, setExportSelection] = useState(false);
  const [transparent, setTransparent] = useState(preferences.exportTransparent);
  const [exportScale, setExportScale] = useState(preferences.exportScale);
  const [copyStatus, setCopyStatus] = useState<{ selection: boolean; success: boolean } | null>(null);
  const copyPending = useRef(false);
  const [copying, setCopying] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
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

  useEffect(() => {
    savePreferences({ exportFormat:format, exportScope:scope, exportScale, exportTransparent:transparent });
  }, [format, scope, exportScale, transparent]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (localTitle.trim()) {
      onRenameTitle(localTitle.trim());
    } else {
      setLocalTitle(title);
    }
  };

  const handleCopyImage = async (selection: boolean) => {
    if (copyPending.current) return;
    copyPending.current = true; setCopying(true); setCopyStatus(null);
    try {
      const success = await onCopyClipboard(selection).catch(() => false);
      setCopyStatus({ selection, success });
    } finally { copyPending.current = false; setCopying(false); }
  };

  const cycleGrid = () => {
    if (gridType === "dot") onChangeGridType("grid");
    else if (gridType === "grid") onChangeGridType("none");
    else onChangeGridType("dot");
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-11 z-40 px-2 gap-1 sm:gap-2 flex items-center justify-between border-b backdrop-blur-md select-none bg-[#121212]/95 border-[#27272a] text-[#f4f4f5]">
      {onFocusCanvas && <button onClick={onFocusCanvas} aria-label="Focus canvas" aria-keyshortcuts="Shift+Z" title="Focus canvas · Shift+Z" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"><Maximize2 className="h-4 w-4" /></button>}

      {/* Left Section: Menu & Title */}
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <button
          onClick={onToggleSidebar}
          title="Open Boards Workspace"
          aria-label="Open workspaces"
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button aria-label="Board tools: find, history, templates and report a bug" title="Board tools · Find, history, templates & report a bug (Ctrl/Cmd+F)" onClick={onOpenBoardTools} className="hidden min-[480px]:block rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"><Search className="h-4 w-4" /></button>
        <input ref={importFile} type="file" aria-label="Import project or Markdown" accept=".knotleaf,.json,.md,.markdown" className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void onImportFile(file);}} />
        <button aria-label="Open project or notes" title="Open .knotleaf, .json or Markdown notes" onClick={() => importFile.current?.click()} className="hidden min-[480px]:block rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"><FolderOpen className="h-4 w-4" /></button>
        {onOpenUploadedFiles&&<button type="button" aria-label="Manage uploaded Markdown" title="Uploaded Markdown · storage and cleanup" onClick={onOpenUploadedFiles} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"><HardDrive className="h-4 w-4"/></button>}
        <div className="flex min-w-0 items-center gap-2">
          {/* The app mark is shared with the website favicon. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandAsset("/icons/mark.svg")} alt="Knotleaf Desk" title="Knotleaf Desk · Canvas and notes" width={26} height={26} className="hidden sm:block shrink-0" />

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
              className="flex min-w-0 items-center gap-1 cursor-pointer group"
              title="Knotleaf Desk · Click to rename board"
            >
              <h1 className="text-xs font-semibold tracking-tight text-neutral-200 group-hover:text-blue-400 transition max-w-[48px] sm:max-w-[180px] truncate">
                {title || "Untitled board"}
              </h1>
              <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100">
                ✎
              </span>
            </button>
          )}
        </div>

        {saveError ? <button role="status" onClick={onRetrySave} title="Storage is full or unavailable. Retry saving or export a JSON backup." className="rounded px-2 py-1 text-[10px] text-amber-400 hover:bg-amber-500/10">Not saved · retry</button> : <span className="hidden lg:flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Saved locally</span>}

      </div>

      <nav aria-label="Board view" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
        {(["canvas", "split", "notes", "slides"] as ViewMode[]).map(mode => <button key={mode} aria-pressed={viewMode === mode} onClick={() => onChangeViewMode(mode)} className={`rounded-md px-1 min-[380px]:px-1.5 sm:px-2 py-1 text-[10px] min-[380px]:text-[11px] font-medium capitalize transition ${viewMode === mode ? "bg-neutral-700 text-white" : "text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}>{mode === "slides" ? "Presentation" : mode}</button>)}
      </nav>
      <AccountButton />
      {/* Right Section: Actions */}
      <button ref={actionsButton} type="button" aria-label="Board actions" aria-expanded={actionsOpen} aria-controls="board-actions" onClick={() => setActionsOpen(value => !value)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white min-[1440px]:hidden"><MoreHorizontal className="h-4 w-4" /></button>
      <div ref={actionsPanel} id="board-actions" onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.stopPropagation(); setActionsOpen(false); actionsButton.current?.focus(); } }} className={`header-actions absolute right-2 top-12 max-w-[calc(100vw-1rem)] flex-wrap items-center gap-1 rounded-xl border border-neutral-700 bg-[#18181b] p-2 shadow-lg min-[1440px]:static min-[1440px]:flex min-[1440px]:max-w-none min-[1440px]:shrink-0 min-[1440px]:flex-nowrap min-[1440px]:rounded-none min-[1440px]:border-0 min-[1440px]:bg-transparent min-[1440px]:p-0 min-[1440px]:shadow-none ${actionsOpen ? "flex" : "hidden"}`}>
        <button aria-label="Board tools" onClick={onOpenBoardTools} className="min-[480px]:hidden rounded-lg p-1.5 text-xs text-neutral-300 hover:bg-neutral-800"><Search className="mr-1 inline h-3.5 w-3.5" />Board tools</button>
        <button aria-label="Open project or notes" onClick={() => importFile.current?.click()} className="min-[480px]:hidden rounded-lg p-1.5 text-xs text-neutral-300 hover:bg-neutral-800"><FolderOpen className="mr-1 inline h-3.5 w-3.5" />Open project</button>
        <RefreshWebApp onBeforeRefresh={onBeforeRefresh} recording={recording} />
        {collaboration}
        {viewMode !== "slides" && <>
        {/* Templates Button */}
        <button
          onClick={onOpenTemplates}
          aria-label="Browse diagram templates" title="Browse Diagram Templates"
          className="px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium flex items-center gap-1 hover:bg-purple-500/20 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Templates</span>
        </button>

        {/* Clear Board Button */}
        <button
          onClick={() => setClearOpen(true)}
          aria-label="Clear board"
          title="Clear this board and its notes"
          className="flex p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Snap to Grid Toggle */}
        <button
          onClick={onToggleSnap}
          title={snapToGrid ? "Snap to Grid: ON" : "Snap to Grid: OFF"}
          aria-label="Snap to grid"
          aria-pressed={snapToGrid}
          className={`flex p-1.5 rounded-lg text-xs transition cursor-pointer ${
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
          className="flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Presentation / Zen Mode */}
        <button
          onClick={onTogglePresentation}
          title="Present frames"
          aria-label="Start presentation"
          className="flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
        </button>

        </>}
        <button
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer text-xs font-bold w-7"
        >
          ?
        </button>

        <InstallWebApp />
        {/* Export Dropdown */}
        {viewMode !== "slides" && <div className="relative" ref={exportMenuRef}>
          <button
            aria-label="Export board" aria-expanded={showExportMenu}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer ml-1"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[92vw] max-h-[calc(100dvh-60px)] overflow-y-auto rounded-xl border shadow-2xl p-1 space-y-0.5 z-50 backdrop-blur-xl animate-fade-in bg-[#18181b] border-[#27272a] text-[#f4f4f5]">
              <div className="space-y-3 p-3 text-xs text-neutral-300">
                <label className="block space-y-1.5"><span>File format</span><select aria-label="Export format" value={format} disabled={exporting} onChange={e => { const next = e.target.value; setFormat(next); setExportError(""); if (["png", "jpeg", "webp", "svg", "drawio"].includes(next)) setScope("canvas"); if (next === "markdown") setScope("notes"); if (next === "json") setScope("project"); }} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2">
                  <option value="project">Knotleaf project · editable</option><option value="pdf">PDF document</option><option value="png">PNG image</option><option value="jpeg">JPG image</option><option value="webp">WebP image</option><option value="svg">SVG vector</option><option value="markdown">Markdown notes</option><option value="drawio">draw.io diagram</option><option value="json">Legacy JSON backup</option>
                </select></label>
                <label className="block space-y-1.5"><span>Include</span><select aria-label="Export content" value={scope} disabled={exporting || !["project", "pdf"].includes(format)} onChange={e => setScope(e.target.value as ExportScope)} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 disabled:opacity-60"><option value="project">Canvas & notes</option><option value="canvas">Canvas only</option><option value="notes">Notes only</option></select></label>
                {["png", "jpeg", "webp", "svg", "drawio"].includes(format) && <label className="flex items-center gap-2"><input type="checkbox" checked={exportSelection && selectionCount > 0} disabled={!selectionCount || exporting} onChange={e => setExportSelection(e.target.checked)} />Selected elements only ({selectionCount})</label>}
                {["png", "webp", "svg"].includes(format) && <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} />Transparent background (omit canvas color and grid)</label>}
                {["png", "jpeg", "webp"].includes(format) && <label className="flex items-center justify-between gap-2">Quality<select aria-label={`${format.toUpperCase()} quality`} value={exportScale} onChange={e => setExportScale(Number(e.target.value))} className="rounded border border-neutral-700 bg-neutral-900 p-1.5"><option value={1}>1x</option><option value={2}>2x</option><option value={3}>3x</option></select></label>}
                {format === "jpeg" && <p className="text-[11px] text-neutral-400">JPG uses an opaque canvas background.</p>}
                <p className="text-[11px] leading-relaxed text-neutral-500">{["project", "json"].includes(format) ? "Reopen this file here to continue editing. Includes embedded icons and connector attachments." : format === "markdown" ? "Editable notes. Open the .md file here to continue writing." : format === "drawio" ? "Edit in diagrams.net. Keep a Knotleaf backup to resume here." : "For viewing and sharing. Keep a Knotleaf backup to resume editing."}</p>
                {exportError && <p role="alert" className="text-xs text-rose-400">{exportError}</p>}
                <button disabled={exporting || copying} onClick={async () => {
                  setExporting(true); setExportError("");
                  try {
                    const selected = exportSelection && selectionCount > 0;
                    if (format === "project") onExportProject(scope);
                    else if (format === "pdf") await onExportPdf(scope);
                    else if (["png", "jpeg", "webp"].includes(format)) await onExportImage(format as RasterFormat, selected, transparent, exportScale);
                    else if (format === "svg") await onExportSvg(selected, transparent);
                    else if (format === "drawio") onExportDrawio(selected);
                    else if (format === "markdown") await onExportMarkdown();
                    else onExportJson();
                    setShowExportMenu(false);
                  } catch (error) { setExportError(error instanceof Error ? error.message : "Download failed. Please try again."); }
                  finally { setExporting(false); }
                }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 disabled:opacity-60"><Download className="h-3.5 w-3.5" />{exporting ? "Preparing download…" : "Download"}</button>
                <button disabled={copying || exporting} aria-busy={copying} onClick={() => handleCopyImage(false)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800 disabled:opacity-60"><Copy className="h-3.5 w-3.5" />Copy canvas image</button>
                <button disabled={!selectionCount || copying || exporting} onClick={() => handleCopyImage(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800 disabled:opacity-60"><Copy className="h-3.5 w-3.5" />Copy selection as image ({selectionCount})</button>
                {copyStatus && <p role="status" className={copyStatus.success ? "text-emerald-400" : "text-rose-400"}>{copyStatus.success ? `${copyStatus.selection ? "Selection" : "Canvas"} image copied.` : "Copy failed. Try downloading a PNG instead."}</p>}
              </div>
            </div>
          )}
        </div>}
      </div>
      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={onClearBoard} />
    </header>
  );
}
