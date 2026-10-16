import type { AnchorPosition, Point } from "./types";

export interface Obstacle { minX: number; minY: number; maxX: number; maxY: number }
export const PORT_NORMAL: Record<AnchorPosition, Point> = {
  top: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};

/** Routes between outward-facing ports, keeping the middle legs outside bound shapes. */
export function routeConnector(start: Point, end: Point, startPort?: AnchorPosition, endPort?: AnchorPosition, obstacles: Obstacle[] = [], lane?: { x?: number; y?: number }): Point[] {
  const dx = end.x - start.x, dy = end.y - start.y;
  const inferred: AnchorPosition = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
  const opposite: Record<AnchorPosition, AnchorPosition> = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const sn = PORT_NORMAL[startPort ?? inferred], en = PORT_NORMAL[endPort ?? opposite[inferred]];
  const gap = 28;
  const a = { x: start.x + sn.x * gap, y: start.y + sn.y * gap };
  const b = { x: end.x + en.x * gap, y: end.y + en.y * gap };
  // Overlapping shapes may swallow a port. Do not trap the search inside an obstacle.
  const blocks = obstacles.map(r => ({ minX: r.minX - 10, minY: r.minY - 10, maxX: r.maxX + 10, maxY: r.maxY + 10 }))
    .filter(r => !inside(a, r) && !inside(b, r));
  const xs = [...new Set([a.x, b.x, ...(lane?.x !== undefined ? [lane.x] : []), (a.x + b.x) / 2, ...blocks.flatMap(r => [r.minX, r.maxX]), Math.min(a.x, b.x) - gap, Math.max(a.x, b.x) + gap])].sort((x, y) => x - y);
  const ys = [...new Set([a.y, b.y, ...(lane?.y !== undefined ? [lane.y] : []), (a.y + b.y) / 2, ...blocks.flatMap(r => [r.minY, r.maxY]), Math.min(a.y, b.y) - gap, Math.max(a.y, b.y) + gap])].sort((x, y) => x - y);
  const points = xs.flatMap(x => ys.map(y => ({ x, y }))).filter(p => !blocks.some(r => inside(p, r)));
  const source = points.findIndex(p => p.x === a.x && p.y === a.y);
  const target = points.findIndex(p => p.x === b.x && p.y === b.y);
  const costs = new Map<string, number>(), previous = new Map<string, string>();
  const initial = `${source}:${sn.x ? 1 : 2}`;
  costs.set(initial, 0);
  const pending = new Set([initial]);
  let finish: string | undefined;
  while (pending.size) {
    const current = [...pending].reduce((best, key) => costs.get(key)! < costs.get(best)! ? key : best);
    pending.delete(current);
    const [index, direction] = current.split(":").map(Number);
    if (index === target) { finish = current; break; }
    const p = points[index];
    points.forEach((q, nextIndex) => {
      if (nextIndex === index || (p.x !== q.x && p.y !== q.y)) return;
      const vx = q.x - p.x, vy = q.y - p.y;
      if (index === source && vx * sn.x + vy * sn.y < 0) return;
      if (nextIndex === target && vx * en.x + vy * en.y > 0) return;
      if (blocks.some(r => crosses(p, q, r))) return;
      const nextDirection = vx ? 1 : 2;
      const key = `${nextIndex}:${nextDirection}`;
      const lanePenalty = lane?.x !== undefined && !vx ? Math.abs(p.x - lane.x) * 2 : lane?.y !== undefined && !vy ? Math.abs(p.y - lane.y) * 2 : 0;
      const cost = lanePenalty + costs.get(current)! + Math.abs(vx) + Math.abs(vy) + (direction === nextDirection ? 0 : 16) + (nextIndex === target && nextDirection !== (en.x ? 1 : 2) ? 16 : 0);
      if (cost < (costs.get(key) ?? Infinity)) {
        costs.set(key, cost); previous.set(key, current); pending.add(key);
      }
    });
  }
  const middle: Point[] = [];
  if (finish) {
    let key: string | undefined = finish;
    while (key) { middle.unshift(points[Number(key.split(":")[0])]); key = previous.get(key); }
  } else {
    middle.push(a, { x: b.x, y: a.y }, b);
  }
  const result: Point[] = [];
  for (const p of [start, ...middle, end]) {
    const last = result[result.length - 1];
    if (last?.x === p.x && last.y === p.y) continue;
    while (result.length > 1) {
      const prev = result[result.length - 2], curr = result[result.length - 1];
      if ((curr.x - prev.x) * (p.y - curr.y) !== (curr.y - prev.y) * (p.x - curr.x)) break;
      // Only collapse points moving in the same direction.
      if ((curr.x - prev.x) * (p.x - curr.x) + (curr.y - prev.y) * (p.y - curr.y) < 0) break;
      result.pop();
    }
    result.push(p);
  }
  return result;
}
function inside(p: Point, r: Obstacle) { return p.x > r.minX && p.x < r.maxX && p.y > r.minY && p.y < r.maxY; }
function crosses(p: Point, q: Point, r: Obstacle) {
  return p.y === q.y
    ? p.y > r.minY && p.y < r.maxY && Math.max(p.x, q.x) > r.minX && Math.min(p.x, q.x) < r.maxX
    : p.x > r.minX && p.x < r.maxX && Math.max(p.y, q.y) > r.minY && Math.min(p.y, q.y) < r.maxY;
}
