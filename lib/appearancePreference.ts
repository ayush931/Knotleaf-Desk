'use client';
import { useSyncExternalStore } from 'react';
const KEY = 'knotleaf.appearance.hidden';
const listeners = new Set<() => void>();
let volatileHidden: boolean | undefined;
function snapshot() {
  if (volatileHidden !== undefined) return volatileHidden;
  try { return window.localStorage.getItem(KEY) === 'true'; } catch { return false; }
}
function changed() { for (const notify of listeners) notify(); }
function storageChanged(event: StorageEvent) { if (event.key === KEY || event.key === null) { volatileHidden = undefined; changed(); } }
function subscribe(notify: () => void) {
  if (!listeners.size) window.addEventListener('storage', storageChanged);
  listeners.add(notify);
  return () => { listeners.delete(notify); if (!listeners.size) window.removeEventListener('storage', storageChanged); };
}
export function setAppearanceHidden(hidden: boolean) {
  try { window.localStorage.setItem(KEY, String(hidden)); volatileHidden = undefined; } catch { volatileHidden = hidden; }
  changed();
}
/** Explicit hide/show survives new selections, tool changes, remounts and reloads. */
export function useAppearanceHidden() { return useSyncExternalStore(subscribe, snapshot, () => false); }
