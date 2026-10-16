"use client";

import React, { useState } from "react";
import { X, Sparkles, LayoutTemplate, ArrowRight } from "lucide-react";
import { TEMPLATES, TemplateDefinition } from "@/draw/templatesData";
import { Theme } from "@/draw/types";

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TemplateDefinition, replace: boolean) => void;
  theme: Theme;
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplatesModalProps) {
  const [replaceCanvas, setReplaceCanvas] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border border-neutral-800 bg-[#18181b] text-white flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">
                Eraser Pro Diagram Templates
              </h2>
              <p className="text-xs text-neutral-400">
                Instantly generate production architecture diagrams and workflows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800/40 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl border border-neutral-800 bg-[#1e1e24] hover:bg-neutral-800/80 hover:border-purple-500/50 flex flex-col justify-between transition-all group hover:scale-[1.01]"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-purple-500/20 text-purple-400">
                    {tmpl.category}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {tmpl.elements.length} elements
                  </span>
                </div>
                <h3 className="font-semibold text-base mb-1.5 group-hover:text-purple-400 transition">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  {tmpl.description}
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectTemplate(tmpl, replaceCanvas);
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25 transition cursor-pointer"
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Use Template
                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t text-xs flex justify-between items-center border-neutral-800 bg-neutral-950/40"
        >
          <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-400">
            <input
              type="checkbox"
              checked={replaceCanvas}
              onChange={(e) => setReplaceCanvas(e.target.checked)}
              className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
            />
            Replace current canvas (uncheck to append to current board)
          </label>
          <span className="text-neutral-500">
            Includes linked Markdown documentation notes
          </span>
        </div>
      </div>
    </div>
  );
}
