"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";

export function RefreshWebApp({ onBeforeRefresh, recording = false }: { onBeforeRefresh: () => void | Promise<void>; recording?: boolean }) {
  const refreshing = useRef(false);
  const beforeRefresh = useRef(onBeforeRefresh);
  const activeRecording = useRef(recording);
  useLayoutEffect(() => { beforeRefresh.current = onBeforeRefresh; activeRecording.current = recording; }, [onBeforeRefresh, recording]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const refresh = async () => {
    if (refreshing.current || recording) return;
    refreshing.current = true; setBusy(true); setError("");
    try {
      // Verify that a fresh document is reachable before leaving the working app.
      const response = await fetch(window.location.href, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15000) })
        .catch(() => { throw new Error("The latest app could not be reached. Check your connection and try again."); });
      if (!response.ok) throw new Error("The latest app could not be loaded. Check your connection and try again.");
      await beforeRefresh.current();
      if (activeRecording.current) throw new Error("Stop and save your recording before refreshing.");
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Refresh failed. Check your connection and try again.");
      refreshing.current = false; setBusy(false);
    }
  };
  return <>
    <button type="button" aria-label="Refresh app" aria-busy={busy} disabled={busy || recording}
      title={recording ? "Stop and save your recording before refreshing" : "Refresh app to load the latest update · reloads this window"}
      onClick={() => void refresh()}
      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500 active:bg-neutral-700 disabled:cursor-default disabled:opacity-40">
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /><span className="hidden text-xs xl:inline">Refresh</span>
    </button>
    {error && typeof document !== "undefined" && createPortal(<div role="alert" className="fixed right-3 top-14 z-[80] flex w-[min(360px,calc(100vw-24px))] items-start gap-2 rounded-xl border border-amber-500/30 bg-neutral-900 p-3 text-xs text-neutral-200 shadow-lg"><p className="flex-1">{error}</p><button type="button" aria-label="Dismiss refresh error" onClick={() => setError("")} className="note-tool"><X className="h-4 w-4" /></button></div>, document.body)}
  </>;
}
