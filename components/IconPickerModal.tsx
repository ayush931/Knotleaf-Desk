"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Globe, Library, Loader2 } from "lucide-react";
import { ICONS } from "@/draw/iconsData";
import { Theme } from "@/draw/types";

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  onSelectOnline: (name: string, id: string, svgMarkup: string, viewBox: string) => void;
  theme: Theme;
}

const ICONIFY = "https://api.iconify.design";

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
    <img src={`${ICONIFY}/${prefix}/${name}.svg`} alt="" className="w-9 h-9" onError={() => setFailed(true)} />
  );
}

export function IconPickerModal({ isOpen, onClose, onSelectIcon, onSelectOnline }: IconPickerModalProps) {
  const [mode, setMode] = useState<"bundled" | "online">("bundled");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [online, setOnline] = useState<OnlineHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("Could not reach the icon index. Check your connection and try again.");

  const bundled = useMemo(
    () =>
      ICONS.filter((icon) => {
        const matchCat = category === "all" || icon.category === category;
        const q = search.trim().toLowerCase();
        return matchCat && (!q || icon.name.toLowerCase().includes(q) || icon.id.includes(q));
      }),
    [search, category]
  );

  // Debounced internet search through Iconify's public index.
  useEffect(() => {
    if (mode !== "online") return;
    const q = search.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`${ICONIFY}/search?query=${encodeURIComponent(q)}&limit=24`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = (await res.json()) as { icons?: string[] };
        setOnline((data.icons ?? []).map((id) => ({ id })));
        setStatus("idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setOnline([]);
        setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, mode]);

  if (!isOpen) return null;
  const visibleOnline = search.trim().length >= 2 ? online : [];

  const pickOnline = async (id: string) => {
    const [prefix, name] = id.split(":");
    setBusyId(id);
    try {
      const res = await fetch(`${ICONIFY}/${prefix}/${name}.svg`);
      if (!res.ok) throw new Error("Icon fetch failed");
      const svg = await res.text();
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const root = doc.documentElement;
      const viewBox = root.getAttribute("viewBox") || "0 0 24 24";
      onSelectOnline(name, id, root.innerHTML, viewBox);
      onClose();
    } catch {
      setStatus("error");
      setErrorText("Couldn't load that icon. The icon service may be busy; try again in a moment.");
    } finally {
      setBusyId(null);
    }
  };

  const panel = "bg-[#18181b] border-neutral-800 text-white";
  const subtle = "text-neutral-400";
  const cell = "border-neutral-800 hover:bg-neutral-800/80";
  const input = "bg-neutral-800 border-neutral-700 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Insert icon"
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border border-neutral-800 flex flex-col overflow-hidden ${panel}`}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold">Insert icon</h2>
          </div>
          <div className="flex items-center rounded-lg p-0.5 bg-neutral-500/10 text-xs font-medium">
            <button
              onClick={() => setMode("bundled")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${mode === "bundled" ? "bg-blue-600 text-white" : subtle}`}
            >
              <Library className="w-3.5 h-3.5" /> Built-in
            </button>
            <button
              onClick={() => setMode("online")}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${mode === "online" ? "bg-blue-600 text-white" : subtle}`}
            >
              <Globe className="w-3.5 h-3.5" /> Search online
            </button>
          </div>
          <button onClick={onClose} aria-label="Close" className={`p-1.5 rounded-lg ${subtle} hover:text-current`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b">
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${subtle}`} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === "online" ? "Search 200,000+ icons: aws lambda, kubernetes, postgres…" : "Search built-in icons…"}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${input}`}
            />
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
                    onClose();
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
              {status === "loading" && (
                <div className={`flex items-center justify-center gap-2 py-10 text-sm ${subtle}`}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                </div>
              )}
              {status === "error" && (
                <p className="text-sm text-center py-10 text-rose-500">{errorText}</p>
              )}
              {status === "idle" && search.trim().length >= 2 && visibleOnline.length === 0 && (
                <p className={`text-sm text-center py-10 ${subtle}`}>No icons found for &ldquo;{search.trim()}&rdquo;.</p>
              )}
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
    </div>
  );
}
