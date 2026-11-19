"use client";

import { useId, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, LocateFixed, Map } from "lucide-react";
import type { CanvasElement, Point, Theme } from "@/draw/types";
import { computeArrowPath, computeLinePath, getElementBounds } from "@/draw/renderer";
import { elementAccent } from "@/lib/premiumPalette";
import { usePointerDrag } from "@/lib/usePointerDrag";
import { isContextPointer } from "@/lib/pointerInput";

interface MinimapProps {
  elements: CanvasElement[];
  selected?: CanvasElement[];
  viewport: { zoom: number; pan: Point };
  width: number;
  height: number;
  open: boolean;
  onToggle: () => void;
  onNavigate: (point: Point) => void;
  onFit?: () => void;
  theme: Theme;
}

const MAP_WIDTH = 252;
const MAP_HEIGHT = 148;
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
interface MinimapLayout {
  items: { element: CanvasElement; bounds: Bounds }[];
  scale: number;
  originX: number;
  originY: number;
}

export function minimapLayout(elements: CanvasElement[]): MinimapLayout | null {
  const items: MinimapLayout["items"] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const element of elements) {
    let bounds: Bounds;
    try { bounds = getElementBounds(element, elements); }
    catch { continue; }
    if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) continue;
    bounds = { ...bounds, maxX: Math.max(bounds.minX + 1, bounds.maxX), maxY: Math.max(bounds.minY + 1, bounds.maxY) };
    minX = Math.min(minX, bounds.minX); minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX); maxY = Math.max(maxY, bounds.maxY);
    items.push({ element, bounds });
  }
  if (!items.length) return null;
  const contentWidth = maxX - minX, contentHeight = maxY - minY;
  const scale = Math.min((MAP_WIDTH - 30) / contentWidth, (MAP_HEIGHT - 30) / contentHeight, 0.45);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    items,
    scale,
    originX: (MAP_WIDTH - contentWidth * scale) / 2 - minX * scale,
    originY: (MAP_HEIGHT - contentHeight * scale) / 2 - minY * scale,
  };
}

function mapPoint(x: number, y: number, map: MinimapLayout): Point {
  return { x: (x - map.originX) / map.scale, y: (y - map.originY) / map.scale };
}

function toMapPosition(element: HTMLElement, clientX: number, clientY: number): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / Math.max(1, rect.width) * MAP_WIDTH,
    y: (clientY - rect.top) / Math.max(1, rect.height) * MAP_HEIGHT,
  };
}

function pathFor(element: CanvasElement, scene: CanvasElement[]) {
  if (element.type === "line" || element.type === "arrow") {
    const route = element.type === "line" ? computeLinePath(element, scene) : computeArrowPath(element, scene);
    if (route.cpx !== undefined && route.cpy !== undefined) {
      const [start, end] = route.points;
      return `M${start.x} ${start.y}Q${route.cpx} ${route.cpy} ${end.x} ${end.y}`;
    }
    return route.points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join("");
  }
  if (element.type !== "pencil" || element.points.length < 2) return "";
  const step = Math.ceil(element.points.length / 120);
  const points = element.points.filter((_, index) => index % step === 0 || index === element.points.length - 1);
  return points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join("");
}

function drawMapItem({ element, bounds }: MinimapLayout["items"][number], scene: CanvasElement[], scale: number, light: boolean, selected: boolean) {
  const { minX: x, minY: y } = bounds;
  const width = Math.max(1.8 / scale, bounds.maxX - x);
  const height = Math.max(1.8 / scale, bounds.maxY - y);
  const accent = selected ? "var(--ui-accent)" : /^#[\da-f]{3,8}$/i.test(element.stroke) && element.type !== "frame" &&
    !/^(#fff(?:fff)?|#000(?:000)?|#f4f4f5)$/i.test(element.stroke)
    ? element.stroke : elementAccent(element.type, light);
  const fill = element.type === "sticky" && /^#[\da-f]{6}$/i.test(element.fill) ? element.fill : accent;
  const path = pathFor(element, scene);
  const line = { stroke: accent, strokeWidth: selected ? 2 : 1.2, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  let shape;
  if (path) shape = <path d={path} fill="none" {...line} />;
  else if (element.type === "circle") shape = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={fill} fillOpacity=".5" {...line} />;
  else if (element.type === "diamond") shape = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} fill={fill} fillOpacity=".5" {...line} />;
  else if (element.type === "frame") shape = <rect x={x} y={y} width={width} height={height} rx={2 / scale} fill={accent} fillOpacity=".08" strokeDasharray="3 3" {...line} />;
  else shape = <rect x={x} y={y} width={width} height={height} rx={Math.min(2 / scale, height / 5)} fill={fill}
    fillOpacity={element.type === "sticky" || element.type === "text" ? ".85" : ".55"} {...(selected ? line : {})} />;
  return <g key={element.id} opacity={Math.max(.2, element.opacity ?? 1)}>{shape}</g>;
}

export function Minimap({ elements, selected = [], viewport, width, height, open, onToggle, onNavigate, onFit, theme }: MinimapProps) {
  const surface = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const gesture = useRef<{ start: Point; offset: Point; dragged: boolean } | null>(null);
  const visible = elements.length > 0 && width >= 240 && height >= 275;
  const map = useMemo(() => open && visible ? minimapLayout(elements) : null, [elements, open, visible]);
  const artwork = useMemo(() => {
    if (!map) return null;
    const ids = new Set(selected.map(element => element.id));
    // Frames provide context behind the artwork even when their z-index is higher.
    return [...map.items].sort((a, b) => Number(b.element.type === "frame") - Number(a.element.type === "frame"))
      .map(item => drawMapItem(item, elements, map.scale, theme === "light", ids.has(item.element.id)));
  }, [elements, map, selected, theme]);
  const zoom = Math.max(.01, viewport.zoom);
  const worldWidth = width / zoom, worldHeight = height / zoom;
  const center = { x: -viewport.pan.x / zoom + worldWidth / 2, y: -viewport.pan.y / zoom + worldHeight / 2 };
  const view = map ? {
    x: center.x * map.scale + map.originX, y: center.y * map.scale + map.originY,
    width: Math.max(5, worldWidth * map.scale), height: Math.max(5, worldHeight * map.scale),
  } : null;
  const offMap = view && (view.x + view.width / 2 < 0 || view.x - view.width / 2 > MAP_WIDTH ||
    view.y + view.height / 2 < 0 || view.y - view.height / 2 > MAP_HEIGHT);
  const frames = map?.items.filter(item => item.element.type === "frame") ?? [];
  const startDrag = usePointerDrag(event => {
    if (!gesture.current || !surface.current || !map) return;
    const current = toMapPosition(surface.current, event.clientX, event.clientY);
    const active = gesture.current;
    if (Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) >= 3) active.dragged = true;
    const ended = event.type === "pointerup";
    if (active.dragged || ended) {
      const offset = active.dragged ? active.offset : { x: 0, y: 0 };
      onNavigate(mapPoint(
        Math.max(0, Math.min(MAP_WIDTH, current.x)) + offset.x,
        Math.max(0, Math.min(MAP_HEIGHT, current.y)) + offset.y,
        map,
      ));
    }
    if (ended) gesture.current = null;
  });

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!map || !view || event.button !== 0 || event.isPrimary === false || isContextPointer(event)) return;
    const point = toMapPosition(event.currentTarget, event.clientX, event.clientY);
    const offset = { x: view.x - point.x, y: view.y - point.y };
    gesture.current = {
      start: { x: event.clientX, y: event.clientY },
      offset: Math.abs(offset.x) <= view.width / 2 && Math.abs(offset.y) <= view.height / 2 && !offMap ? offset : { x: 0, y: 0 },
      dragged: false,
    };
    startDrag(event);
  }

  function centerArtwork() {
    if (map) onNavigate(mapPoint(MAP_WIDTH / 2, MAP_HEIGHT / 2, map));
  }
  function changeExpanded() {
    onToggle();
    requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
  }

  if (!visible) return null;
  if (!open) return (
    <button type="button" ref={toggle} onClick={changeExpanded} aria-expanded={false}
      aria-label="Open minimap" title="Open board map" className="workspace-minimap-toggle">
      <Map aria-hidden="true" size={15} /> Map
    </button>
  );

  return (
    <section id={panelId} aria-label="Board minimap" className="workspace-minimap">
      <header>
        <span><Map aria-hidden="true" size={14} /> Board map</span>
        <div>
          <button type="button" aria-label="Fit board from minimap" title="Fit board to view" disabled={!map}
            onClick={onFit ?? centerArtwork}><LocateFixed aria-hidden="true" size={15} /></button>
          <button type="button" ref={toggle} onClick={changeExpanded} aria-expanded={true}
            aria-controls={panelId} aria-label="Collapse minimap" title="Collapse board map"><ChevronDown aria-hidden="true" size={16} /></button>
        </div>
      </header>
      <button ref={surface} type="button" aria-label="Navigate board map" disabled={!map}
        title="Click or drag to pan. Use arrow keys to pan or Enter to center the artwork."
        className="minimap-surface"
        onPointerDown={onPointerDown}
        onClick={event => {
          if (event.detail === 0) centerArtwork();
        }}
        onKeyDown={event => {
          if (!map) return;
          if (event.key === "Enter" || event.key === " " || event.key === "Home") {
            event.preventDefault(); event.stopPropagation(); centerArtwork();
          } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            onNavigate({
              x: center.x + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0) * worldWidth / 4,
              y: center.y + (event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0) * worldHeight / 4,
            });
          }
        }}>
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-hidden="true" className="minimap-art">
          {map && <g transform={`translate(${map.originX} ${map.originY}) scale(${map.scale})`}>{artwork}</g>}
          {view && (offMap ? (
            <g className="minimap-locator" transform={`translate(${Math.max(11, Math.min(MAP_WIDTH - 11, view.x))} ${Math.max(11, Math.min(MAP_HEIGHT - 11, view.y))}) rotate(${Math.atan2(view.y - MAP_HEIGHT / 2, view.x - MAP_WIDTH / 2) * 180 / Math.PI})`}>
              <circle r="8" /><path d="M-2 -3L3 0L-2 3Z" />
            </g>
          ) : (
            <rect className="minimap-viewport" x={view.x - view.width / 2} y={view.y - view.height / 2}
              width={view.width} height={view.height} rx="3" />
          ))}
        </svg>
        {!map && <span className="minimap-empty">No artwork to map</span>}
      </button>
      <footer>
        {frames.length > 0 ? (
          <select aria-label="Jump to frame" value="" onChange={event => {
            const frame = frames.find(item => item.element.id === event.target.value);
            if (frame) onNavigate({ x: (frame.bounds.minX + frame.bounds.maxX) / 2, y: (frame.bounds.minY + frame.bounds.maxY) / 2 });
          }}>
            <option value="">Jump to frame</option>
            {frames.map(({ element }, index) => <option key={element.id} value={element.id}>{element.type === "frame" && element.title.trim() || `Frame ${index + 1}`}</option>)}
          </select>
        ) : <span>{offMap ? "View outside map" : `${map?.items.length ?? 0} objects`}</span>}
        <span>{Math.round(zoom * 100)}%</span>
      </footer>
    </section>
  );
}
