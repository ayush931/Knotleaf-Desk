"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Download, Ellipsis, Eraser, Hand, Maximize2, Minus, PenLine, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { CanvasEngine } from "@/draw/CanvasEngine";
import { canvasBackground } from "@/draw/canvasAppearance";
import { INK_STYLES, DEFAULT_INK_STYLE } from "@/draw/ink";
import type { InkStyle, PencilElement, Theme } from "@/draw/types";
import { PREMIUM_STROKES } from "@/lib/premiumPalette";
import { getBoard, updateBoardContent } from "@/lib/storage";
import { ConfirmDialog } from "./ConfirmDialog";

type WritingTool = "pencil" | "eraser" | "hand";
type InkOptions = { color: string; width: number; style: InkStyle };
const INK_KEY = "knotleaf.writing.ink";
const drafts = new Map<string, { strokes: PencilElement[]; base: string; error: string }>();
const tools = [
  { id: "pencil", name: "Pen", icon: PenLine },
  { id: "eraser", name: "Eraser", icon: Eraser },
  { id: "hand", name: "Pan", icon: Hand },
] as const;

function readInk(): InkOptions {
  const defaults = { color: "#ffffff", width: 3, style: DEFAULT_INK_STYLE };
  try {
    const value = JSON.parse(localStorage.getItem(INK_KEY) || "null");
    return {
      color: /^#[0-9a-f]{6}$/i.test(value?.color) ? value.color : defaults.color,
      width: Number.isFinite(value?.width) && value.width >= 1 && value.width <= 24 ? value.width : defaults.width,
      style: INK_STYLES.find(style => style.id === value?.style)?.id ?? defaults.style,
    };
  } catch { return defaults; }
}

export function WritingWorkspace({ boardId, title, theme, initialStrokes, onChange }: {
  boardId: string;
  title: string;
  theme: Theme;
  initialStrokes: PencilElement[];
  onChange: (strokes: PencilElement[]) => void;
}) {
  const [initial] = useState(() => drafts.get(boardId) ?? { strokes: initialStrokes, base: JSON.stringify(initialStrokes), error: "" });
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CanvasEngine | null>(null);
  const callback = useRef(onChange);
  const saved = useRef(initial.base);
  const [latest, setLatest] = useState(initial.strokes);
  const [ink, setInk] = useState(readInk);
  const [tool, setTool] = useState<WritingTool>("pencil");
  const [eraserWidth, setEraserWidth] = useState(24);
  const [history, setHistory] = useState({ undo: false, redo: false });
  const [zoom, setZoom] = useState(100);
  const [saveError, setSaveError] = useState(initial.error);
  const [error, setError] = useState("");
  const [clear, setClear] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuTrigger = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [ready, setReady] = useState(false);
  const heading = useId();

  useEffect(() => { callback.current = onChange; }, [onChange]);

  useEffect(() => {
    const sheet = canvas.current;
    if (!sheet) return;
    let drawing: CanvasEngine;
    try {
      drawing = new CanvasEngine(sheet, initial.strokes, "light", "dot", canvasBackground(undefined, "light"));
    } catch {
      setError("This browser could not open the drawing surface.");
      return;
    }
    engine.current = drawing;
    drawing.setKeyboardEnabled(false);
    drawing.setPencilDotsEnabled(true);
    drawing.setTool("pencil");
    drawing.onHistoryChange = (undo, redo) => setHistory({ undo, redo });
    drawing.onZoomChange = value => setZoom(Math.round(value * 100));
    const visibility = () => drawing.setRenderingActive(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", visibility);
    const observer = new ResizeObserver(() => drawing.resize(sheet.clientWidth, sheet.clientHeight));
    observer.observe(sheet);
    setReady(true);
    return () => {
      engine.current = null;
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      drawing.destroy();
    };
  }, [initial]);

  function persist(strokes: PencilElement[]) {
    const serialized = JSON.stringify(strokes);
    if (serialized === saved.current) {
      drafts.delete(boardId);
      setSaveError("");
      return;
    }
    try {
      updateBoardContent(boardId, "writing", existing => {
        if (JSON.stringify(existing) !== saved.current) {
          throw new Error("This sheet changed in another tab. Export this draft as PNG to keep a copy, then reopen the latest sheet.");
        }
        return strokes;
      });
      saved.current = serialized;
      drafts.delete(boardId);
      setSaveError("");
      callback.current(strokes);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not save this sheet.";
      drafts.set(boardId, { strokes, base: saved.current, error: message });
      setSaveError(message);
    }
  }

  useEffect(() => {
    if (!engine.current) return;
    engine.current.onChange = elements => {
      const strokes = elements.filter((element): element is PencilElement => element.type === "pencil");
      setLatest(strokes);
      persist(strokes);
    };
  });

  useEffect(() => {
    engine.current?.setTheme(theme);
    engine.current?.setBackground(canvasBackground(undefined, theme));
  }, [theme]);

  useEffect(() => {
    const drawing = engine.current;
    if (!drawing) return;
    drawing.setStyle({ stroke: ink.color, strokeWidth: ink.width, inkStyle: ink.style, strokeStyle: "solid" });
    drawing.setEraserOptions(eraserWidth, "drawings");
    try { localStorage.setItem(INK_KEY, JSON.stringify(ink)); } catch { /* Ink preferences are optional. */ }
  }, [ink, eraserWidth]);

  function selectTool(value: WritingTool) {
    engine.current?.setTool(value);
    setTool(value);
  }

  function chooseInk(change: Partial<InkOptions>) {
    setInk(current => ({ ...current, ...change }));
    selectTool("pencil");
  }

  async function exportPng() {
    setExporting(true);
    setError("");
    try {
      const { exportToPng } = await import("@/draw/export");
      await exportToPng(latest, theme, false, 2, latest, canvasBackground(undefined, theme), "none");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not export this sheet.");
    } finally { setExporting(false); }
  }

  return (
    <section className="writing-workspace" aria-labelledby={heading} onPointerDown={event => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }} onKeyDown={event => {
      if (clear || event.nativeEvent.isComposing || (event.target as HTMLElement).closest("input, select")) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) engine.current?.redo();
        else engine.current?.undo();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (key === "p") selectTool("pencil");
        if (key === "e") selectTool("eraser");
        if (key === "h") selectTool("hand");
      }
    }}>
      <h1 id={heading} className="sr-only">Writing · {title}</h1>
      <div className="writing-controls">
        <div className="writing-group" role="group" aria-label="Writing tools">
          {tools.map(({ id, name, icon: Icon }) => <button type="button" key={id} className="task-control writing-icon"
            disabled={!ready} aria-label={name} aria-pressed={tool === id} title={`${name} (${id === "hand" ? "H" : name[0]})`} onClick={() => selectTool(id)}>
            <Icon size={17} aria-hidden="true" />
          </button>)}
        </div>
        <select className="writing-pen-select" aria-label="Ink style" value={ink.style} disabled={!ready}
          onChange={event => chooseInk({ style: event.target.value as InkStyle })}>
          {INK_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}
        </select>
        <div className="writing-group writing-colors" role="group" aria-label="Ink colors">
          {[{ name: "Default", value: "#ffffff" }, ...PREMIUM_STROKES].map(color => <button type="button" key={color.value} className="writing-swatch"
            style={{ "--ink-color": color.name === "Default" ? "var(--ui-ink)" : color.value } as CSSProperties} aria-label={`${color.name} ink`} title={color.name}
            disabled={!ready} aria-pressed={ink.color.toLowerCase() === color.value.toLowerCase() && tool === "pencil"}
            onClick={() => chooseInk({ color: color.value })}><span aria-hidden="true" /></button>)}
          <label className="writing-custom-color" title="Custom ink color"><span className="sr-only">Custom ink color</span>
            <input type="color" value={ink.color} disabled={!ready} onChange={event => chooseInk({ color: event.target.value })} />
          </label>
        </div>
        <label className="writing-width">
          <span>{tool === "eraser" ? "Eraser" : "Width"}</span>
          <input type="range" min={tool === "eraser" ? 8 : 1} max={tool === "eraser" ? 72 : 24}
            value={tool === "eraser" ? eraserWidth : ink.width} disabled={!ready}
            onChange={event => tool === "eraser" ? setEraserWidth(Number(event.target.value)) : chooseInk({ width: Number(event.target.value) })} />
          <output>{tool === "eraser" ? eraserWidth : ink.width}px</output>
        </label>
        <div className="writing-group writing-actions" role="group" aria-label="Writing actions">
          <button type="button" className="task-control writing-icon" aria-label="Undo stroke" title="Undo stroke" disabled={!history.undo} onClick={() => engine.current?.undo()}><Undo2 size={16} /></button>
          <button type="button" className="task-control writing-icon" aria-label="Redo stroke" title="Redo stroke" disabled={!history.redo} onClick={() => engine.current?.redo()}><Redo2 size={16} /></button>
          <details ref={menu} className="writing-menu" onKeyDown={event => {
            if (event.key === "Escape" && menu.current?.open) {
              event.stopPropagation();
              menu.current.open = false;
              menuTrigger.current?.focus();
            }
          }}>
            <summary ref={menuTrigger} className="task-control writing-icon" aria-label="Sheet options" title="Sheet options"><Ellipsis size={18} /></summary>
            <div className="writing-menu-panel">
              <div className="writing-menu-zoom" role="group" aria-label="Zoom">
                <button type="button" className="task-control writing-icon" aria-label="Zoom out" disabled={!ready} onClick={() => engine.current?.zoomOut()}><Minus size={15} /></button>
                <span>{zoom}%</span>
                <button type="button" className="task-control writing-icon" aria-label="Zoom in" disabled={!ready} onClick={() => engine.current?.zoomIn()}><Plus size={15} /></button>
              </div>
              <button type="button" className="task-control" disabled={!latest.length} onClick={() => engine.current?.fitToContent()}><Maximize2 size={15} /> Fit to view</button>
              <button type="button" className="task-control" disabled={!latest.length || exporting} aria-busy={exporting} onClick={() => void exportPng()}><Download size={15} /> Export PNG</button>
              <button type="button" className="task-control" disabled={!latest.length} onClick={() => {
                if (menu.current) menu.current.open = false;
                menuTrigger.current?.focus();
                setClear(true);
              }}><Trash2 size={15} /> Clear sheet</button>
            </div>
          </details>
        </div>
      </div>
      {(saveError || error) && <div className="writing-feedback" role="alert">
        <p>{saveError || error}</p>
        {saveError && <button type="button" className="task-control" onClick={() => persist(latest)}>Retry saving</button>}
        {saveError.startsWith("This sheet changed") && <button type="button" className="task-control" onClick={() => {
          const drawing = engine.current;
          if (!drawing) return;
          try {
            const board = getBoard(boardId);
            if (!board) throw new Error("This board is no longer available.");
            const stored = board.writing ?? [];
            saved.current = JSON.stringify(stored);
            drafts.delete(boardId);
            drawing.setElements(stored, false);
            setLatest(stored);
            setSaveError("");
            callback.current(stored);
          } catch (reason) { setSaveError(String(reason)); }
        }}>Discard draft and load latest</button>}
      </div>}
      <div className="writing-sheet">
        <canvas ref={canvas} tabIndex={0} aria-label="Freehand writing surface" />
        {!latest.length && !error && <div className="writing-empty" aria-hidden="true"><PenLine size={24} /><strong>Draw anywhere on the sheet</strong><span>Use a pen, mouse, or finger.</span></div>}
      </div>
      {clear && <ConfirmDialog open variant="clear-writing" onClose={() => setClear(false)} onConfirm={() => engine.current?.setElements([])} />}
    </section>
  );
}
