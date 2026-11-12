"use client";

import React from "react";
import { ArrowRight, Command, LayoutTemplate, Pencil, Sparkles, StickyNote, Workflow, X } from "lucide-react";
import type { Theme } from "@/draw/types";
import { COLOR_MOODS, type ColorMood } from "@/lib/premiumPalette";

export function CanvasWelcome({
  theme,
  onStartSticky,
  onStartSketch,
  onInsertMindMap,
  onOpenTemplates,
  onOpenThemes,
  onChooseMood,
  onDismiss,
}: {
  theme: Theme;
  onStartSticky: () => void;
  onStartSketch: () => void;
  onInsertMindMap: () => void;
  onOpenTemplates: () => void;
  onOpenThemes: () => void;
  onChooseMood: (mood: ColorMood) => void;
  onDismiss?: () => void;
}) {
  return <div aria-label="New board quick start" className="welcome-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pb-16 pt-24">
    <div data-theme={theme} className="welcome-card pointer-events-auto relative w-[min(760px,100%)] rounded-2xl border p-5 shadow-2xl sm:p-7">
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss quick start" title="Dismiss quick start" className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"><X aria-hidden="true" className="h-3.5 w-3.5" /></button>}
      <div className="flex items-start gap-3.5">
        <span className="welcome-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Sparkles aria-hidden="true" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">New board</p>

          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-[22px]">A blank canvas, ready when you are.</h2>
          <p className="mt-1 max-w-[56ch] text-xs leading-relaxed text-neutral-500">Capture a thought, shape a flow or start from a template. Everything stays on this device.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={onStartSticky} className="welcome-action group flex items-center gap-3 rounded-xl border p-3 text-left transition">
          <span className="welcome-action-icon" data-tone="iris"><StickyNote aria-hidden="true" className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-neutral-900 dark:text-white">Capture a thought</span><span className="mt-0.5 block text-[10px] text-neutral-500">Drop a sticky note</span></span>
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" />
        </button>
        <button type="button" onClick={onInsertMindMap} className="welcome-action group flex items-center gap-3 rounded-xl border p-3 text-left transition">
          <span className="welcome-action-icon" data-tone="aqua"><Workflow aria-hidden="true" className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-neutral-900 dark:text-white">Map an idea</span><span className="mt-0.5 block text-[10px] text-neutral-500">Start a mind map</span></span>
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" />
        </button>
        <button type="button" onClick={onStartSketch} className="welcome-action group flex items-center gap-3 rounded-xl border p-3 text-left transition">
          <span className="welcome-action-icon" data-tone="coral"><Pencil aria-hidden="true" className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-neutral-900 dark:text-white">Sketch it out</span><span className="mt-0.5 block text-[10px] text-neutral-500">Draw freehand</span></span>
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-neutral-200/70 pt-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Color mood</p>
            <p className="mt-0.5 text-[10px] text-neutral-500">Sets the palette for your next shape.</p>
          </div>
          <div role="group" aria-label="Starter color moods" className="flex items-center gap-1.5">
            {COLOR_MOODS.map(mood => <button
              key={mood.id}
              type="button"
              onClick={() => onChooseMood(mood)}
              aria-label={`Start with ${mood.name} colors`}
              title={`${mood.name} · ${mood.description}`}
              className="welcome-mood h-7 w-7 rounded-full border-2 transition hover:scale-110"
              style={{ background: `linear-gradient(135deg, ${mood.stroke} 0 52%, ${mood.fill} 52% 100%)`, borderColor: `${mood.stroke}55` }}
            />)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpenTemplates} className="welcome-secondary inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium"><LayoutTemplate aria-hidden="true" className="h-3.5 w-3.5" /> Templates</button>
          <button type="button" onClick={onOpenThemes} className="welcome-secondary inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium">Themes</button>
          <span className="hidden items-center gap-1 text-[10px] text-neutral-500 md:flex"><Command aria-hidden="true" className="h-3 w-3" /><kbd className="welcome-key">K</kbd> for every action</span>
        </div>
      </div>
    </div>
  </div>;
}
