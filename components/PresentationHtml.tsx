"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { isolatedDocument } from "@/lib/presentations/htmlDocument";
import {
  PresentationAnnotations,
  type AnnotationBridge,
} from "./PresentationAnnotations";
import type { TextMark, TextAnchor } from "@/lib/presentations/useAnnotations";
/** Keep the prior iframe on screen until its replacement finishes loading. */
export function PresentationHtml({
  source,
  scripts = false,
  annotationKey,
}: {
  source: string;
  scripts?: boolean;
  annotationKey?: string;
}) {
  const [bridgeToken] = useState(() => crypto.randomUUID());
  const frameRefs = useRef<(HTMLIFrameElement | null)[]>([]),
    listeners = useRef(
      new Set<
        (value: { kind: string; anchor?: TextAnchor; mark?: TextMark }) => void
      >(),
    ),
    storedMarks = useRef<TextMark[]>([]);
  const bridge = useMemo<AnnotationBridge>(
    () => ({
      subscribe: (callback) => {
        listeners.current.add(callback);
        return () => {
          listeners.current.delete(callback);
        };
      },
      setMarks: (marks) => {
        storedMarks.current = marks;
        for (const frame of frameRefs.current)
          frame?.contentWindow?.postMessage(
            { type: "knotleaf-marks", token: bridgeToken, marks },
            "*",
          );
      },
      clearSelection: () => {
        for (const frame of frameRefs.current)
          frame?.contentWindow?.postMessage(
            { type: "knotleaf-clear-selection", token: bridgeToken },
            "*",
          );
      },
    }),
    [bridgeToken],
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        !frameRefs.current.some(
          (frame) => frame?.contentWindow === event.source,
        ) ||
        event.data?.token !== bridgeToken
      )
        return;
      if (event.data.type === "knotleaf-annotation-ready")
        event.source?.postMessage(
          {
            type: "knotleaf-marks",
            token: bridgeToken,
            marks: storedMarks.current,
          },
          { targetOrigin: "*" },
        );
      else if (event.data.type === "knotleaf-annotation" && event.data.value)
        listeners.current.forEach((callback) => callback(event.data.value));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [bridgeToken]);
  useEffect(() => {
    const print = (event: Event) => {
      if ((event as CustomEvent).detail?.source === source)
        frameRefs.current[current.current]?.contentWindow?.postMessage(
          { type: "knotleaf-print", token: bridgeToken },
          "*",
        );
    };
    window.addEventListener("knotleaf-print-html", print);
    return () => window.removeEventListener("knotleaf-print-html", print);
  }, [source, bridgeToken]);
  const [frames, setFrames] = useState(() => [
      {
        source,
        scripts,
        generation: 0,
        html: isolatedDocument(source, scripts, bridgeToken),
      },
      { source: "", scripts: false, generation: -1, html: "" },
    ]),
    [visible, setVisible] = useState(0),
    [ready, setReady] = useState(false);
  const current = useRef(0),
    generation = useRef(0);
  const installed = useRef({ source, scripts });
  useEffect(() => {
    if (
      installed.current.source === source &&
      installed.current.scripts === scripts
    )
      return;
    const timer = setTimeout(() => {
      installed.current = { source, scripts };
      const next = 1 - current.current,
        token = ++generation.current;
      setFrames((value) =>
        value.map((frame, index) =>
          index === next
            ? {
                source,
                scripts,
                generation: token,
                html: isolatedDocument(source, scripts, bridgeToken),
              }
            : frame,
        ),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [source, scripts, bridgeToken]);
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-white">
      {frames.map((frame, index) => (
        <iframe
          key={index}
          ref={(element) => {
            frameRefs.current[index] = element;
          }}
          title={
            index === visible
              ? "HTML document preview"
              : "Preparing HTML document preview"
          }
          aria-hidden={index !== visible}
          tabIndex={index === visible ? 0 : -1}
          sandbox="allow-scripts allow-presentation allow-modals"
          referrerPolicy="no-referrer"
          srcDoc={frame.html}
          onLoad={() => {
            if (frame.generation === generation.current) {
              current.current = index;
              setVisible(index);
              setReady(true);
            }
          }}
          className={`absolute inset-0 h-full w-full border-0 ${index === visible ? "visible" : "invisible pointer-events-none"}`}
        />
      ))}
      {annotationKey && (
        <PresentationAnnotations
          annotationKey={annotationKey}
          bridge={bridge}
        />
      )}
      {!ready && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-sm text-neutral-400"
        >
          Preparing document…
        </p>
      )}
    </div>
  );
}
