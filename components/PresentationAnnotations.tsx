"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { X, Highlighter, MessageSquare, Trash2 } from "lucide-react";
import { installTextAnnotations } from "@/lib/presentations/annotations.mjs";
import {
  useAnnotations,
  type TextAnchor,
  type TextMark,
} from "@/lib/presentations/useAnnotations";
export interface AnnotationBridge {
  subscribe: (
    callback: (value: {
      kind: string;
      anchor?: TextAnchor;
      mark?: TextMark;
    }) => void,
  ) => () => void;
  setMarks: (marks: TextMark[]) => void;
  clearSelection: () => void;
}
export function PresentationAnnotations({
  annotationKey,
  rootRef,
  revision,
  bridge,
}: {
  annotationKey: string;
  rootRef?: RefObject<HTMLElement | null>;
  revision?: string;
  bridge?: AnnotationBridge;
}) {
  const { marks, add, edit, remove } = useAnnotations(annotationKey),
    [anchor, setAnchor] = useState<TextAnchor | null>(null),
    [editing, setEditing] = useState<TextMark | null>(null),
    [comment, setComment] = useState(""),
    [commenting, setCommenting] = useState(false);
  const runtime = useRef<ReturnType<typeof installTextAnnotations> | null>(
    null,
  );
  useEffect(() => {
    const notify = (value: {
      kind: string;
      anchor?: TextAnchor;
      mark?: TextMark;
    }) => {
      if (value.kind === "selection" && value.anchor) {
        setAnchor(value.anchor);
        setEditing(null);
        setComment("");
        setCommenting(false);
      } else if (value.kind === "edit" && value.mark) {
        setEditing(value.mark);
        setAnchor(null);
        setComment(value.mark.comment);
        setCommenting(true);
      }
    };
    if (bridge) return bridge.subscribe(notify);
    const element = rootRef?.current;
    if (!element) return;
    const current = installTextAnnotations(element, notify);
    runtime.current = current;
    return () => {
      current.destroy();
      if (runtime.current === current) runtime.current = null;
    };
  }, [rootRef, revision, bridge]);
  useEffect(() => {
    runtime.current?.setMarks(marks);
    bridge?.setMarks(marks);
  }, [marks, rootRef, revision, bridge]);
  const close = () => {
    setAnchor(null);
    setEditing(null);
    setCommenting(false);
    runtime.current?.clearSelection();
    bridge?.clearSelection();
  };
  if (!anchor && !editing) return null;
  return (
    <aside
      aria-label="Text highlight and comment"
      className="absolute bottom-3 left-1/2 z-30 w-[min(360px,calc(100%-16px))] -translate-x-1/2 rounded-lg border border-neutral-600 bg-neutral-900 p-2 text-xs text-neutral-200 shadow-lg"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
    >
      <div className="flex items-center gap-1">
        {anchor && !commenting && (
          <>
            <button
              className="inline-flex items-center gap-1 rounded px-2 py-1.5 hover:bg-neutral-800"
              onClick={() => {
                add(anchor, "");
                close();
              }}
            >
              <Highlighter size={13} />
              Highlight
            </button>
            <button
              className="inline-flex items-center gap-1 rounded px-2 py-1.5 hover:bg-neutral-800"
              onClick={() => setCommenting(true)}
            >
              <MessageSquare size={13} />
              Comment
            </button>
          </>
        )}
        {editing && (
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-red-300 hover:bg-neutral-800"
            onClick={() => {
              remove(editing.id);
              close();
            }}
          >
            <Trash2 size={13} />
            Remove highlight
          </button>
        )}
        <button
          className="ml-auto rounded p-1.5 hover:bg-neutral-800"
          aria-label="Close text annotation"
          onClick={close}
        >
          <X size={13} />
        </button>
      </div>
      {commenting && (
        <form
          noValidate
          className="mt-1 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (editing) edit(editing.id, comment);
            else if (anchor) add(anchor, comment);
            close();
          }}
        >
          <input
            autoFocus
            aria-label="Highlight comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add a private session comment…"
            className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 outline-none focus:border-blue-500"
          />
          <button type="submit" className="rounded bg-blue-600 px-3 text-white">
            Save
          </button>
        </form>
      )}
      <p className="mt-1 px-1 text-[9px] text-neutral-500">
        Session only · excluded from exports
      </p>
    </aside>
  );
}
