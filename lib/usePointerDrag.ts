"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { capturePointer, isContextPointer, releasePointer } from "./pointerInput";

/** One primary-pointer resize, including release outside the handle or failed capture. */
export function usePointerDrag(onMove: (event: PointerEvent) => void) {
  const move = useRef(onMove);
  const active = useRef<{ id: number; target: HTMLElement } | null>(null);
  useLayoutEffect(() => { move.current = onMove; }, [onMove]);
  useEffect(() => {
    const stop = () => {
      const pointer = active.current;
      active.current = null;
      if (pointer) releasePointer(pointer.target, pointer.id);
    };
    const update = (event: PointerEvent) => {
      if (event.pointerId === active.current?.id) {
        if (event.pointerType === "mouse" && event.buttons === 0) { stop(); return; }
        event.preventDefault(); move.current(event);
      }
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== active.current?.id) return;
      move.current(event); stop();
    };
    const cancel = (event: PointerEvent) => { if (event.pointerId === active.current?.id) stop(); };
    window.addEventListener("pointermove", update, { capture: true, passive: false });
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", stop);
    return () => {
      stop();
      window.removeEventListener("pointermove", update, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", stop);
    };
  }, []);
  return (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.isPrimary === false || isContextPointer(event) || active.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    active.current = { id: event.pointerId, target: event.currentTarget };
    capturePointer(event.currentTarget, event.pointerId);
  };
}
