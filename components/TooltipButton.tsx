"use client";

import { useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";

/** Canvas tool labels stay visible outside the horizontally scrolling toolbar. */
export function TooltipButton({ title, children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const tip = tooltip.current?.getBoundingClientRect();
      if (!rect || !tip) return;
      setPosition({
        left: Math.max(8, Math.min(rect.left + rect.width / 2 - tip.width / 2, window.innerWidth - tip.width - 8)),
        top: rect.bottom + tip.height + 8 <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - tip.height - 6),
      });
    };
    const dismiss = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    place();
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <span ref={anchor} className="inline-flex shrink-0"
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => { if (!anchor.current?.contains(document.activeElement)) setOpen(false); }}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onPointerDown={() => setOpen(false)}>
    <button type="button" {...props} onClick={onClick} aria-describedby={open && title ? [props["aria-describedby"], id].filter(Boolean).join(" ") : props["aria-describedby"]}>{children}</button>
    {open && title && createPortal(<span ref={tooltip} id={id} role="tooltip"
      className="pointer-events-none fixed z-50 w-max max-w-[calc(100vw-1rem)] rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 shadow-sm"
      style={position}>{title}</span>, document.body)}
  </span>;
}
