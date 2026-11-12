"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { capturePointer, isContextPointer, releasePointer } from "./pointerInput";
import { loadPreferences, savePreferences } from "./preferences";

export interface AppearancePosition { x: number; y: number }
interface Size { width: number; height: number }
const BUTTON_WIDTH = 132, BUTTON_HEIGHT = 36, EDGE = 8;

function fit(point: AppearancePosition, size: Size, top: number, width = BUTTON_WIDTH, height = BUTTON_HEIGHT, bottom = EDGE): AppearancePosition {
 const maxX = size.width > 0 ? Math.max(EDGE, size.width - width - EDGE) : Infinity;
 const maxY = size.height > 0 ? Math.max(EDGE, size.height - height - bottom) : Infinity;
 return { x: Math.max(EDGE, Math.min(maxX, point.x)), y: Math.max(Math.min(top, maxY), Math.min(maxY, point.y)) };
}

/** A click opens Appearance; moving at least four pixels repositions its saved trigger. */
export function useAppearancePosition(size: Size, top: number, preserveTextFocus: boolean) {
 const [position, setPosition] = useState<AppearancePosition | null>(() => loadPreferences().appearancePosition);
 const [dragging, setDragging] = useState(false);
 const active = useRef<{ id: number; target: HTMLElement; x: number; y: number; origin: AppearancePosition; previous: AppearancePosition | null; moved: boolean } | null>(null);
 const suppressClick = useRef(false);
 const point = fit(position ?? { x: EDGE, y: top }, size, top);
 const panel = fit(point, size, top, 288, 200, 64);

 useEffect(() => {
  const stop = (cancel: boolean, event?: PointerEvent) => {
   const drag = active.current;
   if (!drag || event && event.pointerId !== drag.id) return;
   active.current = null;
   releasePointer(drag.target, drag.id);
   setDragging(false);
   if (cancel) { setPosition(drag.previous); suppressClick.current = drag.moved; }
   else if (drag.moved && event) {
    const next = fit({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y }, size, top);
    setPosition(next); savePreferences({ appearancePosition: next }); suppressClick.current = true;
   }
  };
  const move = (event: PointerEvent) => {
   const drag = active.current;
   if (!drag || drag.id !== event.pointerId) return;
   if (event.pointerType === "mouse" && event.buttons === 0) { stop(true, event); return; }
   const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
   if (!drag.moved && Math.hypot(dx, dy) < 4) return;
   drag.moved = true; setDragging(true);
   event.preventDefault(); event.stopPropagation();
   setPosition(fit({ x: drag.origin.x + dx, y: drag.origin.y + dy }, size, top));
  };
  const finish = (event: PointerEvent) => stop(false, event);
  const cancel = (event: PointerEvent) => stop(true, event);
  const blur = () => stop(true);
  const escape = (event: KeyboardEvent) => {
   if (event.key === "Escape" && active.current) { event.preventDefault(); event.stopPropagation(); stop(true); }
  };
  window.addEventListener("pointermove", move, { capture: true, passive: false });
  window.addEventListener("pointerup", finish, true);
  window.addEventListener("pointercancel", cancel, true);
  window.addEventListener("blur", blur);
  window.addEventListener("keydown", escape, true);
  return () => {
   const drag = active.current;
   active.current = null;
   if (drag) { releasePointer(drag.target, drag.id); suppressClick.current = drag.moved; setDragging(false); setPosition(drag.previous); }
   window.removeEventListener("pointermove", move, true);
   window.removeEventListener("pointerup", finish, true);
   window.removeEventListener("pointercancel", cancel, true);
   window.removeEventListener("blur", blur);
   window.removeEventListener("keydown", escape, true);
  };
 }, [size.width, size.height, top]); // eslint-disable-line react-hooks/exhaustive-deps

 return {
  point, panel, dragging,
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
   if (event.button !== 0 || event.isPrimary === false || isContextPointer(event) || active.current) return;
   event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
   if (!preserveTextFocus) event.currentTarget.focus({ preventScroll: true });
   active.current = { id: event.pointerId, target: event.currentTarget, x: event.clientX, y: event.clientY, origin: point, previous: position, moved: false };
   capturePointer(event.currentTarget, event.pointerId);
  },
  onClick: (event: ReactMouseEvent<HTMLButtonElement>, open: () => void) => {
   if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); return; }
   suppressClick.current = false; open();
  },
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
   if (!event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
   if (event.key === "Home") { event.preventDefault(); event.stopPropagation(); setPosition(null); savePreferences({ appearancePosition: null }); return; }
   const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[event.key];
   if (!direction) return;
   event.preventDefault(); event.stopPropagation();
   const step = event.shiftKey ? 1 : 10;
   const next = fit({ x: point.x + direction[0] * step, y: point.y + direction[1] * step }, size, top);
   setPosition(next); savePreferences({ appearancePosition: next });
  },
 };
}
