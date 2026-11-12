"use client";

import { loadPreferences, savePreferences } from "@/lib/preferences";
import { BrandMark } from "./BrandMark";

import React, { useState, useRef, useEffect } from "react";
import {
  Keyboard,
  Sun,
  Paintbrush,
  AlarmClock,
  Moon,
  MoreHorizontal,
  Maximize2,
  FolderOpen,
  HardDrive,
  Search,
  LayoutTemplate,
  Grid,
  Download,
  Copy,
  Play,
  Magnet,
  Trash2,
  Command,
} from "lucide-react";
import { AccountButton } from "./AccountButton";
import { InstallWebApp } from "./InstallWebApp";
import { RefreshWebApp } from "./RefreshWebApp";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RasterFormat } from "@/draw/export";
import type { ExportScope } from "@/lib/projectFile";
import { GridType, ViewMode } from "@/draw/types";

interface BoardHeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenThemes?: () => void;
  onOpenReminders?: () => void;
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
  onOpenCommandPalette?: () => void;
}

export function BoardHeader({
  theme,
  onToggleTheme,
  onOpenThemes,
  onOpenReminders,
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
  onOpenCommandPalette,
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
  const runMenuAction=(action:()=>void)=>{setActionsOpen(false);actionsButton.current?.focus();action();};
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
    <header className="workspace-header workspace-surface fixed top-0 left-0 right-0 z-40 flex items-center border-b select-none drawing-panel text-neutral-800 dark:text-neutral-200">

      {/* Left Section: Menu & Title */}
      <div className="workspace-identity flex min-w-0 flex-1 items-center gap-3">
        <button data-ui-tone="info"
          onClick={onToggleSidebar}
          title="Open Boards Workspace"
          aria-label="Open workspaces"
          className="workspace-brand-button brand-orb shrink-0 rounded-lg text-neutral-600 transition hover:text-white dark:text-neutral-200"
        >
          <BrandMark size={30} />
        </button>

        <input ref={importFile} type="file" aria-label="Import project or Markdown" accept=".knotleaf,.json,.md,.markdown" className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void onImportFile(file);}} />
        <div className="workspace-title-block hidden min-[640px]:flex min-w-0 flex-col items-start">

          {isEditingTitle ? (
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="px-2 py-0.5 text-xs font-semibold rounded border border-neutral-500 focus:outline-none bg-white dark:bg-black text-white max-w-[180px]"
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
              <h1 className="text-sm font-semibold tracking-tight text-neutral-200 group-hover:text-neutral-400 transition max-w-[200px] truncate">
                {title || "Untitled board"}
              </h1>
              <span className="text-[10px] text-neutral-600 dark:text-neutral-200 opacity-0 group-hover:opacity-100">
                ✎
              </span>
            </button>
          )}
        {saveError ? <button data-ui-tone="pending" role="status" onClick={onRetrySave} title="Storage is full or unavailable. Retry saving or export a JSON backup." className="rounded px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-500/10">Not saved · retry</button> : <span className="save-status flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-neutral-500 dark:text-neutral-300"><span className="save-dot h-1.5 w-1.5 rounded-full" />Saved locally</span>}
        </div>



      </div>

      <select aria-label="Board view" value={viewMode} onChange={event=>onChangeViewMode(event.target.value as ViewMode)} className="workspace-view-select min-[900px]:hidden w-24 shrink-0 rounded-md border border-neutral-700 px-2 py-1.5 text-xs">{(["canvas","split","notes","slides"] as ViewMode[]).map(mode=><option key={mode} value={mode}>{mode==="slides"?"Presentation":mode.charAt(0).toUpperCase()+mode.slice(1)}</option>)}</select>
      <nav aria-label="Board view" className="workspace-view-switch hidden min-[900px]:flex shrink-0 items-center gap-1">
        {(["canvas", "split", "notes", "slides"] as ViewMode[]).map(mode => <button key={mode} aria-pressed={viewMode === mode} onClick={() => onChangeViewMode(mode)} className="workspace-view-button text-xs font-medium capitalize transition">{mode === "slides" ? "Presentation" : mode}</button>)}
      </nav>
      <div className="workspace-header-controls">
      {onOpenCommandPalette && <button type="button" onClick={onOpenCommandPalette} aria-label="Quick actions" title="Quick actions · Cmd/Ctrl+K" aria-keyshortcuts="Meta+k Control+k" className="header-command hidden h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium min-[1180px]:inline-flex"><Command aria-hidden="true" className="h-3.5 w-3.5" /><span>Quick actions</span><kbd className="premium-kbd">⌘K</kbd></button>}
      <button type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-700 px-2 text-xs font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white">
        {theme === "dark" ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
        <span className="sr-only">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
      {onOpenThemes&&<button type="button" onClick={onOpenThemes} aria-label="Canvas and notes themes" title="Themes · Canvas, Notes or Both" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white"><Paintbrush className="h-4 w-4"/></button>}
      {onOpenReminders&&<button data-ui-tone="pending" type="button" onClick={onOpenReminders} aria-label="Open reminders" title="Reminders" className="reminders-trigger flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"><AlarmClock className="h-4 w-4"/></button>}
      <AccountButton />
      <div className="workspace-export">
        {/* Export Dropdown */}
        {viewMode !== "slides" && <div className="relative" ref={exportMenuRef}>
          <button data-ui-tone="info"
            aria-label="Export board" aria-expanded={showExportMenu}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="premium-cta px-2.5 py-1 rounded-lg ui-primary hover:bg-neutral-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer ml-1"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          {showExportMenu && (
            <div className="workspace-export-menu workspace-surface absolute right-0 top-full mt-2 w-72 max-w-[92vw] max-h-[calc(100dvh-60px)] overflow-y-auto rounded-xl border shadow-2xl p-1 space-y-0.5 z-50 backdrop-blur-xl animate-fade-in bg-white dark:bg-black border-neutral-700 text-[#f4f4f5]">
              <div className="space-y-3 p-3 text-xs text-neutral-300">
                <label className="block space-y-1.5"><span>File format</span><select aria-label="Export format" value={format} disabled={exporting} onChange={e => { const next = e.target.value; setFormat(next); setExportError(""); if (["png", "jpeg", "webp", "svg", "drawio"].includes(next)) setScope("canvas"); if (next === "markdown") setScope("notes"); if (next === "json") setScope("project"); }} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2">
                  <option value="project">Knotleaf project · editable</option><option value="pdf">PDF document</option><option value="png">PNG image</option><option value="jpeg">JPG image</option><option value="webp">WebP image</option><option value="svg">SVG vector</option><option value="markdown">Markdown notes</option><option value="drawio">draw.io diagram</option><option value="json">Legacy JSON backup</option>
                </select></label>
                <label className="block space-y-1.5"><span>Include</span><select aria-label="Export content" value={scope} disabled={exporting || !["project", "pdf"].includes(format)} onChange={e => setScope(e.target.value as ExportScope)} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 disabled:opacity-60"><option value="project">Canvas & notes</option><option value="canvas">Canvas only</option><option value="notes">Notes only</option></select></label>
                {["png", "jpeg", "webp", "svg", "drawio"].includes(format) && <label className="flex items-center gap-2"><input type="checkbox" checked={exportSelection && selectionCount > 0} disabled={!selectionCount || exporting} onChange={e => setExportSelection(e.target.checked)} />Selected elements only ({selectionCount})</label>}
                {["png", "webp", "svg"].includes(format) && <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} />Transparent background (omit canvas color and grid)</label>}
                {["png", "jpeg", "webp"].includes(format) && <label className="flex items-center justify-between gap-2">Quality<select aria-label={`${format.toUpperCase()} quality`} value={exportScale} onChange={e => setExportScale(Number(e.target.value))} className="rounded border border-neutral-700 bg-neutral-900 p-1.5"><option value={1}>1x</option><option value={2}>2x</option><option value={3}>3x</option></select></label>}
                {format === "jpeg" && <p className="text-[11px] text-neutral-600 dark:text-neutral-200">JPG uses an opaque canvas background.</p>}
                <p className="text-[11px] leading-relaxed text-neutral-500">{["project", "json"].includes(format) ? "Reopen this file here to continue editing. Includes embedded icons and connector attachments." : format === "markdown" ? "Editable notes. Open the .md file here to continue writing." : format === "drawio" ? "Edit in diagrams.net. Keep a Knotleaf backup to resume here." : "For viewing and sharing. Keep a Knotleaf backup to resume editing."}</p>
                {exportError && <p role="alert" className="text-xs text-neutral-400">{exportError}</p>}
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
                }} className="flex w-full items-center justify-center gap-2 rounded-lg ui-primary px-3 py-2 text-white hover:bg-neutral-500 disabled:opacity-60"><Download className="h-3.5 w-3.5" />{exporting ? "Preparing download…" : "Download"}</button>
                <button data-ui-tone="info" disabled={copying || exporting} aria-busy={copying} onClick={() => handleCopyImage(false)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800 disabled:opacity-60"><Copy className="h-3.5 w-3.5" />Copy canvas image</button>
                <button data-ui-tone="info" disabled={!selectionCount || copying || exporting} onClick={() => handleCopyImage(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800 disabled:opacity-60"><Copy className="h-3.5 w-3.5" />Copy selection as image ({selectionCount})</button>
                {copyStatus && <p role="status" className={copyStatus.success ? "text-neutral-400" : "text-neutral-400"}>{copyStatus.success ? `${copyStatus.selection ? "Selection" : "Canvas"} image copied.` : "Copy failed. Try downloading a PNG instead."}</p>}
              </div>
            </div>
          )}
        </div>}
      </div>
      {/* Right Section: Actions */}
      <button ref={actionsButton} type="button" aria-label="Board actions" aria-expanded={actionsOpen} aria-controls="board-actions" onClick={() => setActionsOpen(value => !value)} title={saveError?"Not saved · open actions to retry":"Board actions"} className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-200 hover:bg-neutral-800 hover:text-white"><MoreHorizontal className="h-4 w-4"/>{saveError&&<span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border drawing-panel text-[9px]">!</span>}</button>
      </div>
      <div ref={actionsPanel} id="board-actions" onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.stopPropagation(); setActionsOpen(false); actionsButton.current?.focus(); } }} className={`header-actions workspace-menu workspace-surface ${actionsOpen ? "flex" : "hidden"}`}>
        {saveError&&<button type="button" aria-label="Retry saving board" onClick={()=>runMenuAction(onRetrySave)} className="rounded-lg p-2 text-xs"><HardDrive className="h-4 w-4"/>Retry saving</button>}
        {onFocusCanvas&&<button type="button" data-ui-tone="info" aria-label="Focus canvas" onClick={()=>runMenuAction(onFocusCanvas)} className="rounded-lg p-1.5 text-xs"><Maximize2 className="mr-1 inline h-3.5 w-3.5"/>Focus canvas</button>}
        <button aria-label="Board tools: find, history, templates and report a bug" onClick={()=>runMenuAction(onOpenBoardTools)} className="rounded-lg p-1.5 text-xs text-neutral-300 hover:bg-neutral-800"><Search className="mr-1 inline h-3.5 w-3.5" />Board tools</button>
        <button data-ui-tone="info" aria-label="Open project or notes" onClick={() => importFile.current?.click()} className="rounded-lg p-1.5 text-xs text-neutral-300 hover:bg-neutral-800"><FolderOpen className="mr-1 inline h-3.5 w-3.5" />Open project</button>
        {onOpenUploadedFiles&&<button type="button" onClick={onOpenUploadedFiles} aria-label="Manage uploaded Markdown" className="rounded-lg p-2 text-xs"><HardDrive className="h-4 w-4"/>Uploaded files</button>}
        <RefreshWebApp onBeforeRefresh={onBeforeRefresh} recording={recording} />
        {collaboration}
        {viewMode !== "slides" && <>
        {/* Templates Button */}
        <button
          onClick={()=>runMenuAction(onOpenTemplates)}
          aria-label="Browse diagram templates" title="Browse Diagram Templates"
          className="px-2.5 py-1 rounded border border-neutral-200 dark:border-neutral-500/40 bg-neutral-50 dark:bg-neutral-500/15 text-neutral-700 dark:text-neutral-200 text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white transition cursor-pointer"
        >
          <LayoutTemplate className="w-3.5 h-3.5" />
          <span>Templates</span>
        </button>

        {/* Clear Board Button */}
        <button data-ui-tone="danger"
          onClick={() => setClearOpen(true)}
          aria-label="Clear board"
          title="Clear this board and its notes"
          className="flex p-1.5 rounded-lg hover:bg-neutral-500/10 text-neutral-600 dark:text-neutral-200 hover:text-neutral-400 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /><span>Clear board</span>
        </button>

        {/* Snap to Grid Toggle */}
        <button
          onClick={onToggleSnap}
          title={snapToGrid ? "Snap to Grid: ON" : "Snap to Grid: OFF"}
          aria-label="Snap to grid"
          aria-pressed={snapToGrid}
          className={`flex p-1.5 rounded-lg text-xs transition cursor-pointer ${
            snapToGrid
              ? "bg-neutral-500/15 text-neutral-400 border border-neutral-500/30"
              : "hover:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:text-white"
          }`}
        >
          <Magnet className="w-3.5 h-3.5" /><span>Snap to grid</span>
        </button>

        {/* Grid Style Toggle */}
        <button
          onClick={cycleGrid}
          title={`Grid Mode: ${gridType.toUpperCase()}`}
          aria-label="Cycle grid style"
          className="flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:text-white transition cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" /><span>{gridType==="dot"?"Dotted canvas":gridType==="grid"?"Grid canvas":"Plain canvas"}</span>
        </button>

        {/* Presentation / Zen Mode */}
        <button
          onClick={onTogglePresentation}
          title="Present frames"
          aria-label="Start presentation"
          className="flex p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:text-white transition cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" /><span>Present frames</span>
        </button>

        </>}
        <button
          onClick={()=>runMenuAction(onShowShortcuts)}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:text-white transition cursor-pointer text-xs font-bold w-7"
        >
          <Keyboard className="h-4 w-4"/><span>Shortcuts</span>
        </button>

        <InstallWebApp />

      </div>
      <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} onConfirm={onClearBoard} />
    </header>
  );
}
