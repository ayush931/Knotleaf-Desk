import { expandCodeTabs } from "@/lib/code";
import {
  CanvasElement,
  ArrowElement,
  LineElement,
  TextElement,
  StickyElement,
  Tool,
  Theme,
  GridType,
  Point,
  ElementStyleProps,
  InlineTextState,
  AnchorPosition,
  DEFAULT_STYLE,
  FontFamily,
  TextFormatting,
} from "./types";
import {
  Bounds,
  ACCENT,
  computeArrowPath,
  drawBoundsOutline,
  drawElement,
  drawElementAnchors,
  drawGrid,
  drawMarquee,
  fontStack,
  getElementAnchors,
  getElementBounds,
  getResizeHandles,
  measureTextBlock,
  normalizeRect,
  unionBounds,
  setFont,
  getCheckboxAtPoint,
  wrapText,
} from "./renderer";
import { smartGuides, drawSmartGuides, type Guide } from "./smartGuides";
import { getIconById } from "./iconsData";

type Handle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "start"
  | "end"
  | "mid";

const SNAP_GRID = 20;
const MIN_SIZE = 4;
const HISTORY_LIMIT = 100;

const HANDLE_CURSOR: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  start: "crosshair",
  end: "crosshair",
  mid: "move",
};

type Gesture =
  | { kind: "pan"; last: Point }
  | { kind: "erase"; erased: boolean }
  | {
      kind: "move";
      origin: Point;
      snapshots: Map<string, CanvasElement>;
      moved: boolean;
      /** Element to select alone if the pointer is released without dragging. */
      soloId: string | null;
    }
  | { kind: "resize"; handle: Handle; origin: Point; snapshot: CanvasElement }
  | { kind: "endpoint"; handle: Handle; snapshot: ArrowElement | LineElement }
  | { kind: "marquee"; start: Point; base: Set<string> }
  | { kind: "draft"; origin: Point };

interface Anchor {
  anchor: AnchorPosition;
  x: number;
  y: number;
}

function newId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-3);
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Recomputes the bounding box fields that other code reads from a line-like element. */
function syncLineBox<T extends ArrowElement | LineElement>(el: T): T {
  return {
    ...el,
    x: Math.min(el.startX, el.endX),
    y: Math.min(el.startY, el.endY),
    width: Math.abs(el.endX - el.startX),
    height: Math.abs(el.endY - el.startY),
  };
}

function translateElement(snap: CanvasElement, dx: number, dy: number, movedIds: Set<string>): CanvasElement {
  if (snap.type === "arrow" || snap.type === "line") {
    const moveStart = snap.type !== "arrow" || !snap.startBinding || movedIds.has(snap.startBinding.elementId);
    const moveEnd = snap.type !== "arrow" || !snap.endBinding || movedIds.has(snap.endBinding.elementId);
    const next = {
      ...snap,
      startX: snap.startX + (moveStart ? dx : 0),
      startY: snap.startY + (moveStart ? dy : 0),
      endX: snap.endX + (moveEnd ? dx : 0),
      endY: snap.endY + (moveEnd ? dy : 0),
    } as ArrowElement | LineElement;
    return syncLineBox(next);
  }
  if (snap.type === "pencil") {
    const points = snap.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return { ...snap, points, x: snap.x + dx, y: snap.y + dy };
  }
  return { ...snap, x: snap.x + dx, y: snap.y + dy };
}

/** Moves arrow endpoints onto the current ports of any bound element that changed. */
function resolveBindings(list: CanvasElement[], changed: Set<string>): CanvasElement[] {
  if (changed.size === 0) return list;
  changed = new Set(changed);
  let byId = new Map(list.map((el) => [el.id, el]));
  list = list.map(el => {
    if (el.type !== "text" || !el.containerId || !el.containerOffset) return el;
    const parent = byId.get(el.containerId);
    if (!parent) { const detached = { ...el }; delete detached.containerId; delete detached.containerOffset; return detached; }
    const box = normalizeRect(parent);
    if (changed.has(parent.id) && !changed.has(el.id)) {
      changed.add(el.id);
      return { ...el, x: box.x + el.containerOffset.x * box.w, y: box.y + el.containerOffset.y * box.h };
    }
    if (changed.has(el.id)) {
      if (el.x < box.x || el.x > box.x + box.w || el.y < box.y || el.y > box.y + box.h) { const detached = { ...el }; delete detached.containerId; delete detached.containerOffset; return detached; }
      return { ...el, containerOffset: { x: (el.x - box.x) / Math.max(1, box.w), y: (el.y - box.y) / Math.max(1, box.h) } };
    }
    return el;
  });
  byId = new Map(list.map(el => [el.id, el]));
  const portOf = (elementId: string, anchor: AnchorPosition): Point | null => {
    const target = byId.get(elementId);
    if (!target) return null;
    const port = getElementAnchors(target).find((a) => a.anchor === anchor);
    return port ? { x: port.x, y: port.y } : null;
  };
  return list.map((el) => {
    if (el.type !== "arrow") return el;
    let next: ArrowElement = el;
    let touched = false;
    if (next.startBinding && changed.has(next.startBinding.elementId)) {
      const p = portOf(next.startBinding.elementId, next.startBinding.anchor);
      if (p) {
        next = { ...next, startX: p.x, startY: p.y };
        touched = true;
      }
    }
    if (next.endBinding && changed.has(next.endBinding.elementId)) {
      const p = portOf(next.endBinding.elementId, next.endBinding.anchor);
      if (p) {
        next = { ...next, endX: p.x, endY: p.y };
        touched = true;
      }
    }
    return touched ? syncLineBox({ ...next, bendOffset: (next.routing || next.elbow) === "curved" ? next.bendOffset : undefined }) : el;
  });
}

/** Drops bindings that point at elements which no longer exist. */
function pruneBindings(list: CanvasElement[]): CanvasElement[] {
  const ids = new Set(list.map((el) => el.id));
  return list.map((el) => {
    if (el.type === "text" && el.containerId && !ids.has(el.containerId)) { const detached = { ...el }; delete detached.containerId; delete detached.containerOffset; return detached; }
    if (el.type !== "arrow") return el;
    const startGone = !!el.startBinding && !ids.has(el.startBinding.elementId);
    const endGone = !!el.endBinding && !ids.has(el.endBinding.elementId);
    if (!startGone && !endGone) return el;
    return {
      ...el,
      startBinding: startGone ? undefined : el.startBinding,
      endBinding: endGone ? undefined : el.endBinding,
    };
  });
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private destroyed = false;
  private readOnly = false;

  private elements: CanvasElement[] = [];
  private committedElements: CanvasElement[] = [];
  private collaborators: { name: string; color: string; cursor?: Point }[] = [];
  public collaborativeUndo?: () => void;
  public collaborativeRedo?: () => void;
  public onCursorChange?: (point: Point) => void;
  private selectedIds = new Set<string>();
  private tool: Tool = "select";
  private theme: Theme = "dark";
  private gridType: GridType = "dot";
  private snapToGrid = false;
  private editingId: string | null = null;

  // Viewport
  private zoom = 1;
  private pan: Point = { x: 0, y: 0 };

  // Interaction
  private gesture: Gesture | null = null;
  private activePointerId: number | null = null;
  private draft: CanvasElement | null = null;
  private marqueeRect: Bounds | null = null;
  private hoveredAnchors: Anchor[] = [];
  private snapTarget: { anchor: AnchorPosition } | null = null;
  private spaceDown = false;
  private shiftDown = false;
  private altDown = false;
  private guides: Guide[] = [];

  // Animation & render scheduling
  private flowOffset = 0;
  private animFrameId: number | null = null;
  private renderQueued = false;

  // History & clipboard
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private clipboard: CanvasElement[] = [];
  private pasteCount = 0;

  /** Style applied to newly created elements. */
  public currentStyle: ElementStyleProps = { ...DEFAULT_STYLE };

  // Callbacks
  public onChange?: (elements: CanvasElement[]) => void;
  public onSelectionChange?: (selected: CanvasElement[]) => void;
  public onOpenIconPicker?: () => void;
  public onViewportChange?: (view: { zoom: number; pan: Point }) => void;
  public onEditCode?: (id: string) => void;
  public onStartInlineText?: (state: InlineTextState) => void;
  public onZoomChange?: (zoom: number) => void;
  public onToolChange?: (tool: Tool) => void;
  public onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;

  constructor(
    canvas: HTMLCanvasElement,
    initialElements: CanvasElement[] = [],
    initialTheme: Theme = "dark",
    initialGrid: GridType = "dot"
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available");
    this.ctx = ctx;
    this.elements = [...initialElements];
    this.committedElements = [...initialElements];
    this.theme = initialTheme;
    this.gridType = initialGrid;
    this.undoStack = [JSON.stringify(this.elements)];

    this.attachEventListeners();
    this.resize(canvas.clientWidth, canvas.clientHeight);

    // Canvas text can't trigger font loading the way DOM text does, so ask for it explicitly.
    if (typeof document !== "undefined" && document.fonts) {
      const families: FontFamily[] = ["sans", "hand", "mono"];
      Promise.all(families.map((f) => document.fonts.load(`16px ${fontStack(f)}`)))
        .catch(() => undefined)
        .finally(() => this.requestRender());
    }
  }

  // --- Configuration -----------------------------------------------------------

  public setTool(tool: Tool) {
    if (this.gesture) this.cancelGesture();
    this.tool = tool;
    if (tool !== "select") {
      this.selectedIds.clear();
      this.emitSelection();
    }
    this.updateCursor();
    this.emitTool();
    this.requestRender();
  }

  public getTool(): Tool {
    return this.tool;
  }

  public setTheme(theme: Theme) {
    this.theme = theme;
    this.requestRender();
  }

  public setGridType(grid: GridType) {
    this.gridType = grid;
    this.requestRender();
  }

  public setSnapToGrid(snap: boolean) {
    this.snapToGrid = snap;
  }

  /** Sizes the canvas to its CSS box, backed by device pixels so it stays sharp on HiDPI screens. */
  public resize(width: number, height: number) {
    this.dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    this.cssWidth = Math.max(1, Math.floor(width));
    this.cssHeight = Math.max(1, Math.floor(height));
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.render();
  }

  // --- Viewport -----------------------------------------------------------------

  public setZoom(zoom: number, center?: Point) {
    const next = Math.max(0.1, Math.min(zoom, 4));
    const c = center ?? { x: this.cssWidth / 2, y: this.cssHeight / 2 };
    const ratio = next / this.zoom;
    this.pan = {
      x: c.x - (c.x - this.pan.x) * ratio,
      y: c.y - (c.y - this.pan.y) * ratio,
    };
    this.zoom = next;
    this.onZoomChange?.(this.zoom);
    this.requestRender();
  }

  public getViewport() { return { zoom: this.zoom, pan: { ...this.pan } }; }
  public restoreViewport(view: { zoom: number; pan: Point }) {
    this.zoom = Math.max(0.1, Math.min(4, view.zoom)); this.pan = { ...view.pan };
    this.onZoomChange?.(this.zoom); this.requestRender();
  }
  public setReadOnly(value: boolean) { this.cancelGesture(); this.readOnly = value; this.selectedIds.clear(); this.emitSelection(); this.updateCursor(); }
  public focusElements(ids: string[], select = true) {
    const elements = this.elements.filter(el => ids.includes(el.id));
    const bounds = unionBounds(elements.map(el => getElementBounds(el, this.elements))); if (!bounds) return;
    const width = Math.max(1, bounds.maxX - bounds.minX), height = Math.max(1, bounds.maxY - bounds.minY);
    this.zoom = Math.max(0.1, Math.min(2, Math.max(1, this.cssWidth - 96) / width, Math.max(1, this.cssHeight - 120) / height));
    this.pan = { x: this.cssWidth / 2 - (bounds.minX + bounds.maxX) / 2 * this.zoom, y: this.cssHeight / 2 - (bounds.minY + bounds.maxY) / 2 * this.zoom };
    if (select) { this.cancelGesture(); this.tool = "select"; this.emitTool(); this.selectedIds = new Set(elements.map(el => el.id)); this.emitSelection(); this.updateCursor(); }
    this.onZoomChange?.(this.zoom); this.requestRender();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public zoomIn() {
    this.setZoom(this.zoom * 1.2);
  }

  public zoomOut() {
    this.setZoom(this.zoom / 1.2);
  }

  public resetZoom() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.onZoomChange?.(this.zoom);
    this.requestRender();
  }

  public fitToContent() {
    const bounds = unionBounds(this.elements.map(el => getElementBounds(el, this.elements)));
    if (!bounds) {
      this.resetZoom();
      return;
    }
    const padding = 80;
    const contentW = Math.max(1, bounds.maxX - bounds.minX);
    const contentH = Math.max(1, bounds.maxY - bounds.minY);
    const fit = Math.min(
      (this.cssWidth - padding * 2) / contentW,
      (this.cssHeight - padding * 2) / contentH,
      1.5
    );
    this.zoom = Math.max(0.1, Math.min(4, fit));
    this.pan = {
      x: this.cssWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * this.zoom,
      y: this.cssHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * this.zoom,
    };
    this.onZoomChange?.(this.zoom);
    this.requestRender();
  }

  public screenToCanvas(sx: number, sy: number): Point {
    return { x: (sx - this.pan.x) / this.zoom, y: (sy - this.pan.y) / this.zoom };
  }

  public canvasToScreen(cx: number, cy: number): Point {
    return { x: cx * this.zoom + this.pan.x, y: cy * this.zoom + this.pan.y };
  }

  // --- Elements & selection ------------------------------------------------------

  /**
   * Replaces the board content. `recordHistory` true is a user edit (undoable and
   * persisted). False is a board load, which clears the undo history.
   */
  public setElements(elements: CanvasElement[], recordHistory = true) {
    this.elements = [...elements];
    this.selectedIds = new Set([...this.selectedIds].filter((id) => elements.some((e) => e.id === id)));
    if (recordHistory) {
      this.commit();
    } else {
      this.editingId = null;
      this.committedElements = [...this.elements];
      this.undoStack = [JSON.stringify(this.elements)];
      this.redoStack = [];
      this.emitHistory();
      this.emitSelection();
      this.requestRender();
    }
  }

  public applyRemoteElements(elements: CanvasElement[]) {
    // Preserve unfinished local gestures (especially erasing) while accepting
    // remote additions/deletions. Replacing the scene here used to undo an erase
    // before pointer-up could publish it.
    const previous = new Map(this.committedElements.map(el => [el.id, el]));
    const local = new Map(this.elements.map(el => [el.id, el]));
    const merged = new Map(elements.map(el => [el.id, el]));
    const changed = new Set<string>();
    for (const id of previous.keys()) if (!local.has(id)) { merged.delete(id); changed.add(id); }
    for (const el of this.elements) {
      const old = previous.get(el.id);
      if (JSON.stringify(old) === JSON.stringify(el)) continue;
      if (old && !merged.has(el.id)) continue;
      merged.set(el.id, el); changed.add(el.id);
    }
    this.committedElements = [...elements];
    this.elements = resolveBindings(pruneBindings([...merged.values()]), changed);
    this.selectedIds = new Set([...this.selectedIds].filter(id => merged.has(id)));
    if (this.editingId && !merged.has(this.editingId)) this.editingId = null;
    this.emitSelection(); this.requestRender();
  }
  public setCollaborators(people: { name: string; color: string; cursor?: Point }[]) { this.collaborators = people; this.requestRender(); }

  public getElements(): CanvasElement[] {
    return this.elements;
  }

  public getSelectedElements(): CanvasElement[] {
    if (this.selectedIds.size === 0) return [];
    return this.elements.filter((el) => this.selectedIds.has(el.id));
  }

  public getSelectedElement(): CanvasElement | null {
    const selected = this.getSelectedElements();
    return selected.length === 1 ? selected[0] : null;
  }

  public selectAll() {
    this.selectedIds = new Set(this.elements.map((el) => el.id));
    this.emitSelection();
    this.requestRender();
  }

  /** Applies style or property changes to every selected element. */
  public updateSelectedElement(props: Partial<CanvasElement>) {
    const ids = this.selectedIds;
    if (ids.size === 0) return;
    this.elements = this.elements.map((el) => {
      if (!ids.has(el.id)) return el;
      const next = { ...el, ...props } as CanvasElement;
      return next.type === "text" ? this.remeasureText(next) : next.type === "sticky" ? this.fitSticky(next) : next;
    });
    this.elements = resolveBindings(this.elements, new Set(ids));
    this.commit();
  }

  /** Connect selected shapes in selection order without requiring a drag gesture. */
  public connectSelected() {
    const selected = [...this.selectedIds].map(id => this.elements.find(e => e.id === id))
      .filter((e): e is CanvasElement => !!e && !["arrow", "line", "pencil", "frame"].includes(e.type));
    if (selected.length < 2) return;
    const arrows: ArrowElement[] = [];
    for (let i = 1; i < selected.length; i++) {
      const source = selected[i - 1], target = selected[i];
      const dx = target.x + target.width / 2 - source.x - source.width / 2;
      const dy = target.y + target.height / 2 - source.y - source.height / 2;
      const startAnchor: AnchorPosition = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
      const opposite: Record<AnchorPosition, AnchorPosition> = { top: "bottom", bottom: "top", left: "right", right: "left" };
      const endAnchor = opposite[startAnchor];
      const start = getElementAnchors(source).find(p => p.anchor === startAnchor)!;
      const end = getElementAnchors(target).find(p => p.anchor === endAnchor)!;
      const arrow = this.createDraft(start, "arrow") as ArrowElement;
      arrows.push(syncLineBox({ ...arrow, endX: end.x, endY: end.y,
        startBinding: { elementId: source.id, anchor: startAnchor }, endBinding: { elementId: target.id, anchor: endAnchor } }));
    }
    this.elements = [...this.elements, ...arrows];
    this.commit();
  }

  public arrangeSelected(mode: "left" | "top" | "horizontal") {
    const shapes = this.getSelectedElements().filter(e => !["arrow", "line", "pencil"].includes(e.type));
    if (shapes.length < 2) return;
    const movedIds = new Set(shapes.map(e => e.id));
    const changes = new Map<string, CanvasElement>();
    if (mode === "horizontal") {
      if (shapes.length < 3) return;
      const sorted = [...shapes].sort((a, b) => a.x - b.x);
      const first = sorted[0], last = sorted[sorted.length - 1];
      const totalWidth = sorted.reduce((n, e) => n + e.width, 0);
      const gap = (last.x + last.width - first.x - totalWidth) / (sorted.length - 1);
      let x = first.x;
      for (const el of sorted) { changes.set(el.id, translateElement(el, x - el.x, 0, movedIds)); x += el.width + gap; }
    } else {
      const coordinate = Math.min(...shapes.map(e => mode === "left" ? e.x : e.y));
      for (const el of shapes) changes.set(el.id, translateElement(el, mode === "left" ? coordinate - el.x : 0, mode === "top" ? coordinate - el.y : 0, movedIds));
    }
    this.elements = resolveBindings(this.elements.map(e => changes.get(e.id) ?? e), movedIds);
    this.commit();
  }

  public toggleTextFormatting(key: keyof TextFormatting) {
    const selected = this.getSelectedElements().filter(el => el.type === "text" || el.type === "sticky");
    if (!selected.length) { this.currentStyle[key] = !this.currentStyle[key]; return; }
    const enabled = !selected.every(el => !!el[key]);
    const ids = new Set(selected.map(el => el.id));
    this.elements = this.elements.map(el => ids.has(el.id) ? el.type === "text" ? this.remeasureText({ ...el, [key]: enabled }) : el.type === "sticky" ? this.fitSticky({ ...el, [key]: enabled }) : el : el);
    this.elements = resolveBindings(this.elements, ids); this.commit();
  }

  private fitSticky(el: StickyElement): StickyElement {
    const width = Math.max(100, el.width);
    setFont(this.ctx, el.fontSize || 15, el.fontFamily || "sans", el.bold ? 700 : 400, el.italic);
    const height = Math.max(80, el.height, wrapText(this.ctx, el.text, width - 24).length * (el.fontSize || 15) * 1.35 + 28);
    return { ...el, width, height };
  }

  private remeasureText(el: TextElement): TextElement {
    if (el.isCodeCard) {
      setFont(this.ctx, el.fontSize, "mono");
      return { ...el, width: Math.max(280, ...expandCodeTabs(el.text).split("\n").map(line => this.ctx.measureText(line).width)) + 24, height: Math.max(100, el.text.split("\n").length * el.fontSize * 1.5 + 36) };
    }
    const size = measureTextBlock(this.ctx, el.text, el.fontSize, el.fontFamily, el);
    return { ...el, width: el.isDocCard ? Math.max(240,size.width) : size.width, height: el.isDocCard ? Math.max(100,size.height) : size.height };
  }

  public finishCode() { this.editingId = null; this.requestRender(); }

  public updateCode(id: string, text: string, language = "auto") {
    if (this.readOnly) return;
    this.elements = this.elements.map(el => el.id === id && el.type === "text" && el.isCodeCard ? this.remeasureText({ ...el, text: text.slice(0, 100_000), codeLanguage: language }) : el);
    this.elements = resolveBindings(this.elements, new Set([id]));
    this.commit();
  }

  /** Steps the font size of selected text (Ctrl+Shift+. / Ctrl+Shift+,). */
  public changeFontSize(delta: number) {
    const clamp = (v: number) => Math.max(8, Math.min(96, Math.round(v)));
    const ids = new Set(this.getSelectedElements().filter((e) => e.type === "text" || e.type === "sticky").map((e) => e.id));
    if (ids.size === 0) {
      this.currentStyle.fontSize = clamp(this.currentStyle.fontSize + delta);
      this.requestRender();
      return;
    }
    this.elements = this.elements.map((el) => {
      if (!ids.has(el.id)) return el;
      if (el.type === "text") return this.remeasureText({ ...el, fontSize: clamp(el.fontSize + delta) });
      if (el.type === "sticky") return this.fitSticky({ ...el, fontSize: clamp(el.fontSize + delta) });
      return el;
    });
    this.commit();
  }

  /** Adds an icon imported from the internet. Its SVG is stored on the element so it works offline. */
  public addOnlineIcon(name: string, id: string, svgMarkup: string, viewBox: string) {
    const center = this.screenToCanvas(this.cssWidth / 2, this.cssHeight / 2);
    const el: CanvasElement = {
      id: newId(),
      type: "icon",
      iconId: `online:${id}`,
      iconName: name,
      category: "online",
      iconColor: this.theme === "dark" ? "#E2E8F0" : "#1E293B",
      badgeBg: this.theme === "dark" ? "rgba(30, 41, 59, 0.7)" : "rgba(248, 250, 252, 0.95)",
      svgMarkup,
      viewBox,
      x: center.x - 24,
      y: center.y - 24,
      width: 48,
      height: 48,
      stroke: "#CBD5E1",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      fill: "transparent",
      fillStyle: "none",
      roundness: "rounded",
      opacity: 1,
      zIndex: this.elements.length,
    };
    this.elements = [...this.elements, el];
    this.selectedIds = new Set([el.id]);
    this.tool = "select";
    this.emitTool();
    this.commit();
  }

  /** Reverses the selected arrows while preserving the start/end cap styles. */
  public swapSelectedArrows() {
    const ids = this.selectedIds;
    this.elements = this.elements.map((el) => {
      if (el.type !== "arrow" || !ids.has(el.id)) return el;
      return syncLineBox({
        ...el,
        startX: el.endX,
        startY: el.endY,
        endX: el.startX,
        endY: el.startY,
        bendOffset: undefined,
        startBinding: el.endBinding,
        endBinding: el.startBinding,
        arrowHeadStart: el.arrowHeadStart ?? "none",
        arrowHeadEnd: el.arrowHeadEnd ?? "arrow",
      });
    });
    this.commit();
  }

  public addIconElement(iconId: string) {
    const def = getIconById(iconId);
    if (!def) return;
    const center = this.screenToCanvas(this.cssWidth / 2, this.cssHeight / 2);
    const el: CanvasElement = {
      id: newId(),
      type: "icon",
      iconId: def.id,
      iconName: def.name,
      category: def.category,
      iconColor: def.color,
      badgeBg: def.badgeBg,
      x: center.x - 24,
      y: center.y - 24,
      width: 48,
      height: 48,
      stroke: def.color,
      strokeWidth: 1.5,
      strokeStyle: "solid",
      fill: "transparent",
      fillStyle: "none",
      roundness: "rounded",
      opacity: 1,
      zIndex: this.elements.length,
    };
    this.elements = [...this.elements, el];
    this.selectedIds = new Set([el.id]);
    this.tool = "select";
    this.emitTool();
    this.commit();
  }

  public getSelectionForExport(): CanvasElement[] {
    const ids = this.withContainedText(this.selectedIds);
    return this.elements.filter(el => ids.has(el.id));
  }

  private withContainedText(ids: Set<string>): Set<string> {
    const expanded = new Set(ids);
    for (const el of this.elements) if (el.type === "text" && el.containerId && ids.has(el.containerId)) expanded.add(el.id);
    return expanded;
  }

  public deleteSelected() {
    if (this.selectedIds.size === 0) return;
    const ids = this.withContainedText(this.selectedIds);
    this.elements = pruneBindings(this.elements.filter((el) => !ids.has(el.id)));
    this.selectedIds.clear();
    this.commit();
  }

  public duplicateSelected() {
    const ids = this.withContainedText(this.selectedIds);
    const selected = this.elements.filter(el => ids.has(el.id));
    if (selected.length === 0) return;
    const copies = this.cloneElements(selected, 24);
    this.elements = [...this.elements, ...copies];
    this.selectedIds = new Set(copies.map((c) => c.id));
    this.commit();
  }

  public copySelection() {
    const ids = this.withContainedText(this.selectedIds);
    this.clipboard = JSON.parse(JSON.stringify(this.elements.filter(el => ids.has(el.id))));
    this.pasteCount = 0;
  }

  public cutSelection() {
    this.copySelection();
    this.deleteSelected();
  }

  public paste() {
    if (this.clipboard.length === 0) return;
    this.pasteCount++;
    const copies = this.cloneElements(this.clipboard, 24 * this.pasteCount);
    this.elements = [...this.elements, ...copies];
    this.selectedIds = new Set(copies.map((c) => c.id));
    this.commit();
  }

  public bringToFront() {
    const ids = this.withContainedText(this.selectedIds);
    if (ids.size === 0) return;
    this.elements = [
      ...this.elements.filter((el) => !ids.has(el.id)),
      ...this.elements.filter((el) => ids.has(el.id)),
    ].map((el, zIndex) => ({ ...el, zIndex }));
    this.commit();
  }

  public sendToBack() {
    const ids = this.withContainedText(this.selectedIds);
    if (ids.size === 0) return;
    this.elements = [
      ...this.elements.filter((el) => ids.has(el.id)),
      ...this.elements.filter((el) => !ids.has(el.id)),
    ].map((el, zIndex) => ({ ...el, zIndex }));
    this.commit();
  }

  /** Clones elements with fresh ids. Arrows keep bindings only to clones that were also copied. */
  private cloneElements(source: CanvasElement[], offset: number): CanvasElement[] {
    const idMap = new Map<string, string>();
    source.forEach((el) => idMap.set(el.id, newId()));
    return source.map((el, index) => {
      const copy = JSON.parse(JSON.stringify(el)) as CanvasElement;
      copy.id = idMap.get(el.id)!;
      copy.zIndex = this.elements.length + index;
      if (copy.type === "arrow" || copy.type === "line") {
        copy.startX += offset;
        copy.startY += offset;
        copy.endX += offset;
        copy.endY += offset;
        if (copy.type === "arrow") {
          const rebind = (b?: { elementId: string; anchor: AnchorPosition }) =>
            b && idMap.has(b.elementId) ? { elementId: idMap.get(b.elementId)!, anchor: b.anchor } : undefined;
          copy.startBinding = rebind(copy.startBinding);
          copy.endBinding = rebind(copy.endBinding);
        }
        return syncLineBox(copy);
      }
      if (copy.type === "pencil") {
        copy.points = copy.points.map((p) => ({ x: p.x + offset, y: p.y + offset }));
      }
      if (copy.type === "text" && copy.containerId) {
        if (idMap.has(copy.containerId)) copy.containerId = idMap.get(copy.containerId)!;
        else { delete copy.containerId; delete copy.containerOffset; }
      }
      copy.x += offset;
      copy.y += offset;
      return copy;
    });
  }

  // --- Inline text --------------------------------------------------------------

  public commitInlineText(info: InlineTextState) {
    const text = info.text;
    const trimmed = text.trim();
    this.editingId = null;

    if (info.kind === "new-text") {
      if (info.replaceLabelId) this.elements = this.elements.map(el => el.id === info.replaceLabelId ? { ...el, label: undefined } : el);
      if (trimmed) {
        const el = this.makeTextElement(text, info.canvasX, info.canvasY, info.fontSize, info.fontFamily, info.color, info.align, false, info);
        this.elements = [...this.elements, { ...el, ...(info.containerId && info.containerOffset ? { containerId: info.containerId, containerOffset: info.containerOffset } : {}) }];
        this.selectedIds = new Set([el.id]);
        this.tool = "select";
        this.emitTool();
      }
    } else if (info.elementId) {
      const id = info.elementId;
      const next: CanvasElement[] = [];
      for (const el of this.elements) {
        if (el.id !== id) {
          next.push(el);
          continue;
        }
        if (info.kind === "text" && el.type === "text") {
          if (!trimmed && !el.isDocCard) continue;
          next.push(
            this.remeasureText({
              ...el,
              text,
              fontSize: info.fontSize,
              fontFamily: info.fontFamily,
              textAlign: info.align,
              stroke: info.color,
              bold: !!info.bold, italic: !!info.italic, underline: !!info.underline, strikethrough: !!info.strikethrough,
            })
          );
        } else if (info.kind === "sticky" && el.type === "sticky") {
          next.push(this.fitSticky({ ...el, text, fontSize: info.fontSize, fontFamily: info.fontFamily, textAlign: info.align, stroke: info.color, bold: !!info.bold, italic: !!info.italic, underline: !!info.underline, strikethrough: !!info.strikethrough }));
        } else if (info.kind === "frame-title" && el.type === "frame") {
          next.push({ ...el, title: trimmed || "Frame" });
        } else if (info.kind === "label") {
          next.push({ ...el, label: trimmed || undefined } as CanvasElement);
        } else {
          next.push(el);
        }
      }
      this.elements = resolveBindings(pruneBindings(next), new Set([id]));
      this.selectedIds = new Set([...this.selectedIds].filter((sid) => this.elements.some((e) => e.id === sid)));
      this.selectedIds.add(id);
    }
    this.commit();
  }

  public cancelInlineText() {
    const id = this.editingId;
    this.editingId = null;
    if (id) {
      // Discard a text or sticky that was just created and never filled in.
      const el = this.elements.find((e) => e.id === id);
      if (el && el.type === "text" && !el.isCodeCard && !el.text.trim()) {
        this.elements = this.elements.filter((e) => e.id !== id);
        this.selectedIds.delete(id);
        this.commit();
        return;
      }
    }
    this.requestRender();
  }

  private makeTextElement(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: FontFamily,
    color: string,
    align: TextElement["textAlign"],
    isDocCard: boolean = false,
    formatting: TextFormatting = {}
  ): TextElement {
    const size = measureTextBlock(this.ctx, text, fontSize, fontFamily, formatting);
    return {
      id: newId(),
      type: "text",
      x,
      y,
      width: size.width,
      height: size.height,
      text,
      fontSize,
      fontFamily,
      bold: !!formatting.bold, italic: !!formatting.italic, underline: !!formatting.underline, strikethrough: !!formatting.strikethrough,
      textAlign: align,
      stroke: color || "#FFFFFF",
      strokeWidth: 1,
      strokeStyle: "solid",
      fill: isDocCard ? "#18181B" : "transparent",
      fillStyle: isDocCard ? "solid" : "none",
      roundness: isDocCard ? "rounded" : "sharp",
      opacity: 1,
      zIndex: this.elements.length,
      isDocCard,
      title: isDocCard ? "Document Note" : undefined,
    };
  }

  /** Opens the in-place editor for the element under a double-click. */
  private openEditorFor(el: CanvasElement, click?: Point) {
    if (el.type === "text" && el.isCodeCard) { this.editingId = el.id; this.requestRender(); this.onEditCode?.(el.id); return; }
    let state: InlineTextState | null = null;
    switch (el.type) {
      case "text": {
        const p = this.canvasToScreen(el.x, el.y);
        state = {
          kind: "text", elementId: el.id, canvasX: el.x, canvasY: el.y,
          screenX: p.x, screenY: p.y,
          screenWidth: Math.max(80, el.width * this.zoom + 24),
          bold: el.bold, italic: el.italic, underline: el.underline, strikethrough: el.strikethrough,
          text: el.text, fontSize: el.fontSize, fontFamily: el.fontFamily,
          color: el.stroke, align: el.textAlign,
        };
        break;
      }
      case "sticky": {
        const p = this.canvasToScreen(el.x + 12, el.y + 12);
        state = {
          kind: "sticky", elementId: el.id, canvasX: el.x, canvasY: el.y,
          screenX: p.x, screenY: p.y,
          screenWidth: (el.width - 24) * this.zoom,
          screenHeight: (el.height - 24) * this.zoom,
          bold: el.bold, italic: el.italic, underline: el.underline, strikethrough: el.strikethrough,
          text: el.text, fontSize: el.fontSize, fontFamily: el.fontFamily || "sans",
          color: el.stroke || "#1E293B", align: el.textAlign || "left",
        };
        break;
      }
      case "frame": {
        const p = this.canvasToScreen(el.x + 12, el.y - 11);
        state = {
          kind: "frame-title", elementId: el.id, canvasX: el.x, canvasY: el.y,
          screenX: p.x, screenY: p.y, screenWidth: 180,
          text: el.title, fontSize: 12, fontFamily: "sans",
          color: el.stroke, align: "left",
        };
        break;
      }
      case "arrow": {
        const label = computeArrowPath(el, this.elements).labelPt;
        const p = this.canvasToScreen(label.x, label.y);
        state = {
          kind: "label", elementId: el.id, canvasX: label.x, canvasY: label.y,
          screenX: p.x - 80, screenY: p.y - 12, screenWidth: 160,
          text: el.label ?? "", fontSize: 12, fontFamily: "sans",
          color: el.stroke, align: "center",
        };
        break;
      }
      case "rectangle":
      case "diamond":
      case "circle": {
        const p = this.canvasToScreen(el.x, el.y);
        state = {
          kind: "label", elementId: el.id, canvasX: el.x, canvasY: el.y,
          screenX: p.x, screenY: p.y,
          screenWidth: el.width * this.zoom, screenHeight: el.height * this.zoom,
          text: el.label ?? "", fontSize: 14, fontFamily: "sans",
          color: el.stroke, align: "center",
        };
        break;
      }
      default:
        return;
    }
    if (click && state && (el.type === "text" || el.type === "sticky")) {
      setFont(this.ctx, state.fontSize, state.fontFamily, state.bold ? 700 : 400, state.italic);
      const originX = el.x + (el.type === "sticky" ? 12 : 0), originY = el.y + (el.type === "sticky" ? 12 : 0);
      const available = el.width - (el.type === "sticky" ? 24 : 0);
      const lines = el.type === "sticky" ? wrapText(this.ctx, state.text, available) : state.text.split("\n");
      let consumed = 0;
      const offsets = lines.map(line => {
        if (el.type === "text") { const offset = consumed; consumed += line.length + 1; return offset; }
        if (!line && state!.text[consumed] === "\n") consumed++;
        const offset = Math.max(consumed, state!.text.indexOf(line, consumed)); consumed = offset + line.length; return offset;
      });
      const row = Math.max(0, Math.min(lines.length - 1, Math.floor((click.y - originY) / (state.fontSize * 1.35))));
      const line = lines[row], width = this.ctx.measureText(line).width;
      const left = originX + (state.align === "center" ? (available - width) / 2 : state.align === "right" ? available - width : 0);
      const x = click.x - left;
      let column = 0;
      const segments = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(line)].map(part => ({ start: part.index, end: part.index + part.segment.length })) : Array.from(line).reduce<{ start: number; end: number }[]>((parts, char) => { const start = parts.at(-1)?.end || 0; parts.push({ start, end: start + char.length }); return parts; }, []);
      for (const segment of segments) {
        const before = this.ctx.measureText(line.slice(0, segment.start)).width, after = this.ctx.measureText(line.slice(0, segment.end)).width;
        if (x < (before + after) / 2) break;
        column = segment.end;
      }
      state.caret = offsets[row] + column;
    }
    this.editingId = el.id;
    this.selectedIds = new Set([el.id]);
    this.emitSelection();
    this.onStartInlineText?.(state);
    this.requestRender();
  }

  // --- Rendering -------------------------------------------------------------------

  /** Immediate draw. Prefer requestRender() from event handlers. */
  public render() {
    this.draw();
  }

  private onResourceLoad = () => this.requestRender();

  private requestRender() {
    this.onViewportChange?.(this.getViewport());
    if (this.renderQueued || this.destroyed) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.draw();
    });
  }

  private draw() {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h, this.pan, this.zoom, this.gridType);

    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.zoom, this.zoom);

    const selected = this.getSelectedElements();
    const single = selected.length === 1 ? selected[0] : null;

    for (const el of this.elements) {
      if (el.id === this.editingId) {
        // Text and sticky content is being typed into the overlay, so skip it.
        // Shapes keep their outline and only lose the label being edited.
        if (el.type === "text") { if(el.isDocCard&&!el.isCodeCard)drawElement(ctx,{...el,text:"",title:undefined},{theme:this.theme,scene:this.elements});continue; }
        if (el.type === "sticky") { drawElement(ctx, { ...el, text: "" }, { theme: this.theme, scene: this.elements }); continue; }
        drawElement(ctx, { ...el, label: undefined, ...(el.type === "frame" ? { title: "" } : {}) } as CanvasElement, {
          theme: this.theme,
          scene: this.elements,
          zoom: this.zoom,
        });
        continue;
      }
      drawElement(ctx, el, {
        theme: this.theme,
          scene: this.elements,
        flowOffset: this.flowOffset,
        selected: single?.id === el.id,
        onResourceLoad: this.onResourceLoad,
        zoom: this.zoom,
      });
    }

    if (selected.length > 1) {
      for (const el of selected) drawBoundsOutline(ctx, getElementBounds(el, this.elements), this.zoom, 3 / this.zoom);
      const group = unionBounds(selected.map(el => getElementBounds(el, this.elements)));
      if (group) drawBoundsOutline(ctx, group, this.zoom, 10 / this.zoom);
    }

    if (this.draft) {
      drawElement(ctx, this.draft, { theme: this.theme, zoom: this.zoom, scene: this.elements });
    }

    if (single && this.tool === "select" && !this.gesture && !this.editingId) {
      drawElementAnchors(ctx, getElementAnchors(single), this.snapTarget?.anchor, this.zoom);
    }

    if (this.hoveredAnchors.length > 0) {
      drawElementAnchors(ctx, this.hoveredAnchors, this.snapTarget?.anchor, this.zoom);
    }

    if (this.guides.length && this.gesture) drawSmartGuides(ctx, this.guides, this.zoom);

    if (this.marqueeRect) {
      drawMarquee(ctx, this.marqueeRect, this.zoom);
    }

    for (const person of this.collaborators) {
      if (!person.cursor) continue;
      const { x, y } = person.cursor;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 / this.zoom, 1 / this.zoom);
      ctx.fillStyle = person.color; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 17); ctx.lineTo(9, 11); ctx.lineTo(17, 9); ctx.closePath(); ctx.fill();
      setFont(ctx, 11, "sans", 600); ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillRect(10, 18, ctx.measureText(person.name).width + 12, 22); ctx.fillStyle = "#121212"; ctx.fillText(person.name, 16, 23); ctx.restore();
    }
    ctx.restore();
    this.syncAnimation();
  }

  private syncAnimation() {
    const hasFlow = this.elements.some((el) => el.type === "arrow" && el.animated);
    if (hasFlow && this.animFrameId === null) {
      this.animFrameId = requestAnimationFrame(this.tickAnimation);
    } else if (!hasFlow && this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private tickAnimation = () => {
    this.animFrameId = null;
    this.flowOffset = (this.flowOffset + 0.6) % 28;
    this.draw();
  };

  // --- Geometry & hit testing ----------------------------------------------------------

  private snapPoint(pt: Point): Point {
    if (!this.snapToGrid) return pt;
    return {
      x: Math.round(pt.x / SNAP_GRID) * SNAP_GRID,
      y: Math.round(pt.y / SNAP_GRID) * SNAP_GRID,
    };
  }

  /** Nearest port on a non-connector element within snapping distance of pt. */
  private findNearestAnchor(pt: Point, excludeId?: string, onlyId?: string): { elementId: string; anchor: AnchorPosition; x: number; y: number; all: Anchor[] } | null {
    const reach = 24 / this.zoom;
    let best: { elementId: string; anchor: AnchorPosition; x: number; y: number; all: Anchor[] } | null = null;
    let bestDist = reach;
    for (const el of this.elements) {
      if (el.id === excludeId || el.type === "frame" || (onlyId && el.id !== onlyId)) continue;
      const anchors = getElementAnchors(el);
      for (const a of anchors) {
        const d = Math.hypot(pt.x - a.x, pt.y - a.y);
        if (d < bestDist) {
          bestDist = d;
          best = { elementId: el.id, anchor: a.anchor, x: a.x, y: a.y, all: anchors };
        }
      }
    }
    return best;
  }

  private hitTest(pt: Point): CanvasElement | null {
    const tol = 7 / this.zoom;
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (this.hitElement(el, pt, tol)) return el;
    }
    return null;
  }

  private hitElement(el: CanvasElement, pt: Point, tol: number): boolean {
    switch (el.type) {
      case "arrow": {
        const info = computeArrowPath(el, this.elements);
        if (el.label) {
          const lw = (el.label.length * 7 + 16) / this.zoom / 2;
          const lh = 12 / this.zoom;
          if (Math.abs(pt.x - info.labelPt.x) <= lw && Math.abs(pt.y - info.labelPt.y) <= lh) return true;
        }
        if (info.routing === "curved" && info.cpx !== undefined && info.cpy !== undefined) {
          let prev: Point = { x: el.startX, y: el.startY };
          for (let t = 0.05; t <= 1.0001; t += 0.05) {
            const cur = {
              x: (1 - t) * (1 - t) * el.startX + 2 * (1 - t) * t * info.cpx + t * t * el.endX,
              y: (1 - t) * (1 - t) * el.startY + 2 * (1 - t) * t * info.cpy + t * t * el.endY,
            };
            if (distToSegment(pt, prev, cur) <= tol) return true;
            prev = cur;
          }
          return false;
        }
        for (let i = 0; i < info.points.length - 1; i++) {
          if (distToSegment(pt, info.points[i], info.points[i + 1]) <= tol) return true;
        }
        return false;
      }
      case "line":
        return distToSegment(pt, { x: el.startX, y: el.startY }, { x: el.endX, y: el.endY }) <= tol;
      case "pencil": {
        const pts = el.points;
        if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= tol;
        for (let i = 0; i < pts.length - 1; i++) {
          if (distToSegment(pt, pts[i], pts[i + 1]) <= tol) return true;
        }
        return false;
      }
      case "circle": {
        const r = normalizeRect(el);
        const rx = r.w / 2;
        const ry = r.h / 2;
        if (rx <= 0 || ry <= 0) return false;
        const cx = r.x + rx;
        const cy = r.y + ry;
        const nx = (pt.x - cx) / (rx + tol);
        const ny = (pt.y - cy) / (ry + tol);
        return nx * nx + ny * ny <= 1;
      }
      case "diamond": {
        const r = normalizeRect(el);
        const rx = r.w / 2;
        const ry = r.h / 2;
        if (rx <= 0 || ry <= 0) return false;
        const cx = r.x + rx;
        const cy = r.y + ry;
        return Math.abs(pt.x - cx) / (rx + tol) + Math.abs(pt.y - cy) / (ry + tol) <= 1;
      }
      case "frame": {
        // Frames only respond on their border or title tag, so elements inside stay clickable.
        const r = normalizeRect(el);
        const inside = pt.x >= r.x - tol && pt.x <= r.x + r.w + tol && pt.y >= r.y - tol && pt.y <= r.y + r.h + tol;
        const deep = pt.x > r.x + tol && pt.x < r.x + r.w - tol && pt.y > r.y + tol && pt.y < r.y + r.h - tol;
        const tagW = (el.title.length * 7 + 16) / this.zoom;
        const onTag = pt.x >= r.x + 12 && pt.x <= r.x + 12 + tagW && Math.abs(pt.y - r.y) <= 12 / this.zoom;
        return (inside && !deep) || onTag;
      }
      default: {
        const r = normalizeRect(el);
        return pt.x >= r.x - tol && pt.x <= r.x + r.w + tol && pt.y >= r.y - tol && pt.y <= r.y + r.h + tol;
      }
    }
  }

  /** Resize / endpoint handle under pt, for the single selected element. */
  private handleAt(el: CanvasElement, pt: Point): Handle | null {
    const tol = 9 / this.zoom;
    const near = (x: number, y: number) => Math.hypot(pt.x - x, pt.y - y) <= tol;

    if (el.type === "arrow") {
      if (near(el.startX, el.startY)) return "start";
      if (near(el.endX, el.endY)) return "end";
      const mid = computeArrowPath(el, this.elements).midPt;
      if (near(mid.x, mid.y)) return "mid";
      return null;
    }
    if (el.type === "line") {
      if (near(el.startX, el.startY)) return "start";
      if (near(el.endX, el.endY)) return "end";
      return null;
    }

    const bounds = getElementBounds(el);
    const handles = getResizeHandles(bounds, this.zoom, el.type === "frame");
    for (const { handle, x, y } of handles) {
      if (near(x, y)) return handle;
    }

    // The outline is draggable for one-axis resizing. Leave the circular
    // connector hit areas free so the same gesture cannot start both actions.
    if (el.type !== "frame" && getElementAnchors(el).some(port => Math.hypot(pt.x - port.x, pt.y - port.y) < 10 / this.zoom)) return null;
    const pad = 5 / this.zoom;
    const edgeTolerance = 6 / this.zoom;
    const x0 = bounds.minX - pad, x1 = bounds.maxX + pad;
    const y0 = bounds.minY - pad, y1 = bounds.maxY + pad;
    if (pt.x >= x0 && pt.x <= x1) {
      if (Math.abs(pt.y - y0) <= edgeTolerance) return "n";
      if (Math.abs(pt.y - y1) <= edgeTolerance) return "s";
    }
    if (pt.y >= y0 && pt.y <= y1) {
      if (Math.abs(pt.x - x0) <= edgeTolerance) return "w";
      if (Math.abs(pt.x - x1) <= edgeTolerance) return "e";
    }
    return null;
  }

  // --- Pointer events ----------------------------------------------------------------

  private screenPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button === 2 || e.isPrimary === false || this.gesture) return;
    this.activePointerId = e.pointerId;
    const opensEditor = e.button === 0 && !this.spaceDown && ["text", "doc", "sticky", "code"].includes(this.tool);
    if (opensEditor) {
      // The editor takes focus during this event. A compatibility mousedown on
      // the canvas would blur it and immediately commit/discard an empty draft.
      e.preventDefault();
    } else {
      this.canvas.setPointerCapture?.(e.pointerId);
    }
    this.shiftDown = e.shiftKey;
    this.altDown = !!e.altKey;
    const sp = this.screenPoint(e);
    const pt = this.screenToCanvas(sp.x, sp.y);

    if (this.readOnly || e.button === 1 || this.spaceDown || this.tool === "hand") {
      this.gesture = { kind: "pan", last: sp };
      this.updateCursor();
      return;
    }

    if (this.tool === "eraser") {
      this.gesture = { kind: "erase", erased: false };
      this.eraseAt(pt);
      return;
    }

    const selected = this.getSelectedElements();
    const selectedHandle = selected.length === 1 ? this.handleAt(selected[0], pt) : null;
    // In Select, only the selected element exposes connection controls.
    // Hovering an unrelated shape must not turn an ordinary move into an arrow.
    if (this.tool === "select" && selected.length === 1 && !e.shiftKey && !selectedHandle) {
      const snap = this.findNearestAnchor(pt, undefined, selected[0].id);
      if (snap && Math.hypot(pt.x - snap.x, pt.y - snap.y) < 10 / this.zoom) {
        const arrow = this.createDraft({ x: snap.x, y: snap.y }, "arrow") as ArrowElement;
        this.draft = { ...arrow, startBinding: { elementId: snap.elementId, anchor: snap.anchor } };
        this.gesture = { kind: "draft", origin: this.snapPoint(pt) };
        this.requestRender();
        return;
      }
    }
    if (this.tool === "select") {
      if (selected.length === 1) {
        const handle = selectedHandle;
        if (handle) {
          this.gesture = handle === "start" || handle === "end" || handle === "mid"
            ? { kind: "endpoint", handle, snapshot: selected[0] as ArrowElement | LineElement }
            : { kind: "resize", handle, origin: pt, snapshot: selected[0] };
          this.canvas.style.cursor = HANDLE_CURSOR[handle];
          return;
        }
      }

      const hit = this.hitTest(pt);
      if (hit) {
        if (hit.type === "text") {
          const cb = getCheckboxAtPoint(hit, pt);
          if (cb) {
            this.elements = this.elements.map((el) => (el.id === hit.id ? { ...el, text: cb.newText } : el));
            this.selectedIds = new Set([hit.id]);
            this.commit();
            return;
          }
        }

        if (e.shiftKey) {
          if (this.selectedIds.has(hit.id)) {
            this.selectedIds.delete(hit.id);
            this.emitSelection();
            this.requestRender();
            return;
          }
          this.selectedIds.add(hit.id);
        } else if (!this.selectedIds.has(hit.id)) {
          this.selectedIds = new Set([hit.id]);
        }
        const soloId = !e.shiftKey && this.selectedIds.size > 1 ? hit.id : null;
        const snapshots = new Map<string, CanvasElement>();
        const movingIds = this.withContainedText(this.selectedIds);
        for (const el of this.elements) if (movingIds.has(el.id)) snapshots.set(el.id, el);
        this.gesture = { kind: "move", origin: pt, snapshots, moved: false, soloId };
        this.emitSelection();
        this.requestRender();
        return;
      }

      if (!e.shiftKey) this.selectedIds.clear();
      this.gesture = { kind: "marquee", start: pt, base: new Set(this.selectedIds) };
      this.emitSelection();
      this.requestRender();
      return;
    }

    if (this.tool === "text") {
      this.selectedIds.clear();
      this.emitSelection();
      this.tool = "select";
      this.emitTool();
      this.updateCursor();
      this.onStartInlineText?.({
        kind: "new-text",
        canvasX: pt.x,
        canvasY: pt.y,
        screenX: sp.x,
        screenY: sp.y,
        text: "",
        fontSize: this.currentStyle.fontSize,
        fontFamily: this.currentStyle.fontFamily,
        bold: this.currentStyle.bold, italic: this.currentStyle.italic, underline: this.currentStyle.underline, strikethrough: this.currentStyle.strikethrough,
        color: this.currentStyle.stroke || "#FFFFFF",
        align: this.currentStyle.textAlign,
      });
      this.requestRender();
      return;
    }

    if (this.tool === "code") {
      const el = this.remeasureText({ ...this.makeTextElement("", pt.x, pt.y, 14, "mono", "#eeffff", "left", true), isCodeCard: true, codeLanguage: "auto", title: "Code" });
      this.elements = [...this.elements, el]; this.selectedIds = new Set([el.id]);
      this.tool = "select"; this.emitTool(); this.commit(); this.editingId = el.id; this.onEditCode?.(el.id); return;
    }
    if (this.tool === "doc") {
      this.tool = "select";
      this.emitTool();
      this.updateCursor();
      const docEl = this.remeasureText(this.makeTextElement("", pt.x, pt.y, 15, "sans", "#FFFFFF", "left", true));
      this.elements = [...this.elements, docEl];
      this.selectedIds = new Set([docEl.id]);
      this.commit();
      this.openEditorFor(docEl);
      return;
    }

    if (this.tool === "sticky") {
      const start = this.snapPoint(pt);
      const sticky: StickyElement = {
        id: newId(),
        type: "sticky",
        x: start.x,
        y: start.y,
        width: 180,
        height: 140,
        text: "",
        color: "#FEF08A",
        fontSize: 15,
        stroke: "#1E293B",
        strokeWidth: 1,
        strokeStyle: "solid",
        fill: "#FEF08A",
        fillStyle: "solid",
        roundness: "rounded",
        opacity: 1,
        zIndex: this.elements.length,
      };
      this.elements = [...this.elements, sticky];
      this.selectedIds = new Set([sticky.id]);
      this.tool = "select";
      this.emitTool();
      this.commit();
      this.openEditorFor(sticky);
      return;
    }

    this.gesture = { kind: "draft", origin: this.snapPoint(pt) };
    this.draft = this.createDraft(pt);
    if (this.draft.type === "arrow") {
      const snap = this.findNearestAnchor(pt);
      if (snap) {
        this.draft = { ...this.draft, startX: snap.x, startY: snap.y, startBinding: { elementId: snap.elementId, anchor: snap.anchor } } as ArrowElement;
        this.hoveredAnchors = snap.all;
        this.snapTarget = { anchor: snap.anchor };
      }
    }
    this.requestRender();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.isPrimary === false || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) return;
    this.shiftDown = e.shiftKey;
    this.altDown = !!e.altKey;
    const sp = this.screenPoint(e);
    const pt = this.screenToCanvas(sp.x, sp.y);
    const g = this.gesture;
    this.onCursorChange?.(pt);

    if (!g) {
      this.updateHoverCursor(pt);
      return;
    }

    switch (g.kind) {
      case "pan":
        this.pan = { x: this.pan.x + sp.x - g.last.x, y: this.pan.y + sp.y - g.last.y };
        g.last = sp;
        break;
      case "erase":
        this.eraseAt(pt);
        break;
      case "move":
        this.moveSelection(pt);
        break;
      case "resize":
        this.resizeSelection(pt);
        break;
      case "endpoint":
        this.moveEndpoint(pt);
        break;
      case "marquee":
        this.updateMarquee(pt);
        break;
      case "draft":
        this.updateDraft(pt);
        break;
    }
    this.requestRender();
  };

  private releasePointer() {
    const id = this.activePointerId;
    this.activePointerId = null;
    if (id !== null && this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id);
  }

  private cancelGesture = () => {
    if (this.gesture) {
      // This baseline includes remote updates received during the drag.
      this.elements = pruneBindings([...this.committedElements]);
      this.selectedIds = new Set([...this.selectedIds].filter(id => this.elements.some(el => el.id === id)));
    }
    this.gesture = null;
    this.draft = null;
    this.marqueeRect = null;
    this.guides = [];
    this.hoveredAnchors = [];
    this.snapTarget = null;
    this.releasePointer();
    this.emitSelection(); this.updateCursor(); this.requestRender();
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === this.activePointerId) this.cancelGesture();
  };

  private onLostPointerCapture = (e: PointerEvent) => {
    if (e.pointerId === this.activePointerId) this.cancelGesture();
  };

  private onWindowBlur = () => {
    this.spaceDown = false;
    this.shiftDown = false;
    this.cancelGesture();
  };

  private onPointerUp = (e?: PointerEvent) => {
    if (e && this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
    const g = this.gesture;
    this.gesture = null;
    this.guides = [];
    this.releasePointer();
    if (!g) return;
    this.snapTarget = null;
    this.hoveredAnchors = [];

    switch (g.kind) {
      case "move":
        if (g.moved) {
          this.commit();
        } else if (g.soloId) {
          this.selectedIds = new Set([g.soloId]);
          this.emitSelection();
        }
        break;
      case "resize":
      case "endpoint":
        this.commit();
        break;
      case "erase":
        if (g.erased) this.commit();
        break;
      case "marquee":
        this.marqueeRect = null;
        this.emitSelection();
        break;
      case "draft":
        this.finishDraft();
        break;
      case "pan":
        break;
    }
    this.updateCursor();
    this.requestRender();
  };

  private onDoubleClick = (e: MouseEvent) => {
    if (this.readOnly || this.tool === "hand" || this.tool === "pencil" || this.spaceDown || e.button === 2) return;
    e.preventDefault();
    this.cancelGesture();
    const sp = this.screenPoint(e), pt = this.screenToCanvas(sp.x, sp.y);
    const hit = this.hitTest(pt);
    if (hit?.type === "arrow" && hit.label) { this.openEditorFor(hit); return; }
    if (hit?.type === "frame" && pt.y < hit.y + 8 / this.zoom) { this.openEditorFor(hit); return; }
    if (hit?.type === "text" || hit?.type === "sticky") { this.openEditorFor(hit, pt); return; }
    this.tool = "select"; this.emitTool(); this.selectedIds.clear(); this.emitSelection();
    const frame = !hit ? [...this.elements].reverse().find(el => el.type === "frame" && pt.x >= el.x && pt.x <= el.x + el.width && pt.y >= el.y && pt.y <= el.y + el.height) : null;
    const container = hit && ["rectangle", "diamond", "circle", "frame"].includes(hit.type) ? hit : frame;
    const box = container ? normalizeRect(container) : null;
    const legacyLabel = container && container.type !== "frame" ? container.label : undefined;
    if (legacyLabel && container) this.editingId = container.id;
    this.onStartInlineText?.({ kind: "new-text", canvasX: pt.x, canvasY: pt.y, screenX: sp.x, screenY: sp.y,
      text: legacyLabel || "", fontSize: this.currentStyle.fontSize, fontFamily: this.currentStyle.fontFamily, color: this.currentStyle.stroke || "#FFFFFF", align: "left",
      ...(legacyLabel && container ? { replaceLabelId: container.id } : {}),
      bold: this.currentStyle.bold, italic: this.currentStyle.italic, underline: this.currentStyle.underline, strikethrough: this.currentStyle.strikethrough,
      ...(container && box ? { containerId: container.id, containerOffset: { x: (pt.x - box.x) / Math.max(1, box.w), y: (pt.y - box.y) / Math.max(1, box.h) } } : {}),
    });
    this.requestRender();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const sp = this.screenPoint(e);
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch or ctrl+wheel zooms around the pointer.
      this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0025), sp);
      return;
    }
    if (e.shiftKey && e.deltaX === 0) {
      this.pan = { x: this.pan.x - e.deltaY, y: this.pan.y };
    } else {
      this.pan = { x: this.pan.x - e.deltaX, y: this.pan.y - e.deltaY };
    }
    this.requestRender();
  };

  // --- Gesture helpers -----------------------------------------------------------------

  private createDraft(pt: Point, tool: Tool = this.tool): CanvasElement {
    const id = newId();
    const style = this.currentStyle;
    const base = {
      id,
      x: pt.x,
      y: pt.y,
      width: 0,
      height: 0,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      fill: style.fill,
      fillStyle: style.fill === "transparent" ? ("none" as const) : ("solid" as const),
      roundness: style.roundness,
      opacity: style.opacity,
      zIndex: this.elements.length,
    };
    const start = this.snapPoint(pt);
    switch (tool) {
      case "rectangle":
        return { ...base, type: "rectangle", x: start.x, y: start.y };
      case "diamond":
        return { ...base, type: "diamond", x: start.x, y: start.y };
      case "circle":
        return { ...base, type: "circle", x: start.x, y: start.y };
      case "frame":
        return { ...base, type: "frame", x: start.x, y: start.y, title: "Frame", fill: "transparent", fillStyle: "none" };
      case "arrow":
        return {
          ...base,
          type: "arrow",
          startX: pt.x,
          startY: pt.y,
          endX: pt.x,
          endY: pt.y,
          routing: style.arrowRouting || "elbow",
          arrowHeadStart: style.arrowHeadStart || "none",
          arrowHeadEnd: style.arrowHeadEnd || "arrow",
          animated: style.arrowAnimated || false,
        } as ArrowElement;
      case "line":
        return { ...base, type: "line", startX: start.x, startY: start.y, endX: start.x, endY: start.y } as LineElement;
      case "pencil":
      default:
        return { ...base, type: "pencil", points: [pt] };
    }
  }

  private updateDraft(pt: Point) {
    const d = this.draft;
    if (!d) return;
    const origin = d.type === "arrow" || d.type === "line"
      ? { x: d.startX, y: d.startY }
      : this.gesture?.kind === "draft" ? this.gesture.origin : { x: d.x, y: d.y };
    let target = this.snapPoint(pt);

    if (d.type === "pencil") {
      this.draft = { ...d, points: [...d.points, pt] };
      return;
    }

    if (d.type === "arrow" || d.type === "line") {
      if (d.type === "line" && this.shiftDown) target = this.constrainAngle(origin, target);
      if (d.type === "arrow") {
        const snap = this.findNearestAnchor(pt, d.id);
        if (snap) {
          this.hoveredAnchors = snap.all;
          this.snapTarget = { anchor: snap.anchor };
          this.draft = { ...d, endX: snap.x, endY: snap.y, endBinding: { elementId: snap.elementId, anchor: snap.anchor } } as ArrowElement;
          return;
        }
        this.hoveredAnchors = [];
        this.snapTarget = null;
        const end = this.shiftDown ? this.constrainAngle(origin, pt) : pt;
        this.draft = { ...d, endX: end.x, endY: end.y, endBinding: undefined } as ArrowElement;
        return;
      }
      this.draft = { ...d, endX: target.x, endY: target.y } as LineElement;
      return;
    }

    // Shapes: drag from origin to pointer, optionally forcing a square / circle.
    let dx = target.x - origin.x;
    let dy = target.y - origin.y;
    if (this.shiftDown) {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * side;
      dy = Math.sign(dy || 1) * side;
    }
    const x = dx >= 0 ? origin.x : origin.x + dx;
    const y = dy >= 0 ? origin.y : origin.y + dy;
    this.draft = { ...d, x, y, width: Math.abs(dx), height: Math.abs(dy) } as CanvasElement;
    this.guides = smartGuides(getElementBounds(this.draft), this.elements.filter(el => el.type !== "arrow" && el.type !== "line" && el.type !== "frame").map(el => getElementBounds(el)), this.zoom, false).guides;
  }

  private constrainAngle(origin: Point, pt: Point): Point {
    const dx = pt.x - origin.x;
    const dy = pt.y - origin.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: origin.x + Math.cos(angle) * dist, y: origin.y + Math.sin(angle) * dist };
  }

  private finishDraft() {
    const d = this.draft;
    this.draft = null;
    if (!d) return;

    let keep: boolean;
    let finalEl: CanvasElement = d;
    if (d.type === "pencil") {
      keep = d.points.length >= 2;
      const b = getElementBounds(d);
      finalEl = { ...d, x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY };
    } else if (d.type === "arrow" || d.type === "line") {
      keep = Math.hypot(d.endX - d.startX, d.endY - d.startY) > MIN_SIZE;
      if (keep) finalEl = syncLineBox(d);
    } else {
      keep = d.width > MIN_SIZE && d.height > MIN_SIZE;
    }

    if (keep) {
      this.elements = [...this.elements, finalEl];
      if (d.type === "pencil") {
        this.selectedIds.clear();
      } else {
        this.selectedIds = new Set([finalEl.id]);
        this.tool = "select";
        this.emitTool();
      }
    }
    this.commit();
  }

  private moveSelection(pt: Point) {
    const g = this.gesture;
    if (!g || g.kind !== "move") return;
    const rawDx = pt.x - g.origin.x;
    const rawDy = pt.y - g.origin.y;
    const dx = this.snapToGrid ? Math.round(rawDx / SNAP_GRID) * SNAP_GRID : rawDx;
    const dy = this.snapToGrid ? Math.round(rawDy / SNAP_GRID) * SNAP_GRID : rawDy;
    if (dx === 0 && dy === 0 && !g.moved) return;
    g.moved = true;

    const movedIds = new Set(g.snapshots.keys());
    let moved = this.elements.map((el) => {
      const snap = g.snapshots.get(el.id);
      return snap ? translateElement(snap, dx, dy, movedIds) : el;
    });
    const shapes = moved.filter(el => this.selectedIds.has(el.id) && el.type !== "arrow" && el.type !== "line");
    const bounds = unionBounds(shapes.map(el => getElementBounds(el)));
    if (bounds) {
      const others = moved.filter(el => !movedIds.has(el.id) && el.type !== "arrow" && el.type !== "line" && el.type !== "frame").map(el => getElementBounds(el));
      const result = smartGuides(bounds, others, this.zoom, !this.altDown && !this.snapToGrid);
      this.guides = result.guides;
      if (result.dx || result.dy) moved = moved.map(el => movedIds.has(el.id) ? translateElement(el, result.dx, result.dy, movedIds) : el);
    } else this.guides = [];
    this.elements = resolveBindings(moved, movedIds);
  }

  private resizeSelection(pt: Point) {
    const g = this.gesture;
    if (!g || g.kind !== "resize") return;
    const snapshot = g.snapshot;
    const bounds = getElementBounds(snapshot);
    const r = snapshot.type === "pencil" ? { x: bounds.minX, y: bounds.minY, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY } : normalizeRect(snapshot);
    const dx = pt.x - g.origin.x, dy = pt.y - g.origin.y;
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
    if (g.handle.includes("w")) x0 = Math.min(this.snapPoint({ x: r.x + dx, y: r.y }).x, x1 - MIN_SIZE);
    if (g.handle.includes("e")) x1 = Math.max(this.snapPoint({ x: r.x + r.w + dx, y: r.y }).x, x0 + MIN_SIZE);
    if (g.handle.includes("n")) y0 = Math.min(this.snapPoint({ x: r.x, y: r.y + dy }).y, y1 - MIN_SIZE);
    if (g.handle.includes("s")) y1 = Math.max(this.snapPoint({ x: r.x, y: r.y + r.h + dy }).y, y0 + MIN_SIZE);

    const id = snapshot.id;
    const resized = this.elements.map(el => {
      if (el.id !== id) return el;
      if (dx === 0 && dy === 0) return snapshot;
      const rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      if (snapshot.type === "pencil") return { ...snapshot, ...rect, points: snapshot.points.map(p => ({ x: x0 + (p.x - r.x) * rect.width / Math.max(r.w, 1), y: y0 + (p.y - r.y) * rect.height / Math.max(r.h, 1) })) };
      if (snapshot.type === "text") {
        const horizontal = g.handle.includes("w") || g.handle.includes("e");
        const vertical = g.handle.includes("n") || g.handle.includes("s");
        const scale = horizontal && vertical ? Math.max(rect.width / Math.max(r.w, 1), rect.height / Math.max(r.h, 1)) : horizontal ? rect.width / Math.max(r.w, 1) : rect.height / Math.max(r.h, 1);
        const text = this.remeasureText({ ...snapshot, fontSize: Math.max(8, Math.min(512, snapshot.fontSize * scale)) });
        return { ...text, x: g.handle.includes("w") ? r.x + r.w - text.width : r.x, y: g.handle.includes("n") ? r.y + r.h - text.height : r.y };
      }
      if (snapshot.type === "sticky") return this.fitSticky({ ...snapshot, ...rect });
      return { ...snapshot, ...rect };
    });
    this.elements = resolveBindings(resized, new Set([id]));
    const current = this.elements.find(el => el.id === id);
    this.guides = current ? smartGuides(getElementBounds(current), this.elements.filter(el => el.id !== id && !(el.type === "text" && el.containerId === id) && el.type !== "arrow" && el.type !== "line" && el.type !== "frame").map(el => getElementBounds(el)), this.zoom, false).guides : [];
  }

  private moveEndpoint(pt: Point) {
    const g = this.gesture;
    if (!g || g.kind !== "endpoint") return;
    const el = g.snapshot;
    const id = el.id;

    if (g.handle === "mid") {
      if (el.type !== "arrow") return;
      const routing = el.routing || el.elbow || "straight";
      let bendOffset = el.bendOffset;
      if (routing === "curved" || routing === "straight") {
        const mx = (el.startX + el.endX) / 2;
        const my = (el.startY + el.endY) / 2;
        const dx = el.endX - el.startX;
        const dy = el.endY - el.startY;
        const dist = Math.hypot(dx, dy) || 1;
        // The quadratic midpoint sits halfway between the chord and control point.
        // Double the pointer displacement so the visible handle follows the drag.
        bendOffset = 2 * ((pt.x - mx) * (-dy / dist) + (pt.y - my) * (dx / dist));
      } else if (routing === "elbow") {
        const horizontal = Math.abs(el.endX - el.startX) >= Math.abs(el.endY - el.startY);
        bendOffset = horizontal ? pt.x - el.startX : pt.y - el.startY;
      }
      const nextRouting = routing === "straight" ? "curved" : routing;
      this.elements = this.elements.map((e) => (e.id === id ? ({ ...e, routing: nextRouting, elbow: nextRouting, bendOffset } as CanvasElement) : e));
      return;
    }

    const isStart = g.handle === "start";
    const snap = el.type === "arrow" ? this.findNearestAnchor(pt, id) : null;
    let x: number;
    let y: number;
    let binding: { elementId: string; anchor: AnchorPosition } | undefined;
    if (snap) {
      x = snap.x;
      y = snap.y;
      binding = { elementId: snap.elementId, anchor: snap.anchor };
      this.hoveredAnchors = snap.all;
      this.snapTarget = { anchor: snap.anchor };
    } else {
      const p = this.snapPoint(pt);
      x = p.x;
      y = p.y;
      this.hoveredAnchors = [];
      this.snapTarget = null;
    }

    this.elements = this.elements.map((e) => {
      if (e.id !== id) return e;
      if (e.type === "arrow") {
        const next = isStart
          ? { ...e, startX: x, startY: y, startBinding: binding }
          : { ...e, endX: x, endY: y, endBinding: binding };
        return syncLineBox(next as ArrowElement);
      }
      if (e.type === "line") {
        return syncLineBox(isStart ? { ...e, startX: x, startY: y } : { ...e, endX: x, endY: y });
      }
      return e;
    });
  }

  private updateMarquee(pt: Point) {
    const g = this.gesture;
    if (!g || g.kind !== "marquee") return;
    const rect: Bounds = {
      minX: Math.min(g.start.x, pt.x),
      minY: Math.min(g.start.y, pt.y),
      maxX: Math.max(g.start.x, pt.x),
      maxY: Math.max(g.start.y, pt.y),
    };
    this.marqueeRect = rect;
    const next = new Set(g.base);
    for (const el of this.elements) {
      const b = getElementBounds(el);
      const hit = b.maxX >= rect.minX && b.minX <= rect.maxX && b.maxY >= rect.minY && b.minY <= rect.maxY;
      if (hit) next.add(el.id);
    }
    this.selectedIds = next;
    this.emitSelection();
  }

  private eraseAt(pt: Point) {
    const g = this.gesture;
    const target = this.hitTest(pt);
    if (!target) return;
    const ids = this.withContainedText(new Set([target.id]));
    this.elements = pruneBindings(this.elements.filter((el) => !ids.has(el.id)));
    for (const id of ids) this.selectedIds.delete(id);
    if (g && g.kind === "erase") g.erased = true;
    this.emitSelection();
    this.requestRender();
  }

  // --- Cursor ----------------------------------------------------------------------

  private updateHoverCursor(pt: Point) {
    this.hoveredAnchors = [];
    this.snapTarget = null;
    if (this.readOnly || this.spaceDown || this.tool === "hand") {
      this.updateCursor(); this.requestRender(); return;
    }
    const selected = this.getSelectedElements();
    const handle = this.tool === "select" && selected.length === 1 ? this.handleAt(selected[0], pt) : null;
    if (handle) {
      this.canvas.style.cursor = HANDLE_CURSOR[handle];
    } else if (this.tool === "arrow") {
      const snap = this.findNearestAnchor(pt);
      this.hoveredAnchors = snap?.all ?? [];
      this.snapTarget = snap ? { anchor: snap.anchor } : null;
      this.updateCursor();
    } else if (this.tool === "select") {
      const snap = selected.length === 1 ? this.findNearestAnchor(pt, undefined, selected[0].id) : null;
      this.snapTarget = snap && Math.hypot(pt.x - snap.x, pt.y - snap.y) < 10 / this.zoom ? { anchor: snap.anchor } : null;
      this.canvas.style.cursor = this.snapTarget ? "crosshair" : this.hitTest(pt) ? "move" : "default";
    } else this.updateCursor();
    this.requestRender();
  }

  private updateCursor() {
    if (this.readOnly || this.gesture?.kind === "pan" || this.spaceDown) {
      this.canvas.style.cursor = this.gesture?.kind === "pan" ? "grabbing" : "grab";
      return;
    }
    switch (this.tool) {
      case "select":
        this.canvas.style.cursor = "default";
        break;
      case "hand":
        this.canvas.style.cursor = "grab";
        break;
      case "eraser":
        this.canvas.style.cursor = "cell";
        break;
      case "text":
        this.canvas.style.cursor = "text";
        break;
      default:
        this.canvas.style.cursor = "crosshair";
    }
  }

  // --- Keyboard ---------------------------------------------------------------------

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.isComposing || (e.target instanceof HTMLElement && e.target.getAttribute("role") === "separator") || this.isTypingTarget(e.target) || document.querySelector("dialog[open]")) return;
    this.shiftDown = e.shiftKey;
    this.altDown = !!e.altKey;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (e.code === "Space" && !e.repeat) {
      this.spaceDown = true;
      this.updateCursor();
      e.preventDefault();
      return;
    }

    if (this.readOnly) {
      if (key === "+" || key === "=") { e.preventDefault(); this.zoomIn(); }
      else if (key === "-") { e.preventDefault(); this.zoomOut(); }
      return;
    }
    if (mod) {
      switch (key) {
        case "b": case "i": case "u":
          e.preventDefault(); this.toggleTextFormatting(key === "b" ? "bold" : key === "i" ? "italic" : "underline"); return;
        case "x":
          if (e.shiftKey) { e.preventDefault(); this.toggleTextFormatting("strikethrough"); return; }
          e.preventDefault(); this.cutSelection(); return;
        case "z":
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
          return;
        case "y":
          e.preventDefault();
          this.redo();
          return;
        case "a":
          e.preventDefault();
          this.selectAll();
          return;
        case "d":
          e.preventDefault();
          this.duplicateSelected();
          return;
        case "c":
          e.preventDefault();
          this.copySelection();
          return;
        case "v":
          e.preventDefault();
          this.paste();
          return;
        case "=":
        case "+":
          e.preventDefault();
          this.zoomIn();
          return;
        case "-":
          e.preventDefault();
          this.zoomOut();
          return;
        case "0":
          e.preventDefault();
          this.resetZoom();
          return;
        case ">":
        case ".":
          e.preventDefault();
          this.changeFontSize(2);
          return;
        case "<":
        case ",":
          e.preventDefault();
          this.changeFontSize(-2);
          return;
        case "]":
          e.preventDefault();
          this.bringToFront();
          return;
        case "[":
          e.preventDefault();
          this.sendToBack();
          return;
      }
      return;
    }

    switch (e.key) {
      case "Delete":
      case "Backspace":
        if (this.selectedIds.size > 0) {
          e.preventDefault();
          this.deleteSelected();
        }
        return;
      case "Escape":
        this.cancelGesture();
        this.selectedIds.clear();
        this.emitSelection();
        this.setTool("select");
        return;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        if (this.selectedIds.size > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          const ids = this.selectedIds;
          const moved = this.elements.map((el) => (ids.has(el.id) ? translateElement(el, dx, dy, ids) : el));
          this.elements = resolveBindings(moved, ids);
          this.commit();
        }
        return;
      case "1":
        if (e.shiftKey) this.fitToContent();
        return;
    }

    if (e.altKey) return;
    switch (key) {
      case "v":
        this.setTool("select");
        break;
      case "h":
        this.setTool("hand");
        break;
      case "r":
        this.setTool("rectangle");
        break;
      case "d":
        this.setTool("diamond");
        break;
      case "o":
        this.setTool("circle");
        break;
      case "a":
        this.setTool("arrow");
        break;
      case "l":
        this.setTool("line");
        break;
      case "p":
        this.setTool("pencil");
        break;
      case "c":
        this.setTool("code");
        break;
      case "t":
        this.setTool("text");
        break;
      case "n":
        this.setTool("doc");
        break;
      case "s":
        this.setTool("sticky");
        break;
      case "f":
        this.setTool("frame");
        break;
      case "e":
        this.setTool("eraser");
        break;
      case "i":
        this.onOpenIconPicker?.();
        break;
      case "+":
      case "=":
        this.zoomIn();
        break;
      case "-":
        this.zoomOut();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.shiftDown = e.shiftKey;
    this.altDown = !!e.altKey;
    if (e.code === "Space") {
      this.spaceDown = false;
      this.updateCursor();
    }
  };

  // --- History ------------------------------------------------------------------------

  /** Records the current elements as an undo step. Returns true if they changed. */
  private pushHistory(): boolean {
    const snapshot = JSON.stringify(this.elements);
    if (this.undoStack[this.undoStack.length - 1] === snapshot) return false;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }

  /** Finishes a user edit: records history, persists, and refreshes the UI. */
  private commit() {
    this.committedElements = [...this.elements];
    const changed = this.pushHistory();
    if (changed) this.onChange?.(this.elements);
    this.emitSelection();
    this.emitHistory();
    this.requestRender();
  }

  public undo() {
    if (this.gesture) this.cancelGesture();
    if (this.collaborativeUndo) { this.collaborativeUndo(); return; }
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop()!);
    this.restoreSnapshot(this.undoStack[this.undoStack.length - 1]);
  }

  public redo() {
    if (this.gesture) this.cancelGesture();
    if (this.collaborativeRedo) { this.collaborativeRedo(); return; }
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(next);
    this.restoreSnapshot(next);
  }

  private restoreSnapshot(snapshot: string) {
    this.elements = JSON.parse(snapshot) as CanvasElement[];
    this.committedElements = [...this.elements];
    this.selectedIds = new Set([...this.selectedIds].filter((id) => this.elements.some((e) => e.id === id)));
    this.onChange?.(this.elements);
    this.emitSelection();
    this.emitHistory();
    this.requestRender();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // --- Emitters -------------------------------------------------------------------

  private emitSelection() {
    this.onSelectionChange?.(this.getSelectedElements());
  }

  private emitTool() {
    this.onToolChange?.(this.tool);
  }

  private emitHistory() {
    this.onHistoryChange?.(this.canUndo(), this.canRedo());
  }

  // --- Lifecycle ----------------------------------------------------------------------

  private attachEventListeners() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("lostpointercapture", this.onLostPointerCapture);
    window.addEventListener("blur", this.onWindowBlur);
    this.canvas.addEventListener("dblclick", this.onDoubleClick);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  public destroy() {
    this.destroyed = true;
    this.gesture = null;
    this.releasePointer();
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = null;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("lostpointercapture", this.onLostPointerCapture);
    window.removeEventListener("blur", this.onWindowBlur);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}

// Re-exported so callers that build labels or viewport text can use the same font helper.
export { setFont, ACCENT };
