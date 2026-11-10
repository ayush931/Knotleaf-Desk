import type { CanvasElement, Point } from './types';
import { getElementBounds, unionBounds } from './renderer';
export type Arrangement = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical';
/** A shape and its attached text are one layout target, even if both are selected. */
export function arrangementTargets(selection: CanvasElement[]) {
  const ids = new Set(selection.map(el => el.id));
  return selection.filter(el => !['arrow', 'line', 'pencil'].includes(el.type) && !(el.type === 'text' && el.containerId && ids.has(el.containerId)));
}
export function arrangementDeltas(selection: CanvasElement[], mode: Arrangement) {
  const targets = arrangementTargets(selection).map(el => ({ el, bounds: getElementBounds(el) }));
  const changes = new Map<string, Point>();
  const distribute = mode === 'horizontal' || mode === 'vertical';
  if (targets.length < (distribute ? 3 : 2)) return changes;
  const bounds = unionBounds(targets.map(t => t.bounds))!;
  const horizontal = ['left', 'center', 'right', 'horizontal'].includes(mode);
  const min = horizontal ? 'minX' : 'minY', max = horizontal ? 'maxX' : 'maxY';
  const add = (id: string, delta: number) => { if (Math.abs(delta) > 1e-7) changes.set(id, horizontal ? { x: delta, y: 0 } : { x: 0, y: delta }); };
  if (distribute) {
    targets.sort((a, b) => a.bounds[min] - b.bounds[min]);
    // Preserve the first and last objects, including their visual edges.
    const first = targets[0].bounds[min], last = targets[targets.length - 1].bounds[max];
    const total = targets.reduce((sum, t) => sum + t.bounds[max] - t.bounds[min], 0);
    const gap = (last - first - total) / (targets.length - 1);
    let at = first;
    targets.forEach((t, index) => { if (index > 0 && index < targets.length - 1) add(t.el.id, at - t.bounds[min]); at += t.bounds[max] - t.bounds[min] + gap; });
  } else {
    const center = mode === 'center' || mode === 'middle';
    const end = mode === 'right' || mode === 'bottom';
    const at = center ? (bounds[min] + bounds[max]) / 2 : bounds[end ? max : min];
    for (const t of targets) add(t.el.id, at - (center ? (t.bounds[min] + t.bounds[max]) / 2 : t.bounds[end ? max : min]));
  }
  return changes;
}
