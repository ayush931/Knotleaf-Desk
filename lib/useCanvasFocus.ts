'use client';
import { useCallback, useEffect, useState } from 'react';
/** Focus view is session-only and never changes the saved canvas/notes layout. */
export function useCanvasFocus(beforeToggle: () => void, disabled = false) {
  const [active, setActive] = useState(false);
  const toggle = useCallback(() => { if (!disabled) { beforeToggle(); setActive(value => !value); } }, [beforeToggle, disabled]);
  const exit = useCallback(() => { beforeToggle(); setActive(false); }, [beforeToggle]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (disabled || event.repeat || event.isComposing || document.querySelector('dialog[open]') || target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); toggle(); }
      else if (active && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); exit(); }
    };
    window.addEventListener('keydown', keydown, true); return () => window.removeEventListener('keydown', keydown, true);
  }, [active, disabled, toggle, exit]);
  return { active, toggle, exit };
}
