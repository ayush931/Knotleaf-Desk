"use client";

import React, { useLayoutEffect, useRef } from "react";
import { BackgroundStylePicker, type BackgroundPattern } from "./BackgroundStylePicker";
import { parseFillColor } from "@/lib/fillColor";
import { DEFAULT_BACKGROUND } from "@/lib/background.mjs";
import type { BackgroundSettings } from "@/draw/types";
import { ColorControl } from "./ColorControl";
import { FONT_OPTIONS, fontCssStack } from "@/draw/fonts";
import {
  CanvasElement,
  StrokeStyle,
  Roundness,
  Theme,
  ElementStyleProps,
  ArrowRouting,
  ArrowHead,
  BulletVariant,
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
  FileText,
} from "lucide-react";

interface PropertiesPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedElement: CanvasElement | null;
  background?: BackgroundSettings;
  onBackgroundChange?: (background: BackgroundSettings) => void;
  selectedTool?: Tool;
  topOffset?: number;
  isTextEditing?: boolean;
  preserveTextFocus?: boolean;
  selectionCount: number;
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

const STROKE_COLORS = [
  "#dedbd4",
  "#92989e",
  "#8299b5",
  "#829c88",
  "#b5a078",
  "#b4837e",
  "#9a8ca8",
  "#b38e9c",
  "#7f9fa1",
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
  isTextEditing = false,
  preserveTextFocus = false,
  selectionCount,
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
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { if (isOpen && !preserveTextFocus) closeButton.current?.focus({ preventScroll: true }); }, [isOpen, preserveTextFocus]);
  const close = () => { onOpenChange(false); window.requestAnimationFrame(() => openButton.current?.focus({ preventScroll: true })); };
  const context = selectionCount > 1 ? `${selectionCount} elements selected` : selectedElement ? `${selectedElement.type === "text" && selectedElement.isCodeCard ? "Code card" : selectedElement.type === "text" && selectedElement.isDocCard ? "Document card" : selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)} selected` : isTextEditing ? "Text formatting" : "Style for new elements";

  const isArrow = selectedElement?.type === "arrow" || (!selectedElement && selectedTool === "arrow");
  const isIcon = selectedElement?.type === "icon";
  const isImage = selectedElement?.type === "image";
  const arrowEl = selectedElement?.type === "arrow" ? selectedElement : null;

  const activeStroke = selectedElement?.type === "icon" ? selectedElement.iconColor || "#E2E8F0" : selectedElement ? selectedElement.stroke : currentStyle.stroke;
  const activeFill = selectedElement?.fill ?? currentStyle.fill;
  const activeFillStyle = selectedElement?.fillStyle ?? currentStyle.fillStyle;
  const changeBackground = (fill: string, pattern?: BackgroundPattern) => {
    const next = { fill, fillStyle: fill === "transparent" ? "none" as const : pattern ?? (activeFillStyle === "none" || activeFillStyle === "semi" ? "solid" : activeFillStyle), fillOpacity: 1 };
    if (selectedElement) onUpdateElement(selectedElement.type === "sticky" ? { ...next, color: fill } : next);
    onUpdateStyle(next);
  };
  const activeStrokeWidth = selectedElement ? selectedElement.strokeWidth : currentStyle.strokeWidth;
  const activeStrokeStyle = selectedElement ? selectedElement.strokeStyle : currentStyle.strokeStyle;
  const activeRoundness = selectedElement ? selectedElement.roundness : currentStyle.roundness;
  const activeOpacity = selectedElement ? selectedElement.opacity : currentStyle.opacity;

  const activeRouting: ArrowRouting =
    arrowEl ? arrowEl.routing || arrowEl.elbow || "straight" : currentStyle.arrowRouting || "elbow";
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

  const isTextual = isTextEditing || selectedElement?.type === "text" || selectedElement?.type === "sticky" || (!selectedElement && ["text", "doc", "sticky"].includes(selectedTool));
  const hasBackground = !isImage && !isIcon && !isArrow && selectedElement?.type !== "line" && selectedTool !== "line" && selectedTool !== "pencil" && (!isTextual || selectedElement?.type === "sticky" || selectedElement?.type === "text" && selectedElement.isDocCard || selectedTool === "doc" || selectedTool === "sticky");
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
      <button ref={openButton} type="button" onMouseDown={event => { if (preserveTextFocus) event.preventDefault(); }} onClick={() => onOpenChange(true)}
        style={{ top: topOffset }} aria-expanded={false}
        title="Style · stroke, background and text" aria-label="Open appearance settings" aria-controls="appearance-settings"
        className="absolute left-2 z-30 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-neutral-600 bg-[#202124] text-xs font-medium text-neutral-200 shadow-lg backdrop-blur-md transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      ><Palette aria-hidden="true" strokeWidth={1.75} className="h-[18px] w-[18px] shrink-0" /><span className="sr-only">Style</span></button>
    );
  }

  return (
    <div style={{ top: topOffset, maxHeight: `calc(100% - ${topOffset + 64}px)` }}
      id="appearance-settings" role="region" aria-label="Appearance settings"
      onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); close(); } }}
      onMouseDown={event => { if (preserveTextFocus && event.target instanceof HTMLElement && event.target.closest("button, summary")) event.preventDefault(); }}
      className="absolute left-2 z-30 flex w-72 max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#18181b]/95 text-neutral-200 shadow-xl backdrop-blur-xl select-none"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><Palette className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-neutral-100">Appearance</h2><p className="truncate text-[11px] text-neutral-400">{context}</p></div>
        <button ref={closeButton} type="button" onClick={close} title="Hide appearance settings · Escape" aria-label="Collapse appearance settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
      {/* Text: size, family, alignment. Shortcuts: Ctrl+Shift+> / < */}
      {isTextual && (
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-neutral-400 tracking-wide block mb-1">Text</label>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Text formatting">
            {([ ["bold", "B", "Bold", "B"], ["italic", "I", "Italic", "I"], ["underline", "U", "Underline", "U"], ["strikethrough", "S", "Strikethrough", "Shift+X"] ] as const).map(([key, label, name, shortcut]) => {
              const active = !!(textEl || currentStyle)[key];
              return <button key={key} aria-label={name} aria-pressed={active} title={`${name} (Ctrl/Cmd+${shortcut})`}
                className={`h-7 rounded-md text-xs ${active ? "bg-purple-600 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"} ${key === "bold" ? "font-bold" : key === "italic" ? "italic" : key === "underline" ? "underline" : "line-through"}`}
                onClick={() => { onUpdateElement({ [key]: !active }); onUpdateStyle({ [key]: !active }); }}>{label}</button>;
            })}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onChangeFontSize(-2)} title="Smaller (Ctrl+Shift+<)" aria-label="Decrease font size" className="w-7 h-7 rounded-md bg-neutral-800 hover:bg-neutral-700 text-sm">−</button>
            <span className="flex-1 text-center text-xs font-mono tabular-nums">{Math.round(activeFontSize)}px</span>
            <button onClick={() => onChangeFontSize(2)} title="Larger (Ctrl+Shift+>)" aria-label="Increase font size" className="w-7 h-7 rounded-md bg-neutral-800 hover:bg-neutral-700 text-sm">+</button>
          </div>
          <div role="group" aria-label="Font family" className="grid grid-cols-2 gap-1 p-0.5 mt-1.5 rounded-lg bg-neutral-800 text-[11px]">
            {FONT_OPTIONS.map(({ id: fam, label }) => (
              <button
                key={fam}
                aria-label={`Font: ${label}`}
                aria-pressed={activeFamily === fam}
                style={{ fontFamily: fontCssStack(fam) }}
                onClick={() => {
                  onUpdateElement({ fontFamily: fam });
                  onUpdateStyle({ fontFamily: fam });
                }}
                className={`min-h-7 px-1 py-1 rounded font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 active:bg-neutral-600 ${activeFamily === fam ? "bg-neutral-700 text-white shadow-xs" : "text-neutral-400 hover:bg-neutral-700/60 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {isTextual && (
            <div className="grid grid-cols-3 gap-1 p-0.5 mt-1 rounded-lg bg-neutral-800 text-[11px]">
              {(["left", "center", "right"] as const).map((al) => (
                <button
                  key={al}
                  onClick={() => {
                    onUpdateElement({ textAlign: al });
                    onUpdateStyle({ textAlign: al });
                  }}
                  className={`py-0.5 rounded font-medium capitalize transition ${activeAlign === al ? "bg-neutral-700 text-white shadow-xs" : "text-neutral-400"}`}
                >
                  {al}
                </button>
              ))}
            </div>
          )}

          {/* Doc Card Mode Toggle */}
          {textEl && textEl.type === "text" && (
            <details className="border-t border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-400">Document card</summary><div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-purple-400" />
                  Doc Container
                </label>
                <button
                  onClick={() =>
                    onUpdateElement({
                      isDocCard: !textEl.isDocCard,
                      fill: !textEl.isDocCard ? "#18181B" : "transparent",
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                    textEl.isDocCard
                      ? "bg-purple-600 text-white font-semibold shadow-xs"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
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
                  className="w-full text-[11px] py-1 px-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-purple-500 transition"
                />
              )}
            </div></details>
          )}

          {/* Bullets & Lists Variant Selector */}
          {textEl && textEl.type === "text" && (
            <details className="border-t border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-400">Lists</summary><div className="mt-2 space-y-2">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Bullets & Lists
              </label>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <button
                  onClick={() => handleApplyBulletVariant("disc")}
                  title="Disc Bullet (• item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  • Disc
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("circle")}
                  title="Circle Bullet (○ item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ○ Circ
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("square")}
                  title="Square Bullet (▪ item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ▪ Sq
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("diamond")}
                  title="Diamond Bullet (◆ item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ◆ Diam
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("dash")}
                  title="Dash Bullet (– item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  – Dash
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("arrow")}
                  title="Arrow Bullet (→ item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  → Arrow
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("number")}
                  title="Numbered List (1. 2. 3.)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  1. Num
                </button>
                <button
                  onClick={() => handleApplyBulletVariant("todo")}
                  title="Task / Checklist ([ ] item)"
                  className="py-1 px-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center justify-center font-medium transition"
                >
                  ☑ Task
                </button>
              </div>
              <button
                onClick={() => handleApplyBulletVariant("clear")}
                title="Clear Bullets / Numbering"
                className="w-full py-0.5 rounded text-[10px] text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition text-center cursor-pointer"
              >
                Clear List Bullets
              </button>
            </div></details>
          )}
        </div>
      )}

      {selectedElement?.type === "line" && (
        <div className="space-y-1">
          <p className="text-[10px] text-neutral-400">Drag the center diamond to bend the line.</p>
          <label className="flex items-center justify-between gap-2 text-[10px] text-neutral-400">
            Bend (px)
            <input type="number" aria-label="Line bend in pixels" step="1"
              value={Math.round((selectedElement.bendOffset ?? 0) / 2)}
              onChange={event => {
                const bend = event.currentTarget.valueAsNumber;
                if (Number.isFinite(bend)) onUpdateElement({ bendOffset: bend * 2 });
              }}
              className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 focus-visible:outline-2 focus-visible:outline-blue-500" />
          </label>
          <p className="text-[10px] text-neutral-500">Use positive or negative values to bend either way. Set 0 for a straight line.</p>
        </div>
      )}

      {selectedTool === "eyedropper" && <p className="text-xs text-neutral-400">Click an object to use its color for drawing.</p>}
      {!isImage && <ColorControl label="Custom stroke color" value={activeStroke} onChange={handleStrokeColor} />}
      {isImage && <p className="text-xs text-neutral-400">Drag to move this image. Use the selection handles to resize it.</p>}
      {/* Stroke Color */}
      {!isImage && <div>
        <label className="text-[11px] font-medium text-neutral-400 tracking-wide block mb-1">
          {isIcon ? "Icon color" : isTextual ? "Text color" : "Stroke color"}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`Color ${color}`} title={color} aria-pressed={activeStroke === color}
              onClick={() => handleStrokeColor(color)}
              className={`w-6 h-6 rounded-md border transition-transform ${
                activeStroke === color
                  ? "scale-115 ring-2 ring-blue-500 ring-offset-1 ring-offset-neutral-900 border-white"
                  : "border-neutral-300 dark:border-neutral-700 hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>}

      {hasBackground && <div className="space-y-2">
        <ColorControl label="Background color" value={activeFill === "transparent" ? "transparent" : parseFillColor(activeFill).color} onChange={fill => changeBackground(fill)} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Background colors">
          {["#303236", "#454b53", "#48596b", "#4a5b4c", "#6a6048", "#674c4b", "#5c5268", "#c7ba91"].map(color => <button type="button" key={color} aria-label={`Background ${color}`} title={color} aria-pressed={activeFill === color} onClick={() => changeBackground(color)} style={{ backgroundColor: color }} className={`h-6 w-6 rounded-md border border-neutral-600 ${activeFill === color ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-neutral-900" : "hover:border-neutral-400"}`} />)}
        </div>
        <BackgroundStylePicker value={activeFillStyle} onChange={pattern => changeBackground(activeFill === "transparent" ? "#48596b" : parseFillColor(activeFill).color, pattern)} />
        <button type="button" aria-pressed={activeFill === "transparent"} onClick={() => changeBackground("transparent")} className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800">No background</button>
      </div>}

      {!isIcon && !isImage && !isTextual && <details className="border-t border-neutral-800 pt-2 text-xs"><summary className="cursor-pointer py-1 text-neutral-400">Line & corners</summary><div className="mt-3 space-y-3">
      {/* Stroke Style: Clean (Eraser) vs Sketchy (Excalidraw) vs Dashed */}
      <div>
        <label className="text-[11px] font-medium text-neutral-400 tracking-wide block mb-1">
          Stroke Style
        </label>
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] text-center">
          <button
            onClick={() => handleStrokeStyle("solid")}
            title="Clean (Eraser)"
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
            title="Sketchy (Excalidraw)"
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
          <label className="text-[11px] font-medium text-neutral-400 tracking-wide block mb-1">
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
            <label className="text-[11px] font-medium text-neutral-400 tracking-wide block mb-1">
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
        <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider block mb-1">
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
                <CornerDownRight className="w-3 h-3 text-blue-500" />
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
                <Spline className="w-3 h-3 text-purple-500" />
                Curved
              </button>
            </div>
            {arrowEl && activeRouting !== "elbow" && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-neutral-400">Drag the center diamond to bend the arrow.</p>
                <label className="flex items-center justify-between gap-2 text-[10px] text-neutral-400">
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
                    className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 focus-visible:outline-2 focus-visible:outline-blue-500"
                  />
                </label>
                <p className="text-[10px] text-neutral-500">Use positive or negative values to bend either way. Choose Straight to reset.</p>
              </div>
            )}
          </div>

          {/* Start and End Head Caps */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wider block mb-0.5">
                Start Cap
              </label>
              <select
                aria-label="Arrow start cap"
                value={activeHeadStart}
                onChange={(e) => handleHeadStart(e.target.value as ArrowHead)}
                className="w-full text-[11px] py-1 px-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 outline-none"
              >
                <option value="none">None</option>
                <option value="arrow">Arrow</option>
                <option value="dot">Dot</option>
                <option value="diamond">Diamond</option>
                <option value="bar">Bar</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wider block mb-0.5">
                End Cap
              </label>
              <select
                aria-label="Arrow end cap"
                value={activeHeadEnd}
                onChange={(e) => handleHeadEnd(e.target.value as ArrowHead)}
                className="w-full text-[11px] py-1 px-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 outline-none"
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
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/30 font-semibold"
                  : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <Zap className="w-2.5 h-2.5" />
              Flow
            </button>
          </div>

          {/* Arrow Label Input */}
          <div>
            <label className="text-[9px] font-medium text-neutral-400 uppercase tracking-wider block mb-0.5">
              Arrow Label
            </label>
            <input
              type="text"
              aria-label="Arrow label"
              value={arrowEl?.label || ""}
              onChange={(e) => handleArrowLabel(e.target.value)}
              placeholder="e.g. HTTP, Events..."
              className="w-full text-[11px] py-1 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      )}

      {/* Opacity */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-neutral-400 mb-0.5">
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
          className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {onBackgroundChange && <details className="border-t border-neutral-800 pt-2"><summary className="cursor-pointer py-1 text-xs text-neutral-400">Canvas background</summary><div className="mt-2 space-y-2"><ColorControl label="Canvas background color" value={background.fill} onChange={fill => onBackgroundChange({ ...background, fill, fillOpacity: 1 })} /><BackgroundStylePicker label="Canvas background style" value={background.fillStyle} onChange={fillStyle => onBackgroundChange({ ...background, fillStyle, fillOpacity: 1 })} /></div></details>}
      </div>
      {selectedElement && <footer aria-label="Selection actions" className="grid shrink-0 grid-cols-2 gap-2 border-t border-neutral-800 bg-neutral-900/80 p-3 text-xs">
        <button onClick={onDuplicate} aria-label="Duplicate selection" title="Duplicate (Ctrl/Cmd+D)" className="flex h-8 items-center justify-center gap-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-blue-500"><Copy className="h-3.5 w-3.5" />Duplicate</button>
        <button onClick={onDelete} aria-label="Delete selection" title="Delete (Del)" className="flex h-8 items-center justify-center gap-2 rounded-lg border border-neutral-700 text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-rose-500"><Trash2 className="h-3.5 w-3.5" />Delete</button>
        <button onClick={onBringToFront} className="flex h-8 items-center justify-center gap-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"><BringToFront className="h-3.5 w-3.5" />Bring to front</button>
        <button onClick={onSendToBack} className="flex h-8 items-center justify-center gap-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"><SendToBack className="h-3.5 w-3.5" />Send to back</button>
      </footer>}
    </div>
  );
}
