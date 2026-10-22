"use client";
import { useEffect, useRef, useState } from "react";
import { Expand, Maximize, X } from "lucide-react";

export function CallMediaVideo({
  stream,
  label,
  className = "aspect-video w-full rounded-lg bg-neutral-950 object-contain",
}: {
  stream: MediaStream | null;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [blocked, setBlocked] = useState(false),
    [ready, setReady] = useState(false),
    tracks = stream?.getTracks().length || 0;
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let active = true;
    const play = () => {
      if (stream?.getVideoTracks().length)
        void video
          .play()
          .then(() => {
            if (active) setBlocked(false);
          })
          .catch(() => {
            if (active) setBlocked(true);
          });
    };
    setReady(false);
    video.srcObject = stream;
    play();
    stream?.addEventListener("addtrack", play);
    return () => {
      active = false;
      stream?.removeEventListener("addtrack", play);
      video.srcObject = null;
    };
  }, [stream, tracks]);
  return (
    <div
      className={
        className.includes("h-full") ? "relative h-full w-full" : "relative"
      }
    >
      <video
        ref={ref}
        aria-label={label}
        autoPlay
        onLoadedData={() => setReady(true)}
        onPlaying={() => setReady(true)}
        playsInline
        muted
        className={className}
      />
      {!ready && !blocked && (
        <p
          role="status"
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-neutral-400"
        >
          Waiting for video…
        </p>
      )}
      {blocked && (
        <button
          type="button"
          className="note-tool absolute inset-x-2 bottom-2 bg-neutral-900 text-xs"
          onClick={() =>
            void ref.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => {})
          }
        >
          Play {label}
        </button>
      )}
    </div>
  );
}

export function CallScreenView({
  stream,
  label,
  detail,
}: {
  stream: MediaStream;
  label: string;
  detail: string;
}) {
  const [expanded, setExpanded] = useState(false),
    [size, setSize] = useState("fit"),
    [error, setError] = useState(""),
    [fullscreen, setFullscreen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    surface = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (expanded && !element?.open) element?.showModal();
    if (!expanded && element?.open) element.close();
  }, [expanded]);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === surface.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const close = () => {
    if (document.fullscreenElement === surface.current)
      void document.exitFullscreen().catch(() => {});
    setExpanded(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const full = async () => {
    setError("");
    try {
      if (document.fullscreenElement === surface.current)
        await document.exitFullscreen();
      else if (surface.current?.requestFullscreen)
        await surface.current.requestFullscreen();
      else
        setError(
          "Full screen is unavailable in this browser. The expanded view is still available.",
        );
    } catch {
      setError(
        "Full screen could not open. Use the expanded view or try again.",
      );
    }
  };
  return (
    <figure className="min-w-0">
      <CallMediaVideo stream={stream} label={label} />
      <figcaption className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-400">
        <span className="min-w-0 break-words">{detail}</span>
        <button
          ref={trigger}
          type="button"
          className="note-tool inline-flex shrink-0 items-center gap-1"
          aria-label={`Enlarge ${label}`}
          onClick={() => setExpanded(true)}
        >
          <Expand className="mr-1 h-3.5 w-3.5" />
          Enlarge
        </button>
      </figcaption>
      <dialog
        ref={dialog}
        data-call-screen
        aria-label={label}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setExpanded(false)}
        className="fixed inset-0 m-auto h-[94dvh] max-h-none w-[96vw] max-w-none flex-col rounded-xl border border-neutral-700 bg-neutral-900 p-0 text-white shadow-lg backdrop:bg-black/70 open:flex"
      >
        <div
          ref={surface}
          className="flex h-full min-h-0 w-full flex-col bg-neutral-900"
        >
          <header className="flex flex-wrap items-center gap-2 border-b border-neutral-700 p-3">
            <h3 className="min-w-0 basis-full break-words text-sm sm:mr-auto sm:basis-auto">
              {label}
            </h3>
            <label className="mr-auto text-xs sm:mr-0">
              View{" "}
              <select
                aria-label="Screen viewing size"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                className="rounded border border-neutral-700 bg-neutral-950 p-1.5"
              >
                <option value="fit">Fit to window</option>
                <option value="actual">Actual size · scroll</option>
              </select>
            </label>
            <button
              type="button"
              className="note-tool inline-flex items-center gap-1 text-xs"
              onClick={() => void full()}
            >
              <Maximize className="mr-1 h-4 w-4" />
              {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
            <button
              type="button"
              className="note-tool"
              aria-label="Close enlarged screen"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          {error && (
            <p role="alert" className="px-3 py-2 text-xs text-amber-300">
              {error}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-auto bg-neutral-950">
            {expanded && (
              <CallMediaVideo
                stream={stream}
                label={`${label} enlarged`}
                className={
                  size === "fit" ? "h-full w-full object-contain" : "max-w-none"
                }
              />
            )}
          </div>
        </div>
      </dialog>
    </figure>
  );
}
