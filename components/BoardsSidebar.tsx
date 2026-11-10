"use client";

import { brandAsset } from "@/lib/brandAssets";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Copy, Search, Upload, FolderOpen, ArrowRight, Pin } from "lucide-react";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { normalizeBoardLibrary, searchBoards, type BoardLibrarySettings } from "@/lib/boardLibrarySettings";
import type { BoardSummary, Theme, Workspace } from "@/draw/types";

interface Props {
  isOpen: boolean; onClose: () => void; boards: BoardSummary[]; activeBoardId: string;
  onSelectBoard: (id: string) => void; onCreateBoard: (title?: string) => void;
  onDuplicateBoard: (id: string) => void; onDeleteBoard: (id: string) => void;
  onImportFile: (file: File) => Promise<void>; theme: Theme;
  workspaces: Workspace[]; workspaceId: string; onChangeWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void; onMoveBoard: (id: string, workspaceId: string) => void;
}

export function BoardsSidebar(p: Props) {
  const [library, setLibrary] = useState(() => loadPreferences().boardLibrary);
  const [libraryError, setLibraryError] = useState("");
  const updateLibrary = (patch: Partial<BoardLibrarySettings>) => {
    const next = normalizeBoardLibrary({...library, ...patch}); setLibrary(next); setPage({key:"",limit:50});
    setLibraryError(savePreferences({boardLibrary:next}) ? "" : "Could not save library preferences. Your changes apply until this page closes.");
  };
  const [page, setPage] = useState({key:"",limit:50});
  const [search, setSearch] = useState("");
  const updateSearch = (value: string) => { setSearch(value); setPage({key:"",limit:50}); };
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (p.isOpen) { dialog.current?.showModal(); searchInput.current?.focus(); } else dialog.current?.close();
  }, [p.isOpen]);
  const workspaceBoards = p.boards.filter(b => (b.workspaceId || "personal") === p.workspaceId);
  const filtered = searchBoards(p.boards, p.workspaces, p.workspaceId, search, library);
  const resultKey = JSON.stringify([search, p.workspaceId, library]);
  const limit = page.key === resultKey ? page.limit : 50;
  const visible = filtered.slice(0,limit);
  const total = library.scope === "all" ? p.boards.length : workspaceBoards.length;
  const fieldClass = "w-full rounded-lg border border-neutral-700 bg-neutral-900 text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white";
  const inputClass = `${fieldClass} px-3 py-2 text-sm`;
  const selectClass = `${fieldClass} min-w-0 px-2 py-1.5 text-xs`;
  const actionClass = "p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800";
  return (
    <dialog ref={dialog} onCancel={p.onClose} onClose={p.onClose} aria-labelledby="workspace-title" className="workspace-drawer m-0 h-dvh max-h-dvh w-[340px] max-w-[92vw] border-0 border-r border-neutral-800 bg-white dark:bg-black p-0 text-neutral-100 shadow-2xl" onClick={e => { if (e.target === dialog.current && e.clientX > (dialog.current?.getBoundingClientRect().right ?? 340)) p.onClose(); }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2"><Image src={brandAsset("/icons/mark.svg")} alt="" width={28} height={28} /><h2 id="workspace-title" className="text-sm font-semibold">Knotleaf Desk</h2></div>
          <button onClick={p.onClose} aria-label="Close workspaces" className={actionClass}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 border-b border-neutral-800 p-4">
          <label className="block text-xs text-neutral-400" htmlFor="workspace-select">Current workspace</label>
          <div className="flex gap-2">
            <select id="workspace-select" className={inputClass} value={p.workspaceId} onChange={e => { p.onChangeWorkspace(e.target.value); updateSearch(""); setDeleting(null); }}>
              {p.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button aria-label="Create workspace" title="Create workspace" className={actionClass} onClick={() => setCreating(!creating)}><Plus className="h-4 w-4" /></button>
          </div>
          {creating && <form noValidate onSubmit={e => { e.preventDefault(); if (!name.trim()) return; p.onCreateWorkspace(name.trim()); setName(""); setCreating(false); }} className="space-y-2">
            <label htmlFor="workspace-name" className="text-xs text-neutral-400">Workspace name</label>
            <input id="workspace-name" autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Product planning" />
            <div className="flex gap-2"><button type="submit" disabled={!name.trim()} className="flex-1 rounded-lg ui-primary px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-500 disabled:opacity-40">Create workspace</button><button type="button" onClick={() => setCreating(false)} className="px-3 text-xs text-neutral-400">Cancel</button></div>
          </form>}
          <button onClick={() => { p.onCreateBoard(); updateSearch(""); }} className="flex w-full items-center justify-center gap-2 rounded-lg ui-primary py-2 text-sm font-medium text-white hover:bg-neutral-500"><Plus className="h-4 w-4" />New board</button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <input ref={searchInput} aria-label="Search boards" placeholder="Search boards…" value={search} onChange={e => updateSearch(e.target.value)} className={`${inputClass} pl-9 pr-9`} />
            {search && <button aria-label="Clear board search" onClick={() => { updateSearch(""); searchInput.current?.focus(); }} className="absolute right-1 top-1 p-1.5 text-neutral-400"><X className="h-4 w-4" /></button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-neutral-400">Search in<select aria-label="Board search scope" value={library.scope} onChange={e=>{updateLibrary({scope:e.target.value as BoardLibrarySettings['scope']});setDeleting(null);}} className={selectClass}><option value="workspace">This workspace</option><option value="all">All workspaces</option></select></label>
            <label className="space-y-1 text-[11px] text-neutral-400">Sort boards<select aria-label="Sort boards" value={library.sort} onChange={e=>updateLibrary({sort:e.target.value as BoardLibrarySettings['sort']})} className={selectClass}><option value="updated">Recently edited</option><option value="title">Name A–Z</option><option value="created">Newest created</option></select></label>
          </div>
          {libraryError&&<p role="status" className="text-xs text-neutral-400">{libraryError}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">

          <p role="status" aria-live="polite" className="mb-2 px-2 text-[11px] font-medium text-neutral-500">{filtered.length} of {total} boards · pinned first</p>
          {visible.map(b => <div key={b.id} className={`mb-2 rounded-lg border ${b.id === p.activeBoardId ? "border-neutral-500/40 bg-neutral-500/10" : "border-transparent hover:bg-neutral-800/60"}`}>
            <div className="flex items-center p-1">
              <button type="button" aria-label={`${library.pinnedIds.includes(b.id) ? "Unpin" : "Pin"} ${b.title}`} aria-pressed={library.pinnedIds.includes(b.id)} title={library.pinnedIds.includes(b.id) ? "Unpin board" : "Pin board"} className={`${actionClass} ${library.pinnedIds.includes(b.id) ? "text-neutral-400" : ""}`} onClick={()=>updateLibrary({pinnedIds:library.pinnedIds.includes(b.id)?library.pinnedIds.filter(id=>id!==b.id):[...library.pinnedIds,b.id]})}><Pin className="h-3.5 w-3.5" /></button>
              <button onClick={() => { p.onSelectBoard(b.id); p.onClose(); }} aria-current={b.id === p.activeBoardId ? "page" : undefined} className="min-w-0 flex-1 rounded-md p-2 text-left hover:bg-white/5">
                <span className="block truncate text-sm font-medium" title={b.title}>{b.title}</span>
                <span className="mt-1 block text-[11px] text-neutral-500">{library.scope === "all" && `${p.workspaces.find(w=>w.id===(b.workspaceId||"personal"))?.name || "Workspace"} · `}{b.elementCount} elements · {new Date(b.updatedAt).toLocaleDateString()}</span>
              </button>
              <button aria-label={`Duplicate ${b.title}`} title="Duplicate board" onClick={() => p.onDuplicateBoard(b.id)} className={actionClass}><Copy className="h-3.5 w-3.5" /></button>
              <button aria-label={`Delete ${b.title}`} title="Delete board" onClick={() => setDeleting(b.id)} className={`${actionClass} hover:text-neutral-400`}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {deleting === b.id ? <div className="space-y-2 border-t border-neutral-800 p-3"><p className="text-xs text-neutral-300">Delete “{b.title}”? This removes the board and its notes from this browser.</p><div className="flex gap-2"><button autoFocus onClick={() => setDeleting(null)} className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs">Cancel</button><button onClick={() => { p.onDeleteBoard(b.id); setDeleting(null); }} className="rounded-md ui-primary px-3 py-1.5 text-xs text-white">Delete board</button></div></div> : p.workspaces.length > 1 && <details className="px-3 pb-2 text-[11px] text-neutral-500"><summary className="cursor-pointer py-1 hover:text-neutral-300">Move board</summary><label className="flex items-center gap-2 py-1"><ArrowRight className="h-3 w-3" />Move to<select aria-label={`Workspace for ${b.title}`} value={b.workspaceId || "personal"} onChange={e => p.onMoveBoard(b.id, e.target.value)} className="min-w-0 flex-1 bg-transparent text-neutral-400">{p.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label></details>}
          </div>)}
          {visible.length < filtered.length && <button type="button" onClick={()=>setPage({key:resultKey,limit:limit+50})} className="mb-3 w-full rounded-lg border border-neutral-700 py-2 text-xs text-neutral-300 hover:bg-neutral-800">Load more boards ({filtered.length-visible.length} remaining)</button>}
          {!filtered.length && <div className="px-4 py-10 text-center"><FolderOpen className="mx-auto mb-3 h-7 w-7 text-neutral-600" /><p className="text-sm text-neutral-300">{search.trim() ? "No matching boards" : "A space for your next idea"}</p><p className="mt-2 text-xs text-neutral-500">{search.trim() ? "Try another search or clear the filter." : "Create a board to start drawing and taking notes."}</p></div>}
        </div>
        <div className="space-y-3 border-t border-neutral-800 p-4">
          <input ref={file} type="file" aria-label="Import project or Markdown from workspace" accept=".knotleaf,.json,.md,.markdown" className="hidden" onChange={event=>{const selected=event.target.files?.[0];event.target.value="";if(!selected)return;p.onClose();void p.onImportFile(selected);}} />
          <button onClick={() => file.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 py-2 text-xs text-neutral-300 hover:bg-neutral-800"><Upload className="h-3.5 w-3.5" />Open project or notes</button>
          <p className="text-center text-[11px] text-neutral-500">Local workspaces · saved on this device</p>
        </div>
      </div>
    </dialog>
  );
}
