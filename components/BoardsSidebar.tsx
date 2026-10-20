"use client";

import { brandAsset } from "@/lib/brandAssets";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Copy, Search, Upload, FolderOpen, ArrowRight } from "lucide-react";
import type { BoardSummary, Theme, Workspace } from "@/draw/types";

interface Props {
  isOpen: boolean; onClose: () => void; boards: BoardSummary[]; activeBoardId: string;
  onSelectBoard: (id: string) => void; onCreateBoard: (title?: string) => void;
  onDuplicateBoard: (id: string) => void; onDeleteBoard: (id: string) => void;
  onImportJson: (json: string, filename?: string) => void; theme: Theme;
  workspaces: Workspace[]; workspaceId: string; onChangeWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void; onMoveBoard: (id: string, workspaceId: string) => void;
}

export function BoardsSidebar(p: Props) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (p.isOpen) dialog.current?.showModal(); else dialog.current?.close();
  }, [p.isOpen]);
  const workspaceBoards = p.boards.filter(b => (b.workspaceId || "personal") === p.workspaceId);
  const filtered = workspaceBoards.filter(b => b.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt);
  const inputClass = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const actionClass = "p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800";
  return (
    <dialog ref={dialog} onCancel={p.onClose} onClose={p.onClose} aria-labelledby="workspace-title" className="workspace-drawer m-0 h-dvh max-h-dvh w-[340px] max-w-[92vw] border-0 border-r border-neutral-800 bg-[#18181b] p-0 text-neutral-100 shadow-2xl" onClick={e => { if (e.target === dialog.current && e.clientX > (dialog.current?.getBoundingClientRect().right ?? 340)) p.onClose(); }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2"><Image src={brandAsset("/icons/mark.svg")} alt="" width={28} height={28} /><h2 id="workspace-title" className="text-sm font-semibold">Knotleaf Desk</h2></div>
          <button onClick={p.onClose} aria-label="Close workspaces" className={actionClass}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 border-b border-neutral-800 p-4">
          <label className="block text-xs text-neutral-400" htmlFor="workspace-select">Current workspace</label>
          <div className="flex gap-2">
            <select id="workspace-select" className={inputClass} value={p.workspaceId} onChange={e => { p.onChangeWorkspace(e.target.value); setSearch(""); setDeleting(null); }}>
              {p.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button aria-label="Create workspace" title="Create workspace" className={actionClass} onClick={() => setCreating(!creating)}><Plus className="h-4 w-4" /></button>
          </div>
          {creating && <form noValidate onSubmit={e => { e.preventDefault(); if (!name.trim()) return; p.onCreateWorkspace(name.trim()); setName(""); setCreating(false); }} className="space-y-2">
            <label htmlFor="workspace-name" className="text-xs text-neutral-400">Workspace name</label>
            <input id="workspace-name" autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Product planning" />
            <div className="flex gap-2"><button type="submit" disabled={!name.trim()} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500 disabled:opacity-40">Create workspace</button><button type="button" onClick={() => setCreating(false)} className="px-3 text-xs text-neutral-400">Cancel</button></div>
          </form>}
          <button onClick={() => { p.onCreateBoard(); setSearch(""); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"><Plus className="h-4 w-4" />New board</button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <input ref={searchInput} aria-label="Search boards" placeholder="Search boards…" value={search} onChange={e => setSearch(e.target.value)} className={`${inputClass} pl-9 pr-9`} />
            {search && <button aria-label="Clear board search" onClick={() => { setSearch(""); searchInput.current?.focus(); }} className="absolute right-1 top-1 p-1.5 text-neutral-400"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Boards · {workspaceBoards.length}</p>
          {filtered.map(b => <div key={b.id} className={`mb-2 rounded-lg border ${b.id === p.activeBoardId ? "border-blue-500/40 bg-blue-500/10" : "border-transparent hover:bg-neutral-800/60"}`}>
            <div className="flex items-center p-1">
              <button onClick={() => { p.onSelectBoard(b.id); p.onClose(); }} aria-current={b.id === p.activeBoardId ? "page" : undefined} className="min-w-0 flex-1 rounded-md p-2 text-left hover:bg-white/5">
                <span className="block truncate text-sm font-medium" title={b.title}>{b.title}</span>
                <span className="mt-1 block text-[11px] text-neutral-500">{b.elementCount} elements · {new Date(b.updatedAt).toLocaleDateString()}</span>
              </button>
              <button aria-label={`Duplicate ${b.title}`} title="Duplicate board" onClick={() => p.onDuplicateBoard(b.id)} className={actionClass}><Copy className="h-3.5 w-3.5" /></button>
              <button aria-label={`Delete ${b.title}`} title="Delete board" onClick={() => setDeleting(b.id)} className={`${actionClass} hover:text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {deleting === b.id ? <div className="space-y-2 border-t border-neutral-800 p-3"><p className="text-xs text-neutral-300">Delete “{b.title}”? This removes the board and its notes from this browser.</p><div className="flex gap-2"><button autoFocus onClick={() => setDeleting(null)} className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs">Cancel</button><button onClick={() => { p.onDeleteBoard(b.id); setDeleting(null); }} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs text-white">Delete board</button></div></div> : p.workspaces.length > 1 && <details className="px-3 pb-2 text-[11px] text-neutral-500"><summary className="cursor-pointer py-1 hover:text-neutral-300">Move board</summary><label className="flex items-center gap-2 py-1"><ArrowRight className="h-3 w-3" />Move to<select aria-label={`Workspace for ${b.title}`} value={b.workspaceId || "personal"} onChange={e => p.onMoveBoard(b.id, e.target.value)} className="min-w-0 flex-1 bg-transparent text-neutral-400"><option value={p.workspaceId}>{p.workspaces.find(w => w.id === p.workspaceId)?.name}</option>{p.workspaces.filter(w => w.id !== p.workspaceId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label></details>}
          </div>)}
          {!filtered.length && <div className="px-4 py-10 text-center"><FolderOpen className="mx-auto mb-3 h-7 w-7 text-neutral-600" /><p className="text-sm text-neutral-300">{search ? "No matching boards" : "A space for your next idea"}</p><p className="mt-2 text-xs text-neutral-500">{search ? "Try another search or clear the filter." : "Create a board to start drawing and taking notes."}</p></div>}
        </div>
        <div className="space-y-3 border-t border-neutral-800 p-4">
          {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
          <input ref={file} type="file" accept=".knotleaf,.json,.md,.markdown" className="hidden" onChange={async e => { const selected = e.target.files?.[0]; e.target.value = ""; if (!selected) return; try { setError(""); if (selected.size > 50_000_000) throw new Error("This file exceeds the 50 MB import limit."); p.onImportJson(await selected.text(), selected.name); } catch (error) { setError(error instanceof Error ? error.message : "Could not open this file. Choose a Knotleaf, JSON, or Markdown file."); } }} />
          <button onClick={() => file.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2 text-xs text-neutral-300 hover:bg-neutral-800"><Upload className="h-3.5 w-3.5" />Open project or notes</button>
          <p className="text-center text-[11px] text-neutral-500">Local workspaces · saved on this device</p>
        </div>
      </div>
    </dialog>
  );
}
