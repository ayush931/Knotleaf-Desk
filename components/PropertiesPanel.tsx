"use client";
import { useAppearancePosition } from "@/lib/useAppearancePosition";
import { textSizeShortcut } from "@/lib/textShortcuts";
import { cardBackground, MIN_CODE_WIDTH, MIN_CODE_HEIGHT } from "@/draw/cardAppearance";

import React, { useLayoutEffect, useRef } from "react";
import { ColorPalette } from "./ColorPalette";
import { BackgroundStylePicker, type BackgroundPattern } from "./BackgroundStylePicker";
import { parseFillColor } from "@/lib/fillColor";
import { DEFAULT_BACKGROUND } from "@/lib/background.mjs";
import type { BackgroundSettings } from "@/draw/types";
import { ColorControl } from "./ColorControl";
import { FontSelect } from "./FontSelect";
import { COLOR_MOODS, PREMIUM_BACKGROUND_MOODS } from "@/lib/premiumPalette";
import { INK_STYLES, inkWidths, smoothInkWidths } from "@/draw/ink";
import type { FormattingState } from "@/draw/textRanges";
import {
  FontFamily,
  CanvasElement,
  StrokeStyle,
  Roundness,
  Theme,
  ElementStyleProps,
  ArrowRouting,
  ArrowHead,
  BulletVariant,
  InkStyle,
  PencilElement,
  Tool,
} from "@/draw/types";
import {
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  X,
  Palette,
  Minus,
  CornerDownRight,
  Spline,
  Zap,
  Repeat,
  ArrowLeftRight,
  FileText, Bold, Italic, Underline, Strikethrough,
} from "lucide-react";

interface PropertiesPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedElement: CanvasElement | null;
  background?: BackgroundSettings;
  onBackgroundChange?: (background: BackgroundSettings) => void;
  selectedTool?: Tool;
  topOffset?: number;
  canvasSize?: {width:number;height:number};
  isTextEditing?: boolean;
  preserveTextFocus?: boolean;
  selectionCount: number;
  formattingState?: FormattingState;
  onSwapArrow: () => void;
  onChangeFontSize: (delta: number) => void;
  currentStyle: ElementStyleProps;
  onUpdateStyle: (style: Partial<ElementStyleProps>) => void;
  onUpdateElement: (props: Partial<CanvasElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  theme: Theme;
}

/** A live, variable-width stroke preview rendered from the same ink math as the canvas. */
function InkPreview({ style, width }: { style: InkStyle; width: number }) {
  const points = Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    return {
      x: 3 + t * 42,
      y: 12 + Math.sin(t * Math.PI * 2.1) * 5.2,
      pressure: 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * t), 0.7),
    };
  });
  const widths = smoothInkWidths(inkWidths(points, width, style));
  return (
    <svg viewBox="0 0 48 24" className="h-6 w-12" aria-hidden="true">
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        return (
          <line
            key={index}
            x1={previous.x}
            y1={previous.y}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            strokeWidth={Math.max(widths[index], widths[index + 1])}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

const STROKE_COLORS = [
  "#FFFFFF",
  "#94A3B8",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#06B6D4",
  "#18181B",
];

export function PropertiesPanel({
  isOpen = false,
  onOpenChange,
  selectedElement,
  background = DEFAULT_BACKGROUND,
  onBackgroundChange,
  selectedTool = "select",
  topOffset = 56,
  canvasSize = {width:0,height:0},
  isTextEditing = false,
  preserveTextFocus = false,
  selectionCount,
  formattingState,
  onSwapArrow,
  onChangeFontSize,
  currentStyle,
  onUpdateStyle,
  onUpdateElement,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: PropertiesPanelProps) {
  const floating = useAppearancePosition(canvasSize, topOffset, preserveTextFocus);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (isOpen && !preserveTextFocus) closeButton.current?.focus({ preventScroll: true }); }, [isOpen, preserveTextFocus]);
  const close = () => { onOpenChange(false); window.requestAnimationFrame(() => openButton.current?.focus({ preventScroll: true })); };
  const context = selectionCount > 1 ? `${selectionCount} elements selected` : selectedElement ? `${selectedElement.type === "text" && selectedElement.attachment ? "Attachment" : selectedElement.type === "text" && selectedElement.isCodeCard ? "Code card" : selectedElement.type === "text" && selectedElement.isDocCard ? "Document card" : selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} selected` : isTextEditing ? "Text formatting" : "Style for new elements";

  const isArrow = selectedElement?.type === "arrow" || (!selectedElement && selectedTool === "arrow");
  const isLine = selectedElement?.type === "line" || (!selectedElement && selectedTool === "line");
  const isCode = selectedElement?.type === "text" && selectedElement.isCodeCard;
  const isIcon = selectedElement?.type === "icon";
  const isAttachment = selectedElement?.type === "text" && !!selectedElement.attachment;
  const isImage = selectedElement?.type === "image" || isAttachment;
  const pencil = selectedElement?.type === "pencil" ? selectedElement as PencilElement : null;
  const isPencil = selectedElement ? !!pencil : selectedTool === "pencil";
  const activeInkStyle: InkStyle = pencil ? pencil.inkStyle ?? "marker" : currentStyle.inkStyle ?? "fountain";
  const arrowEl = selectedElement?.type === "arrow" ? selectedElement : null;
  const lineEl = selectedElement?.type === "line" ? selectedElement : null;

  const activeStroke = selectedElement?.type === "icon" ? selectedElement.iconColor || "#E2E8F0" : selectedElement ? selectedElement.stroke : currentStyle.stroke;
  const activeFill = selectedElement?.type === "text" ? cardBackground(selectedElement).fill : selectedElement?.fill ?? currentStyle.fill;
  const activeFillStyle = selectedElement?.fillStyle ?? currentStyle.fillStyle;
  const changeBackground = (fill: string, pattern?: BackgroundPattern) => {
    const next = { fill, fillStyle: fill === "transparent" ? "none" as const : pattern ?? (activeFillStyle === "none" || activeFillStyle === "semi" ? "solid" : activeFillStyle), fillOpacity: 1 };
    if (selectedElement) onUpdateElement(selectedElement.type === "sticky" ? { ...next, color: fill } : selectedElement.type === "text" ? {...next,cardFillCustom:true} : next);
    onUpdateStyle(next);
  };
  const activeStrokeWidth = selectedElement ? selectedElement.strokeWidth : currentStyle.strokeWidth;
  const activeStrokeStyle = selectedElement ? selectedElement.strokeStyle : currentStyle.strokeStyle;
  const activeRoundness = selectedElement ? selectedElement.roundness : currentStyle.roundness;
  const activeOpacity = selectedElement ? selectedElement.opacity : currentStyle.opacity;

  const activeRouting: ArrowRouting =
    arrowEl ? arrowEl.routing || arrowEl.elbow || "straight" : currentStyle.arrowRouting || "straight";
  const activeLineRouting: ArrowRouting =
    lineEl
      ? (lineEl.bendOffset === 0 ? "straight" : (lineEl.routing || (lineEl.bendOffset ? "curved" : "straight")))
      : (currentStyle.lineRouting || "straight");
  const activeHeadStart: ArrowHead =
    (arrowEl?.arrowHeadStart as ArrowHead) || currentStyle.arrowHeadStart || "none";
  const activeHeadEnd: ArrowHead =
    (arrowEl?.arrowHeadEnd as ArrowHead) || currentStyle.arrowHeadEnd || "arrow";
  const isAnimated = arrowEl?.animated ?? currentStyle.arrowAnimated ?? false;

  const handleStrokeColor = (c: string) => {
    if (selectedElement) {
      onUpdateElement(isIcon ? { iconColor: c } : { stroke: c });
    }
    onUpdateStyle({ stroke: c });
  };

  const handleStrokeWidth = (w: number) => {
    if (selectedElement) {
      onUpdateElement({ strokeWidth: w });
    }
    onUpdateStyle({ strokeWidth: w });
  };

  const handleStrokeStyle = (s: StrokeStyle) => {
    if (selectedElement) {
      onUpdateElement({ strokeStyle: s });
    }
    onUpdateStyle({ strokeStyle: s });
  };

  const handleInkStyle = (style: InkStyle) => {
    if (pencil) {
      onUpdateElement({ inkStyle: style });
    }
    onUpdateStyle({ inkStyle: style });
  };

  const handleRoundness = (r: Roundness) => {
    if (selectedElement) {
      onUpdateElement({ roundness: r });
    }
    onUpdateStyle({ roundness: r });
  };

  const handleOpacity = (o: number) => {
    if (selectedElement) {
      onUpdateElement({ opacity: o });
    }
    onUpdateStyle({ opacity: o });
  };

  const handleRouting = (routing: ArrowRouting) => {
    if (selectedElement && isArrow) {
      onUpdateElement({ routing, elbow: routing, bendOffset: undefined });
    }
    onUpdateStyle({ arrowRouting: routing });
  };

  const handleLineRouting = (routing: ArrowRouting) => {
    if (selectedElement && isLine) {
      if (routing === "straight") {
        onUpdateElement({ routing: "straight", bendOffset: 0 });
      } else {
        const defaultBend = lineEl && lineEl.bendOffset
          ? lineEl.bendOffset
          : Math.round(Math.max(22, Math.min(65, lineEl ? Math.hypot(lineEl.endX - lineEl.startX, lineEl.endY - lineEl.startY) * 0.22 : 40)));
        onUpdateElement({ routing: "curved", bendOffset: defaultBend });
      }
    }
    onUpdateStyle({ lineRouting: routing });
  };

  const handleHeadStart = (cap: ArrowHead) => {
    if (selectedElement && isArrow) {
      onUpdateElement({ arrowHeadStart: cap });
    }
    onUpdateStyle({ arrowHeadStart: cap });
  };

  const handleHeadEnd = (cap: ArrowHead) => {
    if (selectedElement && isArrow) {
      onUpdateElement({ arrowHeadEnd: cap });
    }
    onUpdateStyle({ arrowHeadEnd: cap });
  };

  const handleToggleAnimated = () => {
    const next = !isAnimated;
    if (selectedElement && isArrow) {
      onUpdateElement({ animated: next });
    }
    onUpdateStyle({ arrowAnimated: next });
  };

  const handleSwapArrowDirection = () => {
    if (arrowEl) onSwapArrow();
  };

  const isTextual = !isAttachment && (isTextEditing || selectedElement?.type === "text" || selectedElement?.type === "sticky" || (!selectedElement && ["text", "doc", "sticky"].includes(selectedTool)));
  const hasBackground = !isImage && !isIcon && !isArrow && !isLine && selectedTool !== "pencil" && (!isTextual || selectedElement?.type === "sticky" || selectedElement?.type === "text" && (selectedElement.isDocCard || selectedElement.isCodeCard) || selectedTool === "doc" || selectedTool === "sticky");
  const textEl = selectedElement && (selectedElement.type === "text" || selectedElement.type === "sticky") ? selectedElement : null;
  const activeFontSize = textEl ? textEl.fontSize : currentStyle.fontSize;
  const activeFamily = textEl ? textEl.fontFamily || "sans" : currentStyle.fontFamily;
  const activeAlign = textEl ? textEl.textAlign || "left" : currentStyle.textAlign;

  const handleToggleBidirectional = () => {
    if (arrowEl) {
      const isCurrentlyBidi =
        arrowEl.arrowHeadStart === "arrow" &&
        (arrowEl.arrowHeadEnd === "arrow" || arrowEl.arrowHeadEnd === undefined);
      if (isCurrentlyBidi) {
        onUpdateElement({ arrowHeadStart: "none", arrowHeadEnd: "arrow" });
      } else {
        onUpdateElement({ arrowHeadStart: "arrow", arrowHeadEnd: "arrow" });
      }
    }
  };

  const handleArrowLabel = (text: string) => {
    if (arrowEl) {
      onUpdateElement({ label: text });
    }
  };

  const handleApplyBulletVariant = (variant: BulletVariant | "clear") => {
    if (!textEl || textEl.type !== "text") return;
    const lines = textEl.text.split("\n");
    const updated = lines.map((line, idx) => {
      const stripped = line.replace(
        /^(\s*)(#+\s+|>\s*|(\-\s*|\*\s*)?\[[ xX]\]\s+|(\u2022|\u25CB|\u25AA|\u25A0|\u25C6|\u25C7|\u2013|\u2192|\->|\u25B8|\-|\*|o|\(\))\s+|\d+\.\s+)/,
        "$1"
      );
      if (variant === "clear") return stripped;
      const leadingSpaces = line.match(/^\s*/)?.[0] || "";
      const content = stripped.slice(leadingSpaces.length);
      switch (variant) {
        case "disc":
          return `${leadingSpaces}• ${content}`;
        case "circle":
          return `${leadingSpaces}○ ${content}`;
        case "square":
          return `${leadingSpaces}▪ ${content}`;
        case "diamond":
          return `${leadingSpaces}◆ ${content}`;
        case "dash":
          return `${leadingSpaces}– ${content}`;
        case "arrow":
          return `${leadingSpaces}→ ${content}`;
        case "number":
          return `${leadingSpaces}${idx + 1}. ${content}`;
        case "todo":
          return `${leadingSpaces}[ ] ${content}`;
      }
    });
    onUpdateElement({ text: updated.join("\n") });
  };

  if (!isOpen) {
    return (
      <button ref={openButton} type="button" onMouseDown={event => { if (preserveTextFocus) event.preventDefault(); }} onPointerDown={floating.onPointerDown} onKeyDown={floating.onKeyDown} onClick={event => floating.onClick(event, () => onOpenChange(true))}
        style={{ top: floating.point.y, left: floating.point.x, width:132, touchAction:"none", cursor:floating.dragging ? "grabbing" : "grab" }} aria-expanded={false}
        title="Appearance · click to open, drag to move · Alt+Arrow keys to move, Alt+Home to reset" aria-describedby="appearance-move-hint" aria-label="Open appearance settings" aria-controls="appearance-settings"
        className="appearance-trigger absolute left-2 z-40 flex h-9 items-center justify-center gap-2 rounded-lg border drawing-panel px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 shadow-sm transition-colors hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white"
      ><Palette aria-hidden="true" strokeWidth={1.75} className="h-[18px] w-[18px] shrink-0" /><span>Appearance</span><span id="appearance-move-hint" className="sr-only">Drag to move. Use Alt and arrow keys to move with the keyboard; Alt and Home resets the position.</span></button>
    );
  }

  return (
    <div style={{ top: floating.panel.y, left: floating.panel.x, maxHeight: `calc(100% - ${floating.panel.y + 64}px)` }}
      id="appearance-settings" role="region" aria-label="Appearance settings"
      onKeyDown={event => {
        const sizeDelta = textSizeShortcut(event.nativeEvent);
        if (sizeDelta && isTextual) {
          event.preventDefault(); event.stopPropagation(); onChangeFontSize(sizeDelta); return;
        }
        if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); close(); } }}
      onMouseDown={event => { if (preserveTextFocus && event.target instanceof window.Element && event.target.closest("button, summary")) event.preventDefault(); }}
      className="appearance-panel absolute left-2 z-40 flex w-72 max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-md border drawing-panel text-neutral-800 dark:text-neutral-200 shadow-sm select-none"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <span className="appearance-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Palette className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Appearance</h2><p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{context}</p></div>
        <button ref={closeButton} type="button" onClick={close} title="Hide appearance settings · Escape" aria-label="Collapse appearance settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
      {selectedTool === "highlighter" ? <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">The red highlighter fades after 0.2 seconds. It is visible to collaborators and is never saved or exported.</p> : <>
      {isCode && selectedElement?.type === "text" && <section aria-label="Code card size" className="space-y-2">
        <h3 className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Card size</h3>
        <div className="grid grid-cols-2 gap-2">
          {([['width','Width',MIN_CODE_WIDTH],['height','Height',MIN_CODE_HEIGHT]] as const).map(([key,label,min])=><label key={key} className="space-y-1 text-[11px] text-neutral-600 dark:text-neutral-400">{label} (px)<input aria-label={`Code card ${key}`} type="number" min={min+32} max={10000} step="8" value={Math.round(selectedElement[key]+32)} onChange={event=>{const value=event.currentTarget.valueAsNumber;if(Number.isFinite(value))onUpdateElement({[key]:Math.max(min,Math.min(9968,value-32)),codeAutoSize:false});}} className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-xs text-neutral-800 dark:text-neutral-200" /></label>)}
        </div>
        <button type="button" onClick={()=>onUpdateElement({codeAutoSize:true})} className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">Fit to code</button>
        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Drag any side or corner to resize freely without changing text size. Smaller cards scroll while editing.</p>
      </section>}
      {/* Text: size, family, alignment. Shortcuts: Ctrl+Shift+> / < */}
      {isTextual && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide block mb-1">Text</label>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Text formatting">
            {([ ["bold", Bold, "Bold", "B"], ["italic", Italic, "Italic", "I"], ["underline", Underline, "Underline", "U"], ["strikethrough", Strikethrough, "Strikethrough", "Shift+X"] ] as const).map(([key, Icon, name, shortcut]) => {
              const active = formattingState?.[key] ?? !!(textEl || currentStyle)[key];
              return <button type="button" key={key} aria-label={name} aria-pressed={active} title={`${name} (Ctrl/Cmd+${shortcut})${active === "mixed" ? " · Mixed selection" : ""}`}
                className="appearance-format flex h-11 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium transition"
                onClick={() => { const enabled = active !== true; onUpdateElement({ [key]: enabled }); onUpdateStyle({ [key]: enabled }); }}><Icon aria-hidden="true" className="h-4 w-4" /><span>{key === "strikethrough" ? "Strike" : name}</span></button>;
            })}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onChangeFontSize(-2)} title="Smaller (Cmd/Ctrl+Shift+Comma)" aria-label="Decrease font size" aria-keyshortcuts="Meta+Shift+Comma Control+Shift+Comma" className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold">−</button>
            <span className="flex-1 text-center text-xs font-mono tabular-nums text-neutral-800 dark:text-neutral-200">{Math.round(activeFontSize)}px</span>
            <button onClick={() => onChangeFontSize(2)} title="Larger (Cmd/Ctrl+Shift+Period)" aria-label="Increase font size" aria-keyshortcuts="Meta+Shift+Period Control+Shift+Period" className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold">+</button>
          </div>
          <label className="block text-[11px] text-neutral-500">Font library
            <FontSelect aria-label="Canvas font library" value={activeFamily} onChange={event=>{const fontFamily=event.target.value as FontFamily;onUpdateElement({fontFamily});onUpdateStyle({fontFamily});}} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
          </label>
          {isTextual && (
            <div className="grid grid-cols-3 gap-1 p-0.5 mt-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px]">
              {(["left", "center", "right"] as const).map((al) => (
                <button
                  key={al}
                  onClick={() => {
                    onUpdateElement({ textAlign: al });
                    onUpdateStyle({ textAlign: al });
                  }}
                  className={`py-0.5 rounded font-medium capitalize transition ${activeAlign === al ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs" : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"}`}
                >
                  {al}
                </button>
              ))}
            </div>
          )}

          {/* Doc Card Mode Toggle */}
          {textEl && textEl.type === "text" && (
            <details className="border-t border-neutral-200 dark:border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-500 dark:text-neutral-400">Document card</summary><div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                  Doc Container
                </label>
                <button
                  onClick={() =>
                    onUpdateElement({
                      isDocCard: !textEl.isDocCard,
                      cardFillCustom: false,
                      fill: !textEl.isDocCard ? "#18181B" : "transparent",
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                    textEl.isDocCard
                      ? "ui-primary text-white font-semibold shadow-xs"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {textEl.isDocCard ? "Card Active" : "Plain Text"}
                </button>
              </div>
              {textEl.isDocCard && (
                <input
                  type="text"
                  aria-label="Document card title"
                  placeholder="Card Title (e.g. Spec, Notes)..."
                  value={textEl.title || ""}
                  onChange={(e) => onUpdateElement({ title: e.target.value })}
                  className="w-full text-[11px] py-1 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-neutral-500 transition"
                />
              )}
            </div></details>
          )}

          {/* Bullets & Lists Variant Selector */}
          {textEl && textEl.type === "text" && (
            <details className="border-t border-neutral-200 dark:border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-500 dark:text-neutral-400">Lists</summary><div className="mt-2 space-y-2">
              <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                Bullets & Lists
              </label>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <button
                  onClick={() => handleApplyBulletVariant("disc")}
                  title="Disc Bullet (• item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  • Disc
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("circle")}
                  title="Circle Bullet (○ item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ○ Circ
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("square")}
                  title="Square Bullet (▪ item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ▪ Sq
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("diamond")}
                  title="Diamond Bullet (◆ item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ◆ Diam
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("dash")}
                  title="Dash Bullet (– item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  – Dash
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("arrow")}
                  title="Arrow Bullet (→ item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  → Arrow
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("number")}
                  title="Numbered List (1. 2. 3.)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  1. Num
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("todo")}
                  title="Task / Checklist ([ ] item)"
                  className="py-1 px-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ☑ Task
                </button>
              </div>
              <button
                onClick={() => handleApplyBulletVariant("clear")}
                title="Clear Bullets / Numbering"
                className="w-full py-0.5 rounded text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-center cursor-pointer"
              >
                Clear List Bullets
              </button>
            </div></details>
          )}
        </div>
      )}

      {isLine && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
              Line Routing
            </label>
            <div role="group" aria-label="Line routing" className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[10px] text-center">
              <button
                type="button"
                aria-pressed={activeLineRouting === "straight"}
                onClick={() => handleLineRouting("straight")}
                className={`py-1 rounded font-medium flex items-center justify-center gap-1 transition ${
                  activeLineRouting === "straight"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                <Minus className="w-3 h-3" />
                Straight
              </button>
              <button
                type="button"
                aria-pressed={activeLineRouting === "curved"}
                onClick={() => handleLineRouting("curved")}
                className={`py-1 rounded font-medium flex items-center justify-center gap-1 transition ${
                  activeLineRouting === "curved"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                <Spline className="w-3 h-3 text-neutral-500" />
                Curved
              </button>
            </div>
            {lineEl && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Drag the center diamond to bend the line.</p>
                <label className="flex items-center justify-between gap-2 text-[10px] text-neutral-600 dark:text-neutral-400">
                  Bend (px)
                  <input
                    type="number"
                    aria-label="Line bend in pixels"
                    step="1"
                    value={activeLineRouting === "curved" ? Math.round((lineEl.bendOffset ?? Math.max(22, Math.min(65, Math.hypot(lineEl.endX - lineEl.startX, lineEl.endY - lineEl.startY) * 0.22))) / 2) : 0}
                    onChange={event => {
                      const bend = event.currentTarget.valueAsNumber;
                      if (!Number.isFinite(bend)) return;
                      const routing = bend === 0 ? "straight" : "curved";
                      onUpdateElement({ routing, bendOffset: bend * 2 });
                    }}
                    className="w-20 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 py-1 text-neutral-800 dark:text-neutral-200 focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white"
                  />
                </label>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Use positive or negative values to bend either way. Set 0 for a straight line.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTool === "eyedropper" && <p className="text-xs text-neutral-500 dark:text-neutral-400">Click an object to use its color for drawing.</p>}
      {!isImage && <section aria-label="Color moods" className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">Color mood</label>
          <span className="text-[9px] uppercase tracking-[0.1em] text-neutral-400">Paired stroke + fill</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_MOODS.map(mood => {
            const active = activeStroke.toLowerCase() === mood.stroke.toLowerCase() && (!hasBackground || activeFill.toLowerCase() === mood.fill.toLowerCase());
            return <button
              key={mood.id}
              type="button"
              aria-label={`Color mood: ${mood.name}`}
              aria-pressed={active}
              title={`${mood.name} · ${mood.description}`}
              onClick={() => {
                const style = { stroke: mood.stroke, ...(hasBackground ? { fill: mood.fill, fillStyle: activeFillStyle === "none" || activeFillStyle === "semi" ? "solid" as const : activeFillStyle, fillOpacity: 1 } : {}) };
                if (selectedElement) onUpdateElement({ ...style, ...(isIcon ? { iconColor: mood.stroke } : {}), ...(hasBackground && selectedElement.type === "sticky" ? { color: mood.fill } : {}), ...(hasBackground && selectedElement.type === "text" ? { cardFillCustom: true } : {}) });
                onUpdateStyle(style);
              }}
              className={`color-mood group flex h-9 items-center justify-center rounded-lg border transition ${active ? "is-active" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"}`}
              style={{ background: `linear-gradient(135deg, ${mood.stroke}30 0 52%, ${mood.fill}aa 52% 100%)` }}
            >
              <span className="h-2.5 w-2.5 rounded-full shadow-sm transition group-hover:scale-125" style={{ backgroundColor: mood.stroke }} />
            </button>;
          })}
        </div>
      </section>}
      {!isImage && <ColorControl label="Custom stroke color" value={activeStroke} onChange={handleStrokeColor} />}
      {isImage && <p className="text-xs text-neutral-500 dark:text-neutral-400">{isAttachment ? "File attachment. Select its Download button to save the original file." : "Drag to move this image. Use the selection handles to resize it."}</p>}
      {/* Stroke Color */}
      {!isImage && <div>
        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide block mb-1">
          {isIcon ? "Icon color" : isTextual ? "Text color" : "Stroke color"}
        </label>
        <ColorPalette kind="stroke" presets={STROKE_COLORS} value={activeStroke} onChange={handleStrokeColor} />
      </div>}

      {isPencil && <section aria-label="Ink styles" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">Ink style</label>
          <span className="ink-studio-badge">Pressure aware</span>
        </div>
        <div role="group" aria-label="Ink styles" className="grid grid-cols-2 gap-1.5">
          {INK_STYLES.map((style) => {
            const active = activeInkStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                aria-label={style.name}
                aria-pressed={active}
                title={style.description}
                onClick={() => handleInkStyle(style.id)}
                className={`ink-card group ${active ? "is-active" : ""}`}
              >
                <InkPreview style={style.id} width={style.previewWidth} />
                <span className="ink-card-label">{style.name}</span>
                <span className="ink-card-check" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <p className="ink-studio-hint">
          {INK_STYLES.find((style) => style.id === activeInkStyle)?.description}
        </p>
        <div>
          <label className="mb-1 block text-[11px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">Stroke weight</label>
          <div className="flex rounded-lg bg-neutral-100 p-0.5 text-[11px] dark:bg-neutral-800">
            {[1, 2, 4].map((weight) => (
              <button
                key={weight}
                type="button"
                aria-label={`Ink weight ${weight}`}
                aria-pressed={activeStrokeWidth === weight}
                onClick={() => handleStrokeWidth(weight)}
                className={`flex-1 rounded-md py-1 transition ${
                  activeStrokeWidth === weight
                    ? "bg-white font-semibold text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                {weight === 1 ? "Fine" : weight === 2 ? "Balanced" : "Bold"}
              </button>
            ))}
          </div>
        </div>
      </section>}

      {hasBackground && <div className="space-y-2">
        <ColorControl label="Background color" value={activeFill === "transparent" ? "transparent" : parseFillColor(activeFill).color} onChange={fill => changeBackground(fill)} />
        <ColorPalette kind="background" presets={isCode ? ["#000000", "#09090b", "#121212", "#18181b", "#242428", "#111d2d", "#ffffff"] : ["#303236", "#454b53", "#48596b", "#4a5b4c", "#6a6048", "#674c4b", "#5c5268", "#c7ba91"]} value={activeFill} onChange={fill => changeBackground(fill)} />
        <BackgroundStylePicker value={activeFillStyle} onChange={pattern => changeBackground(activeFill === "transparent" ? "#48596b" : parseFillColor(activeFill).color, pattern)} />
        <button type="button" aria-pressed={activeFill === "transparent"} onClick={() => changeBackground("transparent")} className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white">No background</button>
      </div>}

      {!isIcon && !isImage && !isTextual && !isPencil && <details className="border-t border-neutral-200 dark:border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-500 dark:text-neutral-400">Line & corners</summary><div className="mt-3 space-y-3">
      {/* Stroke Style: Clean (Eraser) vs Sketchy (Excalidraw) vs Dashed */}
      <div>
        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide block mb-1">
          Stroke Style
        </label>
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] text-center">
          <button
            onClick={() => handleStrokeStyle("solid")}
            title="Clean lines"
            className={`py-0.5 rounded font-medium transition ${
              activeStrokeStyle === "solid"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            Clean
          </button>
          <button
            onClick={() => handleStrokeStyle("rough")}
            title="Hand-drawn sketch"
            className={`py-0.5 rounded font-medium transition ${
              activeStrokeStyle === "rough"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            Rough
          </button>
          <button
            onClick={() => handleStrokeStyle("dashed")}
            title="Dashed"
            className={`py-0.5 rounded font-medium transition ${
              activeStrokeStyle === "dashed"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            Dash
          </button>
          <button
            onClick={() => handleStrokeStyle("dotted")}
            title="Dotted"
            className={`py-0.5 rounded font-medium transition ${
              activeStrokeStyle === "dotted"
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            }`}
          >
            Dot
          </button>
        </div>
      </div>

      {/* Width & Corners */}
      <div className={`grid ${isArrow ? "grid-cols-1" : "grid-cols-2"} gap-1.5`}>
        <div>
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide block mb-1">
            Width
          </label>
          <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-[10px]">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                onClick={() => handleStrokeWidth(w)}
                className={`flex-1 py-0.5 rounded transition ${
                  activeStrokeWidth === w
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                {w}px
              </button>
            ))}
          </div>
        </div>

        {!isArrow && (
          <div>
            <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide block mb-1">
              Corners
            </label>
            <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-[10px]">
              {(["sharp", "rounded"] as Roundness[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoundness(r)}
                  className={`flex-1 py-0.5 capitalize rounded transition ${
                    activeRoundness === r
                      ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white font-semibold shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      </div></details>}

      {/* Arrow Specific Styling (Eraser.io Pro Features) */}
      {isArrow && (
        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
              Arrow Routing
            </label>
            <div role="group" aria-label="Arrow routing" className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[10px] text-center">
              <button
                aria-pressed={activeRouting === "straight"}
                onClick={() => handleRouting("straight")}
                className={`py-1 rounded font-medium flex items-center justify-center gap-1 transition ${
                  activeRouting === "straight"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                <Minus className="w-3 h-3" />
                Straight
              </button>
              <button
                aria-pressed={activeRouting === "elbow"}
                onClick={() => handleRouting("elbow")}
                className={`py-1 rounded font-medium flex items-center justify-center gap-1 transition ${
                  activeRouting === "elbow"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                <CornerDownRight className="w-3 h-3 text-neutral-500" />
                Elbow
              </button>
              <button
                aria-pressed={activeRouting === "curved"}
                onClick={() => handleRouting("curved")}
                className={`py-1 rounded font-medium flex items-center justify-center gap-1 transition ${
                  activeRouting === "curved"
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                }`}
              >
                <Spline className="w-3 h-3 text-neutral-500" />
                Curved
              </button>
            </div>
            {arrowEl && activeRouting !== "elbow" && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Drag the center diamond to bend the arrow.</p>
                <label className="flex items-center justify-between gap-2 text-[10px] text-neutral-600 dark:text-neutral-400">
                  Bend (px)
                  <input
                    type="number"
                    aria-label="Arrow bend in pixels"
                    step="1"
                    value={activeRouting === "curved" ? Math.round((arrowEl.bendOffset ?? Math.max(22, Math.min(65, Math.hypot(arrowEl.endX - arrowEl.startX, arrowEl.endY - arrowEl.startY) * 0.22))) / 2) : 0}
                    onChange={event => {
                      const bend = event.currentTarget.valueAsNumber;
                      if (!Number.isFinite(bend)) return;
                      const routing = bend === 0 ? "straight" : "curved";
                      onUpdateElement({ routing, elbow: routing, bendOffset: bend * 2 });
                    }}
                    className="w-20 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2 py-1 text-neutral-800 dark:text-neutral-200 focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white"
                  />
                </label>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Use positive or negative values to bend either way. Choose Straight to reset.</p>
              </div>
            )}
          </div>

          {/* Start and End Head Caps */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-0.5">
                Start Cap
              </label>
              <select
                aria-label="Arrow start cap"
                value={activeHeadStart}
                onChange={(e) => handleHeadStart(e.target.value as ArrowHead)}
                className="w-full text-[11px] py-1 px-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:border-neutral-500"
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="dot">Dot</option>
                <option value="diamond">Diamond</option>
                <option value="bar">Bar</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block mb-0.5">
                End Cap
              </label>
              <select
                aria-label="Arrow end cap"
                value={activeHeadEnd}
                onChange={(e) => handleHeadEnd(e.target.value as ArrowHead)}
                className="w-full text-[11px] py-1 px-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:border-neutral-500"
              >
                <option value="arrow">Arrow</option>
                <option value="none">None</option>
                <option value="dot">Dot</option>
                <option value="diamond">Diamond</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          </div>

          {/* Quick Arrow Tools */}
          <div className="flex gap-1 pt-0.5">
            <button
              onClick={handleSwapArrowDirection}
              title="Swap Arrow Direction"
              className="flex-1 py-1 px-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[10px] font-medium flex items-center justify-center gap-1 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
            >
              <Repeat className="w-2.5 h-2.5" />
              Swap
            </button>
            <button
              onClick={handleToggleBidirectional}
              title="Toggle Bidirectional Arrow"
              className="flex-1 py-1 px-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[10px] font-medium flex items-center justify-center gap-1 text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              2-Way
            </button>
            <button
              onClick={handleToggleAnimated}
              title="Toggle Live Animated Flow (Marching dots/dashes)"
              className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                isAnimated
                  ? "bg-neutral-500/20 text-neutral-500 border border-neutral-500/30 font-semibold"
                  : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <Zap className="w-2.5 h-2.5" />
              Flow
            </button>
          </div>

          {/* Arrow Label Input */}
          <div>
            <label htmlFor="arrow-label" className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
              Arrow label
            </label>
            <textarea
              id="arrow-label"
              rows={2}
              aria-label="Arrow label"
              value={arrowEl?.label || ""}
              onChange={(e) => handleArrowLabel(e.target.value)}
              placeholder="e.g. HTTP, Events…"
              className="resize-none w-full text-xs leading-5 py-2 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-neutral-500 transition"
            />
          </div>
        </div>
      )}

      {/* Opacity */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">
          <span className="uppercase tracking-wider">Opacity</span>
          <span>{Math.round((activeOpacity ?? 1) * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          aria-label="Opacity"
          value={activeOpacity ?? 1}
          onChange={(e) => handleOpacity(parseFloat(e.target.value))}
          className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
        />
      </div>

      </>}
      {onBackgroundChange && <details className="border-t border-neutral-200 dark:border-neutral-800 pt-2"><summary className="cursor-pointer py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition">Canvas background</summary><div className="mt-2 space-y-2"><div role="group" aria-label="Canvas background presets" className="grid grid-cols-8 gap-1">{PREMIUM_BACKGROUND_MOODS.map(choice => <button key={choice.value} type="button" aria-label={`Canvas background ${choice.name}`} title={choice.name} onClick={() => onBackgroundChange({ ...background, fill: choice.value, fillOpacity: 1 })} className={`h-6 w-full rounded-md border transition hover:scale-105 ${background.fill.toLowerCase() === choice.value.toLowerCase() ? "border-neutral-900 ring-2 ring-neutral-900/30 dark:border-white dark:ring-white/30" : "border-neutral-300 dark:border-neutral-600"}`} style={{ backgroundColor: choice.value }} />)}</div><ColorControl label="Canvas background color" value={background.fill} onChange={fill => onBackgroundChange({ ...background, fill, fillOpacity: 1 })} /><BackgroundStylePicker label="Canvas background style" value={background.fillStyle} onChange={fillStyle => onBackgroundChange({ ...background, fillStyle, fillOpacity: 1 })} /></div></details>}
      </div>
      {selectionCount > 0 && <footer aria-label="Selection actions" className="grid shrink-0 grid-cols-2 gap-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-900/80 p-3 text-xs">
        <button onClick={onDuplicate} aria-label="Duplicate selection" title="Duplicate (Ctrl/Cmd+D)" className="flex h-8 items-center justify-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white transition cursor-pointer"><Copy className="h-3.5 w-3.5" />Duplicate</button>
        <button onClick={onDelete} aria-label="Delete selection" title="Delete (Del)" className="flex h-8 items-center justify-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-500/50 hover:bg-neutral-50 dark:hover:bg-neutral-500/10 focus-visible:outline-2 focus-visible:outline-neutral-500 transition cursor-pointer"><Trash2 className="h-3.5 w-3.5" />Delete</button>
        <button onClick={onBringToFront} className="flex h-8 items-center justify-center gap-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white transition cursor-pointer"><BringToFront className="h-3.5 w-3.5" />Bring to front</button>
        <button onClick={onSendToBack} className="flex h-8 items-center justify-center gap-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white transition cursor-pointer"><SendToBack className="h-3.5 w-3.5" />Send to back</button>
      </footer>}
    </div>
  );
}
