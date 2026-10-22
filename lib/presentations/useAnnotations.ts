"use client";
import { useEffect, useState } from "react";
export interface TextMark {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  comment: string;
}
export interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  x?: number;
  y?: number;
}
const prefix = "knotleaf.annotations.session:";
const memory = new Map<string, TextMark[]>();
function read(key: string): TextMark[] {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + key) || "[]");
    return Array.isArray(value)
      ? value.filter(
          (mark) =>
            typeof mark?.id === "string" &&
            typeof mark.quote === "string" &&
            typeof mark.prefix === "string" &&
            typeof mark.suffix === "string" &&
            typeof mark.comment === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function useAnnotations(key: string | undefined) {
  const [marks, setMarks] = useState<TextMark[]>(() => (key ? read(key) : []));
  useEffect(() => {
    if (!key) return;
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("knotleaf.annotations.session.v1");
    const refresh = () => setMarks(read(key));
    const change = (event: Event) => {
      if ((event as CustomEvent).detail === key) refresh();
    };
    const timer = setTimeout(refresh, 0);
    window.addEventListener("knotleaf-annotations", change);
    if (channel) {
      channel.onmessage = (event) => {
        const value = event.data;
        if (value?.key !== key) return;
        if (value.kind === "request")
          channel.postMessage({ key, kind: "marks", marks: read(key) });
        else if (value.kind === "marks" && Array.isArray(value.marks)) {
          memory.set(key, value.marks);
          try {
            sessionStorage.setItem(prefix + key, JSON.stringify(value.marks));
            refresh();
          } catch {
            setMarks(value.marks);
          }
        }
      };
      channel.postMessage({ key, kind: "request" });
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("knotleaf-annotations", change);
      channel?.close();
    };
  }, [key]);
  const save = (next: TextMark[]) => {
    setMarks(next);
    if (!key) return;
    memory.set(key, next);
    try {
      sessionStorage.setItem(prefix + key, JSON.stringify(next));
    } catch {
      /* The current tab keeps the marks in memory when session storage is unavailable. */
    }
    window.dispatchEvent(
      new CustomEvent("knotleaf-annotations", { detail: key }),
    );
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("knotleaf.annotations.session.v1");
      channel.postMessage({ key, kind: "marks", marks: next });
      channel.close();
    }
  };
  return {
    marks,
    add: (anchor: TextAnchor, comment: string) =>
      save([
        ...marks,
        {
          id: crypto.randomUUID(),
          quote: anchor.quote,
          prefix: anchor.prefix,
          suffix: anchor.suffix,
          comment,
        },
      ]),
    edit: (id: string, comment: string) =>
      save(marks.map((mark) => (mark.id === id ? { ...mark, comment } : mark))),
    remove: (id: string) => save(marks.filter((mark) => mark.id !== id)),
  };
}
