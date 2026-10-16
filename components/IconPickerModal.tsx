"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Globe, Library, Loader2 } from "lucide-react";
import { ICONS } from "@/draw/iconsData";
import { normalizeIconSvg, getIconImage } from "@/draw/iconSvg";
import { iconUrl, searchOnlineIcons, fetchOnlineIcon } from "@/lib/onlineIcons";
import { Theme } from "@/draw/types";

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  onSelectOnline: (name: string, id: string, svgMarkup: string, viewBox: string) => void;
  theme: Theme;
}


const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "architecture", label: "Architecture" },
  { id: "aws", label: "AWS" },
  { id: "gcp", label: "GCP" },
  { id: "azure", label: "Azure" },
  { id: "database", label: "Databases" },
  { id: "devops", label: "DevOps" },
  { id: "languages", label: "Languages" },
];

interface OnlineHit {
  id: string; // "prefix:name"
}

/** Preview of an online icon; shows a placeholder if the image can't load (offline or rate-limited). */
function OnlinePreview({ prefix, name }: { prefix: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="w-9 h-9 rounded-md border border-dashed border-neutral-400/50" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconUrl(`${prefix}:${name}`, true)} alt="" className="w-9 h-9" onError={() => setFailed(true)} />
  );
}

export function IconPickerModal({ isOpen, onClose, onSelectIcon, onSelectOnline }: IconPickerModalProps) {
  const [mode, setMode] = useState<"bundled" | "online">("bundled");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [online, setOnline] = useState<{ query: string; hits: OnlineHit[]; error?: string }>({ query: "", hits: [] });
  const [retry, setRetry] = useState(0);
  const [composing, setComposing] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const insertion = useRef<AbortController | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickError, setPickError] = useState("");

  const bundled = useMemo(
    () =>
      ICONS.filter((icon) => {
        const matchCat = category === "all" || icon.category === category;
        const q = search.trim().toLowerCase();
        return matchCat && (!q || icon.name.toLowerCase().includes(q) || icon.id.includes(q));
      }),
    [search, category]
  );

  useEffect(() => {
    if (isOpen) dialog.current?.showModal(); else dialog.current?.close();
    return () => { insertion.current?.abort(); insertion.current = null; };
  }, [isOpen]);

  // Match results to the exact query and ignore requests cancelled by edits or closing.
  useEffect(() => {
    if (!isOpen || mode !== "online" || composing || search.trim().length < 2) return;
    const q = search.trim(), controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const ids = await searchOnlineIcons(q, controller.signal);
        if (!controller.signal.aborted) setOnline({ query: q, hits: ids.map(id => ({ id })) });
      } catch (error) {
        if (!controller.signal.aborted) setOnline({ query: q, hits: [], error: error instanceof Error ? error.message : "Could not reach the icon service." });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, mode, isOpen, composing, retry]);

  const closePicker = () => { insertion.current?.abort(); insertion.current = null; setBusyId(null); onClose(); };
  const status = search.trim().length < 2 ? "idle" : online.query !== search.trim() ? "loading" : online.error ? "error" : "idle";
  const visibleOnline = status === "idle" && search.trim().length >= 2 && !composing ? online.hits : [];
  const retrySearch = () => { setOnline({ query: "", hits: [] }); setRetry(value => value + 1); };
  const pickOnline = async (id: string) => {
    if (insertion.current) return;
    const controller = new AbortController(); insertion.current = controller;
    setBusyId(id); setPickError("");
    try {
      const source = await fetchOnlineIcon(id, controller.signal);
      const safe = normalizeIconSvg(source);
      await getIconImage(safe.svgMarkup, safe.viewBox, "#E2E8F0").loaded;
      if (controller.signal.aborted) return;
      onSelectOnline(id.split(":")[1], id, safe.svgMarkup, safe.viewBox);
      closePicker();
    } catch (error) {
      if (!controller.signal.aborted) setPickError(error instanceof Error ? error.message : "Could not load this icon. Try another icon.");
    } finally {
      if (insertion.current === controller) { insertion.current = null; setBusyId(null); }
    }
  };

  const panel = "bg-[#18181b] border-neutral-800 text-white";
  const subtle = "text-neutral-400";
  const cell = "border-neutral-800 hover:bg-neutral-800/80";
  const input = "bg-neutral-800 border-neutral-700 text-white";

  return (
    <dialog ref={dialog} aria-label="Insert icon" onCancel={closePicker} onClose={closePicker}
      className={`m-auto w-[min(768px,92vw)] max-h-[85dvh] rounded-xl shadow-2xl border border-neutral-800 p-0 ${panel}`}>
      <div className="flex max-h-[85dvh] flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold">Insert icon</h2>
          </div>
          <div className="flex items-center rounded-lg p-0.5 bg-neutral-500/10 text-xs font-medium">
            <button
              aria-pressed={mode === "bundled"}
              onClick={() => { insertion.current?.abort(); insertion.current = null; setBusyId(null); setPickError(""); setMode("bundled"); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${mode === "bundled" ? "bg-blue-600 text-white" : subtle}`}
            >
              <Library className="w-3.5 h-3.5" /> Built-in
            </button>
            <button
              aria-pressed={mode === "online"}
              onClick={() => { setPickError(""); setMode("online"); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${mode === "online" ? "bg-blue-600 text-white" : subtle}`}
            >
              <Globe className="w-3.5 h-3.5" /> Search online
            </button>
          </div>
          <button onClick={closePicker} aria-label="Close" className={`p-1.5 rounded-lg ${subtle} hover:text-current`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${subtle}`} />
            <input
              ref={searchInput}
              autoFocus
              aria-label="Search icons"
              value={search}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onChange={(e) => { setSearch(e.target.value); setPickError(""); }}
              placeholder={mode === "online" ? "Search 200,000+ icons: aws lambda, kubernetes, postgres…" : "Search built-in icons…"}
              className={`w-full pl-9 pr-9 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${input}`}
            />
            {search && <button aria-label="Clear icon search" onClick={() => { setSearch(""); setPickError(""); searchInput.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          {mode === "bundled" && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition ${
                    category === c.id ? "bg-blue-600 border-blue-600 text-white" : `border-neutral-500/30 ${subtle}`
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-[280px]">
          {mode === "bundled" && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {bundled.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => {
                    onSelectIcon(icon.id);
                    closePicker();
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${cell}`}
                >
                  <svg viewBox="0 0 24 24" className="w-9 h-9" style={{ color: icon.color }} dangerouslySetInnerHTML={{ __html: icon.svgPath }} />
                  <span className="text-[11px] text-center leading-tight">{icon.name}</span>
                </button>
              ))}
              {bundled.length === 0 && <p className={`col-span-full text-center text-sm ${subtle}`}>No built-in icons match.</p>}
            </div>
          )}

          {mode === "online" && (
            <>
              {search.trim().length < 2 && (
                <p className={`text-sm text-center py-10 ${subtle}`}>Type at least two letters. Icons come from Iconify (open-source sets such as Material, Tabler, Simple Icons and AWS / Azure / GCP architecture icons).</p>
              )}
              {status === "loading" && !composing && (
                <div className={`flex items-center justify-center gap-2 py-10 text-sm ${subtle}`}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </div>
              )}
              {status === "error" && (
                <div role="alert" className="py-8 text-center text-sm text-rose-400"><p>{online.error}</p><button onClick={retrySearch} className="mt-3 rounded-lg border border-neutral-700 px-3 py-2 text-neutral-200">Retry search</button></div>
              )}
              {status === "idle" && !composing && search.trim().length >= 2 && visibleOnline.length === 0 && (
                <p className={`text-sm text-center py-10 ${subtle}`}>No icons found for &ldquo;{search.trim()}&rdquo;.</p>
              )}
              {pickError && <p role="alert" className="mb-3 text-sm text-rose-400">{pickError} You can retry or choose another icon.</p>}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {visibleOnline.map((hit) => {
                  const [prefix, name] = hit.id.split(":");
                  return (
                    <button
                      key={hit.id}
                      onClick={() => pickOnline(hit.id)}
                      disabled={busyId !== null}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition disabled:opacity-60 ${cell}`}
                      title={hit.id}
                    >
                      {busyId === hit.id ? (
                        <Loader2 className="w-9 h-9 p-2 animate-spin" />
                      ) : (
                        <OnlinePreview prefix={prefix} name={name} />
                      )}
                      <span className={`text-[11px] text-center leading-tight truncate w-full ${subtle}`}>{name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
