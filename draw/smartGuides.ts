import type { Bounds } from './renderer';
export interface Guide { x1: number; y1: number; x2: number; y2: number; label?: string }
export interface GuideResult { dx: number; dy: number; guides: Guide[] }
const centerX = (b: Bounds) => (b.minX + b.maxX) / 2;
const centerY = (b: Bounds) => (b.minY + b.maxY) / 2;
/** Screen-constant alignment snapping and nearby spacing rulers; never persisted. */
export function smartGuides(moving: Bounds, others: Bounds[], zoom = 1, snap = true): GuideResult {
  const tolerance = 6 / zoom;
  let dx = 0, dy = 0;
  const alignments: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const source = axis === 'x' ? [moving.minX, centerX(moving), moving.maxX] : [moving.minY, centerY(moving), moving.maxY];
    let best: { distance: number; delta: number } | undefined;
    for (const other of others) {
      const separation = axis === 'x' ? Math.max(0, other.minY - moving.maxY, moving.minY - other.maxY) : Math.max(0, other.minX - moving.maxX, moving.minX - other.maxX);
      if (separation > 400 / zoom) continue;
      const targets = axis === 'x' ? [other.minX, centerX(other), other.maxX] : [other.minY, centerY(other), other.maxY];
      for (const a of source) for (const b of targets) {
        const delta = b - a, distance = Math.abs(delta);
        if (distance <= tolerance && (!best || distance < best.distance)) best = { distance, delta };
      }
    }
    if (!best) continue;
    if (snap) { if (axis === 'x') dx = best.delta; else dy = best.delta; }
  }
  const b = { minX: moving.minX + dx, maxX: moving.maxX + dx, minY: moving.minY + dy, maxY: moving.maxY + dy };
  // Snapping chooses one delta per axis; presentation includes every actual match
  // after BOTH deltas, so equal-size shapes show their top, center and bottom.
  for (const axis of ['x', 'y'] as const) {
    const source = axis === 'x' ? [b.minX, centerX(b), b.maxX] : [b.minY, centerY(b), b.maxY];
    for (const value of new Set(source)) {
      const matches = others.filter(other => {
        const separation = axis === 'x' ? Math.max(0, other.minY - b.maxY, b.minY - other.maxY) : Math.max(0, other.minX - b.maxX, b.minX - other.maxX);
        if (separation > 400 / zoom) return false;
        const targets = axis === 'x' ? [other.minX, centerX(other), other.maxX] : [other.minY, centerY(other), other.maxY];
        return targets.some(target => Math.abs(target - value) <= (snap ? 1e-7 : 0.5 / zoom));
      });
      if (!matches.length) continue;
      let min = axis === 'x' ? b.minY : b.minX;
      let max = axis === 'x' ? b.maxY : b.maxX;
      for (const other of matches) {
        min = Math.min(min, axis === 'x' ? other.minY : other.minX);
        max = Math.max(max, axis === 'x' ? other.maxY : other.maxX);
      }
      alignments.push(axis === 'x'
        ? { x1: value, y1: min - 12 / zoom, x2: value, y2: max + 12 / zoom }
        : { x1: min - 12 / zoom, y1: value, x2: max + 12 / zoom, y2: value });
    }
  }
  const candidates: { gap: number; guide: Guide }[][] = [[], [], [], []];
  for (const other of others) {
    const verticalOverlap = Math.min(b.maxY, other.maxY) - Math.max(b.minY, other.minY);
    const horizontalOverlap = Math.min(b.maxX, other.maxX) - Math.max(b.minX, other.minX);
    if (verticalOverlap > 0) {
      const y = (Math.max(b.minY, other.minY) + Math.min(b.maxY, other.maxY)) / 2;
      if (other.maxX <= b.minX) candidates[0].push({ gap: b.minX - other.maxX, guide: { x1: other.maxX, y1: y, x2: b.minX, y2: y } });
      if (other.minX >= b.maxX) candidates[1].push({ gap: other.minX - b.maxX, guide: { x1: b.maxX, y1: y, x2: other.minX, y2: y } });
    }
    if (horizontalOverlap > 0) {
      const x = (Math.max(b.minX, other.minX) + Math.min(b.maxX, other.maxX)) / 2;
      if (other.maxY <= b.minY) candidates[2].push({ gap: b.minY - other.maxY, guide: { x1: x, y1: other.maxY, x2: x, y2: b.minY } });
      if (other.minY >= b.maxY) candidates[3].push({ gap: other.minY - b.maxY, guide: { x1: x, y1: b.maxY, x2: x, y2: other.minY } });
    }
  }
  const nearest = candidates.map(direction => direction.sort((a, b) => a.gap - b.gap)[0]);
  for (let index = 0; index < nearest.length; index++) {
    const closest = nearest[index], opposite = nearest[index ^ 1];
    const equal = closest && opposite && Math.abs(closest.gap - opposite.gap) <= 0.5 / zoom;
    if (closest && closest.gap > 1 / zoom && closest.gap <= 240 / zoom) alignments.push({ ...closest.guide, label: `${equal ? '= ' : ''}${Math.round(closest.gap * 10) / 10} px` });
  }
  return { dx, dy, guides: alignments };
}

export function drawSmartGuides(ctx: CanvasRenderingContext2D, guides: Guide[], zoom: number) {
  ctx.save(); ctx.strokeStyle = '#f87171'; ctx.fillStyle = '#f87171'; ctx.lineWidth = 1 / zoom;
  ctx.font = `${11 / zoom}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const guide of guides) {
    ctx.setLineDash(guide.label ? [] : [4 / zoom, 3 / zoom]);
    ctx.beginPath(); ctx.moveTo(guide.x1, guide.y1); ctx.lineTo(guide.x2, guide.y2); ctx.stroke();
    if (!guide.label) continue;
    const horizontal = guide.y1 === guide.y2, tick = 3 / zoom;
    ctx.beginPath();
    for (const [x, y] of [[guide.x1, guide.y1], [guide.x2, guide.y2]]) { ctx.moveTo(x - (horizontal ? 0 : tick), y - (horizontal ? tick : 0)); ctx.lineTo(x + (horizontal ? 0 : tick), y + (horizontal ? tick : 0)); }
    ctx.stroke();
    const x = (guide.x1 + guide.x2) / 2, y = (guide.y1 + guide.y2) / 2;
    const width = ctx.measureText(guide.label).width + 8 / zoom;
    ctx.fillStyle = '#121212'; ctx.fillRect(x - width / 2, y - 8 / zoom, width, 16 / zoom);
    ctx.fillStyle = '#f87171'; ctx.fillText(guide.label, x, y);
  }
  ctx.restore();
}
