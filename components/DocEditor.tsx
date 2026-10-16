"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Heading1, List, CheckSquare, Code, Quote, Download, Eye, Edit3, Bold, Italic, ListTree, X } from "lucide-react";

interface DocEditorProps {
  value: string; onChange: (value: string) => void; onExportMarkdown: () => void;
  theme: "dark" | "light";
}
export function DocEditor({ value, onChange, onExportMarkdown }: DocEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [outline, setOutline] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
  const headings = value.split("\n").map((text, line) => ({ text, line })).filter(h => /^#{1,6}\s/.test(h.text));
  const insertText = (before: string, after = "") => {
    const input = textarea.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = value.slice(start, end) || "text";
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + before.length, start + before.length + selected.length); });
  };
  const tools = [
    { label: "Heading", icon: Heading1, before: "# " },
    { label: "Bold (Ctrl+B)", icon: Bold, before: "**", after: "**" },
    { label: "Italic (Ctrl+I)", icon: Italic, before: "*", after: "*" },
    { label: "Bullet list", icon: List, before: "- " },
    { label: "Checklist", icon: CheckSquare, before: "- [ ] " },
    { label: "Code block", icon: Code, before: "\n```\n", after: "\n```\n" },
    { label: "Quote", icon: Quote, before: "> " },
  ];
  return <div className="flex h-full min-h-0 flex-col bg-[#18181b] text-neutral-200">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
      <h2 className="text-xs font-semibold">Notes</h2>
      <div className="flex items-center gap-1">
        <button aria-label="Show note outline" aria-pressed={outline} title="Outline" onClick={() => setOutline(!outline)} className={`note-tool ${outline ? "text-blue-400" : ""}`}><ListTree className="h-4 w-4" /></button>
        <button onClick={() => setPreview(!preview)} aria-pressed={preview} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800">{preview ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{preview ? "Edit" : "Preview"}</button>
        <button aria-label="Download notes as Markdown" title="Download Markdown" onClick={onExportMarkdown} className="note-tool"><Download className="h-4 w-4" /></button>
      </div>
    </div>
    {!preview && <div role="toolbar" aria-label="Note formatting" className="flex flex-wrap gap-0.5 border-b border-neutral-800 px-2 py-1">{tools.map(t => <button key={t.label} className="note-tool" title={t.label} aria-label={t.label} onClick={() => insertText(t.before, t.after)}><t.icon className="h-4 w-4" /></button>)}</div>}
    {outline && <nav aria-label="Note outline" className="max-h-40 overflow-y-auto border-b border-neutral-800 px-3 py-2"><div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">Outline<button aria-label="Close outline" onClick={() => setOutline(false)} className="note-tool"><X className="h-3 w-3" /></button></div>{headings.length ? headings.map(h => <button key={h.line} className="block w-full truncate rounded px-2 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white" onClick={() => { setPreview(false); requestAnimationFrame(() => { const input = textarea.current; if (!input) return; const offset = value.split("\n").slice(0, h.line).reduce((n, l) => n + l.length + 1, 0); input.focus(); input.setSelectionRange(offset, offset + h.text.length); input.scrollTop = h.line * 24; }); }}>{h.text.replace(/^#+\s/, "")}</button>) : <p className="py-2 text-xs text-neutral-500">Add headings with # to organize your notes.</p>}</nav>}
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {preview ? <article className="note-preview mx-auto max-w-3xl break-words p-5"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>{value || "*Your notes will appear here. Switch to Edit to start writing.*"}</ReactMarkdown></article> : <textarea ref={textarea} aria-label="Board notes in Markdown" value={value} onChange={e => onChange(e.target.value)} placeholder={"Capture your thinking…\n\n# Project notes\n\n- Ideas, decisions, and next steps\n- [ ] Your first task\n\nUse Markdown for headings, tables, links, and code."} spellCheck className="mx-auto block h-full min-h-60 w-full max-w-3xl resize-none border-0 bg-transparent p-5 font-mono text-[13px] leading-6 text-neutral-200 placeholder:text-neutral-600 focus:outline-none" onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "i")) { e.preventDefault(); const mark = e.key.toLowerCase() === "b" ? "**" : "*"; insertText(mark, mark); }
        if (e.key === "Tab") { e.preventDefault(); const input = e.currentTarget, start = input.selectionStart, end = input.selectionEnd; onChange(value.slice(0, start) + "  " + value.slice(end)); requestAnimationFrame(() => input.setSelectionRange(start + 2, start + 2)); }
        if (e.key === "Enter" && !e.shiftKey && !mod) {
          const input = e.currentTarget, start = input.selectionStart, end = input.selectionEnd;
          const lineStart = value.lastIndexOf("\n", start - 1) + 1;
          const current = value.slice(lineStart, start);
          const match = current.match(/^(\s*)([-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)(.*)$/);
          if (match) {
            e.preventDefault();
            if (!match[3].trim()) { onChange(value.slice(0, lineStart) + "\n" + value.slice(end)); requestAnimationFrame(() => input.setSelectionRange(lineStart + 1, lineStart + 1)); }
            else {
              let prefix = match[2].replace(/\[[xX]\]/, "[ ]");
              if (/^\d+\./.test(prefix)) prefix = `${parseInt(prefix, 10) + 1}. `;
              const insertion = "\n" + match[1] + prefix;
              onChange(value.slice(0, start) + insertion + value.slice(end)); requestAnimationFrame(() => input.setSelectionRange(start + insertion.length, start + insertion.length));
            }
          }
        }
      }} />}
    </div>
    <div className="flex shrink-0 justify-between border-t border-neutral-800 px-3 py-2 text-[10px] text-neutral-500"><span>Markdown</span><span>{words} {words === 1 ? "word" : "words"} · {Math.max(1, Math.ceil(words / 200))} min read</span></div>
  </div>;
}
