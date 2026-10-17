"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomSession, type Collaborator } from "@/lib/collaboration";
import { Classroom } from "./Classroom";
import { CollaborationPanel } from "./CollaborationPanel";
import { CanvasEngine } from "@/draw/CanvasEngine";
import { setFont } from "@/draw/renderer";
import {
  Tool,
  ViewMode,
  CanvasElement,
  Theme,
  GridType,
  Board,
  BoardSummary,
  ElementStyleProps,
  InlineTextState,
  DEFAULT_STYLE,
} from "@/draw/types";
import {
  getWorkspaces,
  createWorkspace,
  moveBoardToWorkspace,
  getOrCreateDefaultBoard,
  getOrCreatePersonalBoard,
  getBoard,
  saveBoard,
  getAllBoards,
  createBoard,
  clearBoard,
  duplicateBoard,
  deleteBoard,
  importBoardFile,
  setActiveBoardId,
} from "@/lib/storage";
import { exportToSvg } from "@/draw/svgExport";
import { exportToDrawio } from "@/draw/drawioExport";
import { exportToPng, copyPngToClipboard, exportToJson, exportNotesToMarkdown, exportProjectFile } from "@/draw/export";
import { TemplateDefinition } from "@/draw/templatesData";
import { BoardHeader } from "./BoardHeader";
import { DocEditor } from "./DocEditor";
import { TopToolbar } from "./TopToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import { IconPickerModal } from "./IconPickerModal";
import { TemplatesModal } from "./TemplatesModal";
import { BoardsSidebar } from "./BoardsSidebar";
import { ZoomBar } from "./ZoomBar";
import { CodeEditor } from "./CodeEditor";
import { BoardTools } from "./BoardTools";
import { saveVersion } from "@/lib/boardLibrary";
import { PresentationMode } from "./PresentationMode";
import { ShortcutsModal } from "./ShortcutsModal";

const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function Canvas({ initialRoomId }: { initialRoomId?: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Board state. boardRef mirrors the latest board so engine callbacks never read a stale copy.
  const [board, setBoard] = useState<Board>(() => {
    if (initialRoomId) {
      const existing = getBoard(initialRoomId);
      if (existing) return existing;
      return createBoard("Shared whiteboard", undefined, "personal", initialRoomId);
    }
    return getOrCreateDefaultBoard();
  });
  const boardRef = useRef(board);
  const sessionRef = useRef<RoomSession | null>(null);
  const [roomStatus, setRoomStatus] = useState("connecting");
  const [roomReady, setRoomReady] = useState(!initialRoomId);
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [workspaces, setWorkspaces] = useState(getWorkspaces);
  const [workspaceId, setWorkspaceId] = useState(board.workspaceId || "personal");
  const viewMode = board.viewMode || "canvas";
  const [notesWidth, setNotesWidth] = useState(360);
  const [notesHeight, setNotesHeight] = useState(300);
  const [splitBounds, setSplitBounds] = useState({ width: 900, height: 700 });
  const narrowSplit = splitBounds.width < 640;
  const splitRef = useRef<HTMLElement>(null);
  const clampNotesWidth = (width: number) => Math.max(220, Math.min(width, splitBounds.width - 280));
  useEffect(() => {
    const element = splitRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSplitBounds({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);


  const [boardsList, setBoardsList] = useState<BoardSummary[]>(() => getAllBoards());
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [toolbarHeight, setToolbarHeight] = useState(44);
  const [selectedElements, setSelectedElements] = useState<CanvasElement[]>([]);
  const [zoom, setZoom] = useState(1);
  const theme: Theme = "dark";
  const [gridType, setGridType] = useState<GridType>(board.gridType || "dot");
  const [snapToGrid, setSnapToGrid] = useState<boolean>(board.snapToGrid || false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const presentationViewport = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);
  const [boardToolsOpen, setBoardToolsOpen] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [noteFocus, setNoteFocus] = useState<{ start: number; end: number; token: number } | undefined>();
  const frames = useMemo(() => board.elements.filter(el => el.type === "frame"), [board.elements]);
  const presentationFrames = JSON.stringify(frames.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })));
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [saveError, setSaveError] = useState(false);
  const [codeViewport, setCodeViewport] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [codeId, setCodeId] = useState<string | null>(null);
  const codeElement = board.elements.find(el => el.id === codeId && el.type === "text" && el.isCodeCard);
  const [inlineText, setInlineText] = useState<InlineTextState | null>(null);
  const [currentStyle, setCurrentStyle] = useState<ElementStyleProps>({ ...DEFAULT_STYLE });

  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const librarySelection = useMemo(() => { if (!selectedElements.length) return []; const ids = new Set(selectedElements.map(el => el.id)); return board.elements.filter(el => ids.has(el.id) || el.type === "text" && !!el.containerId && ids.has(el.containerId)); }, [selectedElements, board.elements]);

  const persist = useCallback((next: Board) => {
    try { if (saveVersion(boardRef.current, "Automatic checkpoint", true)) setHistoryError(""); } catch (error) { setHistoryError(error instanceof Error ? error.message : "Automatic history could not be saved."); }
    boardRef.current = next;
    setSaveError(!saveBoard(next));
    setBoard(next);
    sessionRef.current?.update(next);
  }, []);

  const refreshBoardsList = useCallback(() => setBoardsList(getAllBoards()), []);

  // Multi-tab sync: reload the active board when another tab changes it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("excali_eraser_board_")) {
        const current = getBoard(boardRef.current.id);
        if (current && e.key === `excali_eraser_board_${current.id}`) {
          boardRef.current = current;
          setBoard(current);
          engineRef.current?.setElements(current.elements, false);
        }
      }
      setWorkspaces(getWorkspaces());
      refreshBoardsList();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshBoardsList]);

  // Dark mode: toggle the `dark` class on <html> so Tailwind's dark: variant follows the app toggle.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  // Retire caches from the previous installable version without touching boards.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const retiredWorker = new URL("/sw.js", window.location.origin).href;
      navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
        registrations.filter(registration => [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === retiredWorker)).map(registration => registration.unregister())
      )).catch(() => undefined);
    }
    if ("caches" in window) caches.keys().then(keys => Promise.all(keys.filter(key => /^whiteboard-v\d+$/.test(key)).map(key => caches.delete(key)))).catch(() => undefined);
  }, []);

  // Create the engine once, and keep the canvas sized to its container (layout and DPR changes).
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const engine = new CanvasEngine(canvasRef.current, boardRef.current.elements, boardRef.current.theme, boardRef.current.gridType);
    engine.resize(container.clientWidth, container.clientHeight);
    engineRef.current = engine;
    const observer = new ResizeObserver(() => engine.resize(container.clientWidth, container.clientHeight));
    observer.observe(container);

    engine.onChange = (elements) => {
      persist({ ...boardRef.current, elements });
      refreshBoardsList();
    };
    engine.onSelectionChange = (selected) => setSelectedElements(selected);
    engine.onOpenIconPicker = () => setIsIconPickerOpen(true);
    engine.onEditCode = setCodeId;
    engine.onViewportChange = view => setCodeViewport(previous => previous.zoom === view.zoom && previous.pan.x === view.pan.x && previous.pan.y === view.pan.y ? previous : view);
    engine.onStartInlineText = (state) => setInlineText(state);
    engine.onZoomChange = (z) => setZoom(z);
    engine.onToolChange = (t) => setSelectedTool(t);
    engine.onHistoryChange = (u, r) => {
      if (!sessionRef.current) { setCanUndo(u); setCanRedo(r); }
    };

    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [persist, refreshBoardsList]);

  useEffect(() => {
    if (!initialRoomId) return;
    const url = process.env.NEXT_PUBLIC_COLLAB_URL || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/collaboration`;
    const session = new RoomSession(url, initialRoomId, boardRef.current);
    sessionRef.current = session;
    session.onStatus = setRoomStatus;
    session.onRemote = (elements, markdownNotes, title) => {
      const next = { ...boardRef.current, elements, markdownNotes, title };
      boardRef.current = next; setBoard(next); setSaveError(!saveBoard(next));
      engineRef.current?.applyRemoteElements(elements); setRoomReady(true); refreshBoardsList();
    };
    session.onPresence = people => { setPeople(people); engineRef.current?.setCollaborators(people); };
    session.onHistory = (undo, redo) => { setCanUndo(undo); setCanRedo(redo); };
    const engine = engineRef.current;
    let lastCursor = 0;
    if (engine) {
      engine.collaborativeUndo = () => session.undo.undo(); engine.collaborativeRedo = () => session.undo.redo();
      engine.onCursorChange = point => { if (Date.now() - lastCursor > 50) { lastCursor = Date.now(); session.cursor(point); } };
    }
    session.connect();
    return () => { session.destroy(); sessionRef.current = null; if (engine) { engine.collaborativeUndo = undefined; engine.collaborativeRedo = undefined; engine.onCursorChange = undefined; } };
  }, [initialRoomId, refreshBoardsList]);

  // Keep engine settings in sync with React state.
  useEffect(() => {
    engineRef.current?.setTool(selectedTool);
  }, [selectedTool]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    engineRef.current?.setGridType(gridType);
  }, [gridType]);

  useEffect(() => {
    engineRef.current?.setSnapToGrid(snapToGrid);
  }, [snapToGrid]);

  // App-level shortcuts. Engine shortcuts (tools, undo, shapes) live in CanvasEngine.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !document.querySelector("dialog[open]")) { e.preventDefault(); setBoardToolsOpen(true); return; }
      if (isEditableTarget(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === "?" || (e.key === "/" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setIsShortcutsOpen((open) => !open);
      } else if (e.key === "Escape") {
        setBoardToolsOpen(false);
        setIsShortcutsOpen(false);
        setIsIconPickerOpen(false);
        setIsTemplatesOpen(false);
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLeaveRoom = () => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    const engine = engineRef.current;
    if (engine) {
      engine.onCursorChange = undefined;
      engine.collaborativeUndo = undefined; engine.collaborativeRedo = undefined;
      engine.setCollaborators([]);
    }
    getOrCreatePersonalBoard();
    router.push("/");
  };

  const beginPresentation = () => {
    engineRef.current?.finishCode(); setCodeId(null);
    presentationViewport.current = engineRef.current?.getViewport() || null;
    setPresentationIndex(0); setIsPresentationOpen(true); engineRef.current?.setReadOnly(true);
  };
  const endPresentation = () => {
    setIsPresentationOpen(false); engineRef.current?.setReadOnly(false);
    const view = presentationViewport.current; presentationViewport.current = null;
    if (view) requestAnimationFrame(() => engineRef.current?.restoreViewport(view));
  };
  useEffect(() => {
    if (!isPresentationOpen || !containerRef.current) return;
    const focus = () => { const element = containerRef.current; if (element) engineRef.current?.resize(element.clientWidth, element.clientHeight); const ordered = JSON.parse(presentationFrames) as { id: string }[]; const frame = ordered[Math.min(presentationIndex, Math.max(0, ordered.length - 1))]; if (frame) engineRef.current?.focusElements([frame.id], false); else engineRef.current?.fitToContent(); };
    const timer = requestAnimationFrame(focus);
    const observer = new ResizeObserver(focus); observer.observe(containerRef.current);
    return () => { cancelAnimationFrame(timer); observer.disconnect(); };
  }, [isPresentationOpen, presentationIndex, presentationFrames]);

  // Board actions
  const handleSelectBoard = (id: string) => {
    if (initialRoomId && id !== initialRoomId) { sessionRef.current?.destroy(); sessionRef.current = null; setActiveBoardId(id); router.push("/"); return; }
    const loaded = getBoard(id);
    if (!loaded) return;
    boardRef.current = loaded;
    setBoard(loaded);
    setSaveError(false);
    setActiveBoardId(loaded.id);
    setGridType(loaded.gridType || "dot");
    setSnapToGrid(loaded.snapToGrid || false);
    setWorkspaceId(loaded.workspaceId || "personal");
    setInlineText(null); setCodeId(null);
    engineRef.current?.setElements(loaded.elements, false);
    engineRef.current?.resetZoom();
    refreshBoardsList();
  };

  const handleCreateBoard = (title?: string) => {
    handleSelectBoard(createBoard(title, undefined, workspaceId).id);
  };

  const handleClearBoard = () => {
    const cleared = clearBoard(boardRef.current.id);
    if (cleared) {
      boardRef.current = cleared;
      setBoard(cleared);
      engineRef.current?.setElements([], true);
      refreshBoardsList();
    }
  };

  const handleDuplicateBoard = (id: string) => {
    const dup = duplicateBoard(id);
    if (dup) handleSelectBoard(dup.id);
  };

  const handleDeleteBoard = (id: string) => {
    deleteBoard(id);
    refreshBoardsList();
    if (boardRef.current.id === id) {
      handleSelectBoard(getOrCreateDefaultBoard().id);
    }
  };

  const handleRenameTitle = (newTitle: string) => {
    persist({ ...boardRef.current, title: newTitle });
    refreshBoardsList();
  };

  const handleSelectTemplate = (template: TemplateDefinition, replace: boolean) => {
    const fresh = JSON.parse(JSON.stringify(template.elements)) as CanvasElement[];

    // If template has documentation notes, render it directly on the canvas as a sleek Doc Card
    if (template.markdownNotes && template.markdownNotes.trim()) {
      const docCard: CanvasElement = {
        id: "doc-tmpl-" + Math.random().toString(36).substring(2, 9),
        type: "text",
        x: 40,
        y: 80,
        width: 380,
        height: 480,
        text: template.markdownNotes.trim(),
        fontSize: 14,
        fontFamily: "sans",
        textAlign: "left",
        stroke: "#FFFFFF",
        fill: "#18181B",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roundness: "rounded",
        opacity: 1,
        zIndex: 100,
        isDocCard: true,
        title: `${template.name} Architecture Doc`,
      };
      fresh.unshift(docCard);
    }

    const current = boardRef.current;
    const elements = replace ? fresh : [...current.elements, ...fresh];
    const markdownNotes = replace ? template.markdownNotes : `${current.markdownNotes}\n\n${template.markdownNotes}`;
    engineRef.current?.setElements(elements, true);
    persist({ ...boardRef.current, elements, markdownNotes });
    refreshBoardsList();
  };

  const handleChangeGridType = (g: GridType) => {
    setGridType(g);
    persist({ ...boardRef.current, gridType: g });
  };

  const handleToggleSnap = () => {
    const next = !snapToGrid;
    setSnapToGrid(next);
    persist({ ...boardRef.current, snapToGrid: next });
  };

  // Export
  const exportElements = (selection: boolean) => selection ? engineRef.current?.getSelectionForExport() || [] : engineRef.current?.getElements() || [];
  const handleExportPng = (selection: boolean, transparent: boolean, scale: number) => exportToPng(exportElements(selection), theme, transparent, scale, boardRef.current.elements);
  const handleCopyClipboard = async () => {
    return engineRef.current ? await copyPngToClipboard(engineRef.current.getElements(), theme) : false;
  };
  const handleExportJson = () => exportToJson(boardRef.current);
  const handleExportMarkdown = () => exportNotesToMarkdown(boardRef.current);
  const handleImportJson = (jsonStr: string, filename = "backup.json") => {
    const imported = importBoardFile(jsonStr, filename);
    if (imported) { moveBoardToWorkspace(imported.id, workspaceId); handleSelectBoard(imported.id); } else { throw new Error("Could not open this backup. Use a supported .knotleaf or board JSON file and check available browser storage."); }
  };

  // Inline text editing
  const commitInline = () => {
    if (inlineText && engineRef.current) engineRef.current.commitInlineText(inlineText);
    setInlineText(null);
  };

  const adjustInlineFontSize = (delta: number) => {
    setInlineText((prev) => (prev ? { ...prev, fontSize: Math.max(8, Math.min(96, prev.fontSize + delta)) } : prev));
  };

  // Floating document quick-format action
  const handleInsertPrefix = (prefix: string) => {
    if (!inlineTextareaRef.current || !inlineText) return;
    const textarea = inlineTextareaRef.current;
    const start = textarea.selectionStart;
    const val = textarea.value;

    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = val.indexOf("\n", start);
    if (lineEnd === -1) lineEnd = val.length;

    const currentLine = val.slice(lineStart, lineEnd);

    if (prefix === "---") {
      const newLine = currentLine.trim() ? `${currentLine}\n---\n` : "---\n";
      const nextVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd);
      setInlineText({ ...inlineText, text: nextVal });
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd = lineStart + newLine.length;
          textarea.focus();
        }
      }, 0);
      return;
    }

    // Strip any existing bullet/prefix
    const stripped = currentLine.replace(
      /^(\s*)(#+\s+|>\s*|(\-\s*|\*\s*)?\[[ xX]\]\s+|([•○▪◆–→]|\d+\.|\-|\*)\s*)/,
      "$1"
    );
    const leadingSpaces = currentLine.match(/^\s*/)?.[0] || "";
    const cleanContent = stripped.slice(leadingSpaces.length);

    const newLine = `${leadingSpaces}${prefix} ${cleanContent}`;
    const nextVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd);

    setInlineText({ ...inlineText, text: nextVal });
    setTimeout(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = lineStart + newLine.length;
        textarea.focus();
      }
    }, 0);
  };

  useEffect(() => {
    if (!inlineText) return;
    // Wait until the pointer's default focus sequence has finished before
    // moving focus from the canvas/toolbar to the newly mounted textarea.
    const frame = requestAnimationFrame(() => {
      const editor = inlineTextareaRef.current;
      if (!editor) return;
      editor.focus({ preventScroll: true });
      if (inlineText.caret !== undefined) editor.setSelectionRange(inlineText.caret, inlineText.caret);
      else if (inlineText.text) editor.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [inlineText?.elementId, inlineText?.kind, inlineText?.canvasX, inlineText?.canvasY]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateInlineStyle = (style: Partial<ElementStyleProps>) => {
    setInlineText(previous => previous ? {
      ...previous,
      ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
      ...(style.fontFamily !== undefined ? { fontFamily: style.fontFamily } : {}),
      ...(style.textAlign !== undefined ? { align: style.textAlign } : {}),
      ...(style.stroke !== undefined ? { color: style.stroke } : {}),
      ...Object.fromEntries((["bold", "italic", "underline", "strikethrough"] as const).filter(key => style[key] !== undefined).map(key => [key, style[key]])),
    } : null);
  };
  const isInlineTextual = !!inlineText && ["new-text", "text", "sticky"].includes(inlineText.kind);
  const textOptionsVisible = selectedTool === "text" || isInlineTextual;
  useEffect(() => {
    const editor = inlineTextareaRef.current;
    if (!editor || !inlineText) return;
    if (inlineText.kind === "text" || inlineText.kind === "new-text") {
      const context = canvasRef.current?.getContext("2d");
      if (context) {
        context.save();
        setFont(context, inlineText.fontSize, inlineText.fontFamily, inlineText.bold ? 700 : 400, inlineText.italic);
        const width = Math.max(inlineText.fontSize * 2, ...inlineText.text.split("\n").map(line => context.measureText(line).width)) + 12;
        editor.style.width = `${Math.ceil(width) * zoom}px`;
        context.restore();
      }
    }
    editor.style.height = "auto";
    const available = Math.max(80, (containerRef.current?.clientHeight || 600) - inlineText.screenY - 12);
    editor.style.height = `${Math.min(available, Math.max(editor.scrollHeight, inlineText.screenHeight || 0))}px`;
    editor.style.overflowY = editor.scrollHeight > available ? "auto" : "hidden";
  }, [inlineText?.text, inlineText?.fontSize, inlineText?.fontFamily, inlineText?.bold, inlineText?.italic, inlineText?.screenHeight, inlineText?.screenY, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const inlineTextAlign = inlineText?.align ?? "left";
  const createSharedRoom = async (openClassroom = false) => {
    const response = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(boardRef.current) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save the room.");
    saveBoard({ ...boardRef.current, id: data.id, title: data.title, createdAt: Date.now() });
    router.push(`/canvas/${data.id}${openClassroom ? "?classroom=1" : ""}`);
  };

  const inlineFamily =
    inlineText?.fontFamily === "hand" ? "var(--font-caveat), Caveat, cursive" : inlineText?.fontFamily === "mono" ? "var(--font-fira), 'Fira Code', monospace" : "var(--font-inter), Inter, sans-serif";

  return (
    <div
      className="relative w-screen h-[100dvh] overflow-hidden flex flex-col font-sans select-none bg-[#121212] text-white"
    >
      {!isPresentationOpen && (
        <BoardHeader
          collaboration={<><Classroom key={initialRoomId || "personal"} roomId={initialRoomId} onCreateRoom={() => createSharedRoom(true)} /><CollaborationPanel roomId={initialRoomId} onLeave={handleLeaveRoom} status={roomStatus} people={people} onName={name => sessionRef.current?.setName(name)} onJoin={id => router.push(`/canvas/${id}`)} onCreate={() => createSharedRoom()} /></>}
          title={board.title}
          saveError={saveError}
          onRetrySave={() => persist(boardRef.current)}
          viewMode={viewMode}
          onChangeViewMode={(mode: ViewMode) => persist({ ...boardRef.current, viewMode: mode })}
          onRenameTitle={handleRenameTitle}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          onOpenBoardTools={() => setBoardToolsOpen(true)}
          onClearBoard={handleClearBoard}
          gridType={gridType}
          onChangeGridType={handleChangeGridType}
          snapToGrid={snapToGrid}
          onToggleSnap={handleToggleSnap}
          selectionCount={selectedElements.length}
          onExportSvg={(selection, transparent) => exportToSvg(boardRef.current, exportElements(selection), transparent)}
          onExportDrawio={selection => exportToDrawio(boardRef.current, exportElements(selection))}
          onExportPng={handleExportPng}
          onExportProject={scope => exportProjectFile(boardRef.current, scope)}
          onExportPdf={async scope => { const snapshot = structuredClone(boardRef.current); const { exportProjectPdf } = await import("@/draw/projectPdf"); await exportProjectPdf(snapshot, scope); }}
          onImportFile={handleImportJson}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onCopyClipboard={handleCopyClipboard}
          onTogglePresentation={beginPresentation}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
        />
      )}

      <main inert={!roomReady} ref={splitRef} className={`relative flex max-sm:flex-col min-h-0 flex-1 w-full overflow-hidden ${!isPresentationOpen ? "mt-11" : ""}`} >
        {viewMode !== "canvas" && !isPresentationOpen && <section aria-label="Board notes" style={viewMode === "split" ? narrowSplit ? { width: "100%", height: Math.min(notesHeight, splitBounds.height - 160) } : { width: Math.min(notesWidth, splitBounds.width - 280) } : undefined} className={`board-notes min-h-0 ${viewMode === "notes" ? "w-full" : "shrink-0"}`}><DocEditor key={noteFocus?.token || 0} focusRange={noteFocus} value={board.markdownNotes || ""} onChange={markdownNotes => persist({ ...boardRef.current, markdownNotes })} onExportMarkdown={handleExportMarkdown} theme={theme} /></section>}
        {viewMode === "split" && !isPresentationOpen && <div role="separator" aria-label="Resize notes panel" aria-orientation={narrowSplit ? "horizontal" : "vertical"} aria-valuemin={narrowSplit ? 160 : 220} aria-valuemax={narrowSplit ? Math.max(160, splitBounds.height - 160) : Math.max(220, splitBounds.width - 280)} aria-valuenow={Math.round(narrowSplit ? notesHeight : notesWidth)} tabIndex={0} className={`split-handle z-30 shrink-0 touch-none bg-neutral-800 hover:bg-blue-500 focus-visible:bg-blue-500 focus-visible:outline-none ${narrowSplit ? "h-1.5 w-full cursor-row-resize" : "w-1.5 cursor-col-resize"}`} onDoubleClick={() => { setNotesWidth(360); setNotesHeight(300); }} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
          e.preventDefault(); e.stopPropagation();
          const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 20 : -20;
          if (narrowSplit) setNotesHeight(h => Math.max(160, Math.min(e.key === "Home" ? 160 : e.key === "End" ? Infinity : h + delta, splitBounds.height - 160)));
          else setNotesWidth(w => clampNotesWidth(e.key === "Home" ? 220 : e.key === "End" ? Infinity : w + delta));
        } }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const bounds = splitRef.current?.getBoundingClientRect(); if (bounds) { if (narrowSplit) setNotesHeight(Math.max(160, Math.min(e.clientY - bounds.top, bounds.height - 160))); else setNotesWidth(clampNotesWidth(e.clientX - bounds.left)); } }} onPointerUp={e => { e.currentTarget.releasePointerCapture(e.pointerId); }} />}

        <div
          ref={containerRef}
          className={`relative min-h-0 min-w-0 flex-1 h-full overflow-hidden bg-[#121212] ${viewMode === "notes" && !isPresentationOpen ? "hidden" : ""}`}
        >
            <canvas ref={canvasRef} className="block touch-none" />

            {codeElement?.type === "text" && <CodeEditor key={codeElement.id} value={codeElement.text} language={codeElement.codeLanguage || "auto"} fontSize={codeElement.fontSize} zoom={codeViewport.zoom} x={(codeElement.x - 16) * codeViewport.zoom + codeViewport.pan.x} y={(codeElement.y - 16) * codeViewport.zoom + codeViewport.pan.y} width={codeElement.width} height={codeElement.height} onChange={(text, language) => engineRef.current?.updateCode(codeElement.id, text, language)} onClose={() => { engineRef.current?.finishCode(); setCodeId(null); }} />}
            {inlineText && (
              <>
                {/* Document-specific list tools; ordinary canvas text stays unobstructed. */}
                {selectedElement?.type === "text" && selectedElement.isDocCard && <div
                  onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
                  style={{
                    position: "absolute",
                    left: `${Math.max(16, inlineText.screenX)}px`,
                    top: `${Math.max(10, inlineText.screenY - 38)}px`,
                    zIndex: 40,
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#18181b]/95 border border-[#27272a] shadow-2xl backdrop-blur-md select-none text-[11px]"
                >
                  <span className="text-[10px] uppercase font-bold text-neutral-400 mr-0.5">
                    Doc:
                  </span>
                  <button
                    onClick={() => handleInsertPrefix("•")}
                    title="Disc bullet (• item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    • Disc
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("○")}
                    title="Circle bullet (○ item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    ○ Circ
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("▪")}
                    title="Square bullet (▪ item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    ▪ Sq
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("◆")}
                    title="Diamond bullet (◆ item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    ◆ Diam
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("–")}
                    title="Dash bullet (– item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    – Dash
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("→")}
                    title="Arrow bullet (→ item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-bold transition cursor-pointer"
                  >
                    → Arrow
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("1.")}
                    title="Numbered list (1. item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-medium transition cursor-pointer"
                  >
                    1. Num
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("[ ]")}
                    title="Task checkbox ([ ] item)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-200 font-medium transition cursor-pointer"
                  >
                    ☑ Task
                  </button>
                  <div className="w-px h-3.5 bg-neutral-700 mx-0.5" />
                  <button
                    onClick={() => handleInsertPrefix("#")}
                    title="Heading 1 (# text)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 font-bold transition cursor-pointer"
                  >
                    H1
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("##")}
                    title="Heading 2 (## text)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-blue-400 font-bold transition cursor-pointer"
                  >
                    H2
                  </button>
                  <button
                    onClick={() => handleInsertPrefix(">")}
                    title="Blockquote (> text)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-purple-400 font-medium transition cursor-pointer"
                  >
                    Quote
                  </button>
                  <button
                    onClick={() => handleInsertPrefix("---")}
                    title="Divider line (---)"
                    className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-amber-400 font-medium transition cursor-pointer"
                  >
                    Rule
                  </button>
                </div>}

                <textarea
                  className="resize-none select-text"
                  ref={inlineTextareaRef}
                  value={inlineText.text}
                  aria-label="Edit text"
                  onChange={(e) => setInlineText((prev) => (prev ? { ...prev, text: e.target.value } : null))}
                  onBlur={commitInline}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    const mod = e.ctrlKey || e.metaKey;
                    const key = e.key.toLowerCase();
                    const format = key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : key === "x" && e.shiftKey ? "strikethrough" : null;
                    if (mod && format && isInlineTextual) {
                      e.preventDefault();
                      e.stopPropagation();
                      setInlineText(previous => previous ? { ...previous, [format]: !previous[format] } : null);
                      return;
                    }
                    if (e.key === "Escape" || (e.key === "Enter" && mod)) {
                      e.preventDefault();
                      commitInline();
                      return;
                    }
                    if (mod && e.shiftKey && (e.key === ">" || e.key === ".")) {
                      e.preventDefault();
                      adjustInlineFontSize(2);
                      return;
                    }
                    if (mod && e.shiftKey && (e.key === "<" || e.key === ",")) {
                      e.preventDefault();
                      adjustInlineFontSize(-2);
                      return;
                    }

                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;

                    // Handle Tab and Shift+Tab for list indentation
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
                      const currentLine = val.slice(lineStart, end);
                      if (e.shiftKey) {
                        // Outdent (remove up to 2 leading spaces)
                        if (currentLine.startsWith("  ")) {
                          const nextVal = val.slice(0, lineStart) + currentLine.slice(2) + val.slice(end);
                          setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                          setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
                          }, 0);
                        }
                      } else {
                        // Indent (add 2 spaces)
                        const nextVal = val.slice(0, lineStart) + "  " + val.slice(lineStart);
                        setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 2;
                        }, 0);
                      }
                      return;
                    }

                    // Handle Enter on bullet / list / checklist lines
                    if (e.key === "Enter" && !e.shiftKey && !mod) {
                      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
                      const currentLine = val.slice(lineStart, start);

                      // 1. Check for empty bullet item: clear bullet on Enter
                      const emptyBulletMatch = currentLine.match(/^(\s*)([•○▪◆–→]|\d+\.|\[[ xX]\])\s*$/);
                      if (emptyBulletMatch) {
                        e.preventDefault();
                        const nextVal = val.slice(0, lineStart) + emptyBulletMatch[1] + val.slice(start);
                        setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = lineStart + emptyBulletMatch[1].length;
                        }, 0);
                        return;
                      }

                      // 2. Check for bullet list item: •, ○, ▪, ◆, –, →, -, *
                      const bulletMatch = currentLine.match(/^(\s*)([•○▪◆–→]|\-|\*)\s+(.+)$/);
                      if (bulletMatch) {
                        e.preventDefault();
                        const indent = bulletMatch[1];
                        const symbol = bulletMatch[2];
                        const nextVal = val.slice(0, start) + "\n" + indent + symbol + " " + val.slice(end);
                        setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + symbol.length + 1;
                        }, 0);
                        return;
                      }

                      // 3. Check for numbered list item: 1. 2. ...
                      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
                      if (numMatch) {
                        e.preventDefault();
                        const indent = numMatch[1];
                        const nextNum = parseInt(numMatch[2], 10) + 1;
                        const prefix = `${indent}${nextNum}. `;
                        const nextVal = val.slice(0, start) + "\n" + prefix + val.slice(end);
                        setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1 + prefix.length;
                        }, 0);
                        return;
                      }

                      // 4. Check for checklist item: [ ] or [x]
                      const checkMatch = currentLine.match(/^(\s*)\[[ xX]\]\s+(.+)$/);
                      if (checkMatch) {
                        e.preventDefault();
                        const indent = checkMatch[1];
                        const prefix = `${indent}[ ] `;
                        const nextVal = val.slice(0, start) + "\n" + prefix + val.slice(end);
                        setInlineText((prev) => (prev ? { ...prev, text: nextVal } : null));
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1 + prefix.length;
                        }, 0);
                        return;
                      }
                    }
                  }}
                  placeholder={inlineText.kind === "sticky" ? "Write a sticky note…" : "Type here…"}
                  wrap={inlineText.kind === "sticky" ? "soft" : "off"}
                  spellCheck={false}
                  style={{
                    position: "absolute",
                    left: `${inlineText.screenX}px`,
                    top: `${inlineText.screenY}px`,
                    width: `${inlineText.screenWidth ?? Math.max(160, Math.max(...inlineText.text.split("\n").map((l) => l.length), 6) * inlineText.fontSize * zoom * 0.62 + 32)}px`,
                    minHeight: inlineText.screenHeight ? `${inlineText.screenHeight}px` : `${inlineText.fontSize * zoom * 1.5 + 16}px`,
                    fontSize: `${inlineText.fontSize * zoom}px`,
                    lineHeight: 1.35,
                    fontFamily: inlineFamily,
                    fontWeight: inlineText.bold ? 700 : 400,
                    fontStyle: inlineText.italic ? "italic" : "normal",
                    textDecoration: [inlineText.underline && "underline", inlineText.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
                    textAlign: inlineTextAlign,
                    color: inlineText.color || "#FFFFFF",
                    zIndex: 35,
                    background: inlineText.kind === "sticky" ? selectedElement?.type === "sticky" ? selectedElement.color : "#FEF08A" : "transparent",
                    border: "none",
                    borderRadius: 0,
                    padding: 0,
                    outline: "none",
                    resize: "none",
                    overflow: "hidden",
                    boxShadow: "none",
                  }}
                />
              </>
            )}

            {!isPresentationOpen && (
              <TopToolbar
                onHeightChange={setToolbarHeight}
                selectedTool={selectedTool}
                setSelectedTool={tool => { engineRef.current?.setTool(tool); setSelectedTool(tool); }}
                onUndo={() => engineRef.current?.undo()}
                onRedo={() => engineRef.current?.redo()}
                canUndo={canUndo}
                canRedo={canRedo}
                onOpenIconPicker={() => setIsIconPickerOpen(true)}
                theme={theme}
              />
            )}

            {!isPresentationOpen && (
              <PropertiesPanel
                topOffset={toolbarHeight + 12}
                selectedTool={selectedTool}
                isTextEditing={textOptionsVisible}
                preserveTextFocus={isInlineTextual}
                selectedElement={isInlineTextual && selectedElement && (selectedElement.type === "text" || selectedElement.type === "sticky") ? { ...selectedElement, fontSize: inlineText!.fontSize, fontFamily: inlineText!.fontFamily, textAlign: inlineText!.align, stroke: inlineText!.color, bold: inlineText!.bold, italic: inlineText!.italic, underline: inlineText!.underline, strikethrough: inlineText!.strikethrough, text: inlineText!.text } : selectedTool === "text" ? null : selectedElement}
                selectionCount={selectedElements.length}
                currentStyle={isInlineTextual ? { ...currentStyle, fontSize: inlineText!.fontSize, fontFamily: inlineText!.fontFamily, textAlign: inlineText!.align, stroke: inlineText!.color, bold: inlineText!.bold, italic: inlineText!.italic, underline: inlineText!.underline, strikethrough: inlineText!.strikethrough } : currentStyle}
                onUpdateStyle={(st) => {
                  if (isInlineTextual) updateInlineStyle(st);
                  setCurrentStyle((prev) => ({ ...prev, ...st }));
                  if (engineRef.current) engineRef.current.currentStyle = { ...engineRef.current.currentStyle, ...st };
                }}
                onUpdateElement={(props) => {
                  if (isInlineTextual && "text" in props && typeof props.text === "string") setInlineText(previous => previous ? { ...previous, text: props.text! } : null);
                  if (inlineText?.kind !== "new-text" && selectedTool !== "text") engineRef.current?.updateSelectedElement(props);
                }}
                onDuplicate={() => engineRef.current?.duplicateSelected()}
                onDelete={() => engineRef.current?.deleteSelected()}
                onBringToFront={() => engineRef.current?.bringToFront()}
                onSendToBack={() => engineRef.current?.sendToBack()}
                onSwapArrow={() => engineRef.current?.swapSelectedArrows()}
                onChangeFontSize={delta => {
                  if (isInlineTextual) adjustInlineFontSize(delta);
                  else {
                    engineRef.current?.changeFontSize(delta);
                    if (engineRef.current) setCurrentStyle({ ...engineRef.current.currentStyle });
                  }
                }}
                theme={theme}
              />
            )}

            {!isPresentationOpen && selectedElements.length > 1 && <div role="toolbar" aria-label="Arrange selection" className="absolute bottom-16 left-2 z-30 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1.5 text-xs text-neutral-300 shadow-lg">
              <button onClick={() => engineRef.current?.connectSelected()} className="rounded px-2 py-1.5 text-blue-400 hover:bg-neutral-800">Connect selected</button>
              <span className="h-4 w-px bg-neutral-700" />
              <button onClick={() => engineRef.current?.arrangeSelected("left")} className="rounded px-2 py-1.5 hover:bg-neutral-800">Align left</button>
              <button onClick={() => engineRef.current?.arrangeSelected("top")} className="rounded px-2 py-1.5 hover:bg-neutral-800">Align top</button>
              <button disabled={selectedElements.length < 3} onClick={() => engineRef.current?.arrangeSelected("horizontal")} className="rounded px-2 py-1.5 hover:bg-neutral-800 disabled:opacity-40">Space evenly</button>
            </div>}

            {!isPresentationOpen && (
              <ZoomBar
                zoom={zoom}
                onZoomIn={() => engineRef.current?.zoomIn()}
                onZoomOut={() => engineRef.current?.zoomOut()}
                onResetZoom={() => engineRef.current?.resetZoom()}
                onFitToContent={() => engineRef.current?.fitToContent()}
                theme={theme}
              />
            )}
        </div>
      </main>

      {initialRoomId && !roomReady && <div role="status" className="fixed left-1/2 top-20 z-40 w-[min(400px,90vw)] -translate-x-1/2 rounded-xl border border-amber-500/30 bg-neutral-900 p-4 text-center text-sm text-neutral-300"><p>Connecting to your room…</p><p className="mt-2 text-xs text-neutral-500">Start the collaboration server or check your connection. Drawing unlocks after the room syncs.</p><button onClick={handleLeaveRoom} className="mt-3 inline-block text-xs text-blue-400 underline">Leave room</button></div>}
      <PresentationMode isActive={isPresentationOpen} onExit={endPresentation} title={board.title} theme={theme} frames={frames} index={presentationIndex} onIndex={setPresentationIndex} />
      <BoardTools open={boardToolsOpen} onClose={() => setBoardToolsOpen(false)} board={board} selection={librarySelection} historyError={historyError} onHistorySaved={() => setHistoryError("")} onOpenCopy={(source, title) => { const copy = importBoardFile(JSON.stringify({ ...source, title })); if (!copy) throw new Error("Could not create a board. Check available browser storage."); copy.title = title; if (!saveBoard(copy)) throw new Error("Could not save the new board."); moveBoardToWorkspace(copy.id, workspaceId); handleSelectBoard(copy.id); }} onFind={(id, index, length) => {
        if (index !== undefined) {
          persist({ ...boardRef.current, viewMode: "notes" });
          setNoteFocus(previous => ({ start: index, end: index + (length || 0), token: (previous?.token || 0) + 1 }));
        } else { if (board.viewMode === "notes") persist({ ...boardRef.current, viewMode: "canvas" }); requestAnimationFrame(() => { const element = containerRef.current; if (element) engineRef.current?.resize(element.clientWidth, element.clientHeight); engineRef.current?.focusElements([id]); }); }
      }} />

      <IconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        onSelectIcon={(iconId) => engineRef.current?.addIconElement(iconId)}
        onSelectOnline={(name, id, svg, viewBox) => engineRef.current?.addOnlineIcon(name, id, svg, viewBox)}
        theme={theme}
      />

      <TemplatesModal isOpen={isTemplatesOpen} onClose={() => setIsTemplatesOpen(false)} onSelectTemplate={handleSelectTemplate} theme={theme} />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} theme={theme} />

      <BoardsSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        workspaces={workspaces}
        workspaceId={workspaceId}
        onChangeWorkspace={setWorkspaceId}
        onCreateWorkspace={name => { const workspace = createWorkspace(name); setWorkspaces(getWorkspaces()); setWorkspaceId(workspace.id); }}
        onMoveBoard={(id, nextWorkspace) => { moveBoardToWorkspace(id, nextWorkspace); if (id === board.id) { const updated = getBoard(id); if (updated) { boardRef.current = updated; setBoard(updated); } } refreshBoardsList(); }}
        boards={boardsList}
        activeBoardId={board.id}
        onSelectBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        onDuplicateBoard={handleDuplicateBoard}
        onDeleteBoard={handleDeleteBoard}
        onImportJson={handleImportJson}
        theme={theme}
      />
    </div>
  );
}
