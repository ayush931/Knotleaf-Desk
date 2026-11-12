"use client";

import React, { useMemo } from "react";
import { ChevronDown, ChevronUp, Map } from "lucide-react";
import type { CanvasElement, Theme } from "@/draw/types";
import { getElementBounds } from "@/draw/renderer";
import { elementAccent } from "@/lib/premiumPalette";

interface MinimapProps {
  elements: CanvasElement[];
  viewport: { zoom: number; pan: { x: number; y: number } };
  width: number;
  height: number;
  open: boolean;
  onToggle: () => void;
  onNavigate: (point: { x: number; y: number }) => void;
  theme: Theme;
}

const MAP_WIDTH = 210;
const MAP_HEIGHT = 140;

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
interface MinimapLayout {
  items: { element: CanvasElement; bounds: Bounds }[];
  scale: number;
  originX: number;
  originY: number;
}

/** Fit every element's bounds into the fixed map box, keeping the drawing centred. */
export function minimapLayout(elements: CanvasElement[]): MinimapLayout | null {
  const items: MinimapLayout["items"] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const element of elements) {
    let bounds: Bounds;
    try { bounds = getElementBounds(element); }
    catch { continue; /* An element without geometry is simply not mapped. */ }
    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) continue;
    minX = Math.min(minX, bounds.minX); minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX); maxY = Math.max(maxY, bounds.maxY);
    items.push({ element, bounds });
  }
  if (!items.length || !Number.isFinite(minX)) return null;
  const contentWidth = Math.max(1, maxX - minX), contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min((MAP_WIDTH - 24) / contentWidth, (MAP_HEIGHT - 24) / contentHeight, 0.45);
  return {
    items,
    scale,
    originX: (MAP_WIDTH - contentWidth * scale) / 2 - minX * scale,
    originY: (MAP_HEIGHT - contentHeight * scale) / 2 - minY * scale,
  };
}

export function Minimap({ elements, viewport, width, height, open, onToggle, onNavigate, theme }: MinimapProps) {
  const light = theme === "light";
  const map = useMemo(() => (elements.length && width > 0 && height > 0 ? minimapLayout(elements) : null), [elements, width, height]);

  if (!elements.length) return null;

  if (!open) {
    return <button
      type="button"
      onClick={onToggle}
      aria-label="Open minimap"
      title="Open board minimap"
      className="workspace-minimap-toggle absolute bottom-[68px] right-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border drawing-panel px-2.5 text-[11px] font-medium text-neutral-500 shadow-sm transition hover:text-neutral-900 dark:hover:text-white max-[520px]:hidden"
    >
      <Map aria-hidden="true" className="h-3.5 w-3.5" /> Map
    </button>;
  }

  const viewWorldWidth = width / Math.max(0.01, viewport.zoom), viewWorldHeight = height / Math.max(0.01, viewport.zoom);
  const viewWorldX = -viewport.pan.x / Math.max(0.01, viewport.zoom), viewWorldY = -viewport.pan.y / Math.max(0.01, viewport.zoom);

  return <section aria-label="Board minimap" className="workspace-minimap absolute bottom-[68px] right-3 z-30 w-[210px] overflow-hidden rounded-xl border drawing-panel shadow-lg max-[520px]:hidden">
    <header className="flex h-8 items-center justify-between border-b border-neutral-200/70 px-2.5 dark:border-neutral-800">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500"><Map aria-hidden="true" className="h-3 w-3" /> Board map</span>
      <button type="button" onClick={onToggle} aria-label="Collapse minimap" title="Collapse board minimap" className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </header>
    <div
      role="button"
      tabIndex={0}
      aria-label="Navigate board map"
      title="Click or press Enter to centre the canvas"
      className="minimap-surface relative overflow-hidden"
      style={{ height: MAP_HEIGHT }}
      onClick={event => {
        if (!map) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onNavigate({ x: (event.clientX - rect.left - map.originX) / map.scale, y: (event.clientY - rect.top - map.originY) / map.scale });
      }}
      onKeyDown={event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onNavigate({ x: (viewWorldX + viewWorldWidth / 2), y: (viewWorldY + viewWorldHeight / 2) });
      }}
    >
      {map && <>
        {map.items.map(({ element, bounds }) => {
          const local = (element.type === "sticky" && "fill" in element && /^#[\da-f]{6}$/i.test(String(element.fill))) ? String(element.fill) : elementAccent(element.type, light);
          const isContainer = element.type === "frame";
          return <span
            key={element.id}
            aria-hidden="true"
            className={`minimap-item absolute ${isContainer ? "minimap-frame" : ""}`}
            style={{
              left: bounds.minX * map.scale + map.originX,
              top: bounds.minY * map.scale + map.originY,
              width: Math.max(isContainer ? 4 : 2, (bounds.maxX - bounds.minX) * map.scale),
              height: Math.max(isContainer ? 4 : 2, (bounds.maxY - bounds.minY) * map.scale),
              ...(isContainer ? { borderColor: local } : { backgroundColor: local }),
              opacity: element.opacity ?? 1,
            }}
          />;
        })}
        <span
          aria-hidden="true"
          className="minimap-viewport absolute rounded-[3px]"
          style={{
            left: viewWorldX * map.scale + map.originX,
            top: viewWorldY * map.scale + map.originY,
            width: Math.max(8, viewWorldWidth * map.scale),
            height: Math.max(6, viewWorldHeight * map.scale),
          }}
        />
      </>}
      {!map && <p className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-500">Nothing to map yet</p>}
    </div>
    <footer className="flex items-center justify-between px-2.5 py-1.5 text-[9px] text-neutral-500">
      <span>{elements.length} object{elements.length === 1 ? "" : "s"}</span>
      <span className="flex items-center gap-1"><ChevronUp aria-hidden="true" className="h-2.5 w-2.5" /> click to navigate</span>
    </footer>
  </section>;
}
