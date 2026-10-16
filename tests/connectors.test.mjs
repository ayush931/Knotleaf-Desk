import { describe, test, expect } from 'bun:test';
import { routeConnector, PORT_NORMAL } from '../draw/connectorRouting.ts';
import { computeArrowPath, getElementAnchors } from '../draw/renderer.ts';
import { boardToDrawio } from '../draw/drawioExport.ts';

const base = { stroke: '#fff', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillStyle: 'none', roundness: 'rounded', opacity: 1, zIndex: 0 };
const box = (id, x, y) => ({ ...base, id, type: 'rectangle', x, y, width: 120, height: 80 });
const anchors = ['top', 'right', 'bottom', 'left'];
const at = (shape, anchor) => getElementAnchors(shape).find(p => p.anchor === anchor);
function crosses(a, b, r) {
  return a.y === b.y ? a.y > r.y && a.y < r.y + r.height && Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.width
    : a.x > r.x && a.x < r.x + r.width && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.height;
}
describe('bound elbow routing', () => {
  for (const [x, y] of [[320, 220], [-320, 220], [320, -220], [-320, -220], [320, 0], [0, 240]]) {
    for (const startPort of anchors) for (const endPort of anchors) {
      test(`${startPort} → ${endPort} with target at ${x},${y}`, () => {
        const source = box('source', 0, 0), target = box('target', x, y);
        const start = at(source, startPort), end = at(target, endPort);
        const obstacles = [source, target].map(b => ({ minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height }));
        const points = routeConnector(start, end, startPort, endPort, obstacles);
        expect(points[0]).toMatchObject({ x: start.x, y: start.y });
        expect(points.at(-1)).toMatchObject({ x: end.x, y: end.y });
        const first = points[1], last = points.at(-2);
        const sn = PORT_NORMAL[startPort], en = PORT_NORMAL[endPort];
        expect((first.x - start.x) * sn.x + (first.y - start.y) * sn.y).toBeGreaterThan(0);
        expect((last.x - end.x) * en.x + (last.y - end.y) * en.y).toBeGreaterThan(0);
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i];
          expect(a.x === b.x || a.y === b.y).toBe(true);
          expect(crosses(a, b, source)).toBe(false);
          expect(crosses(a, b, target)).toBe(false);
        }
      });
    }
  }
  test('path label and selection midpoint follow the actual routed path', () => {
    const arrow = { ...base, id: 'a', type: 'arrow', x: 0, y: 0, width: 320, height: 220, startX: 120, startY: 40, endX: 380, endY: 220, routing: 'elbow', startBinding: { elementId: 's', anchor: 'right' }, endBinding: { elementId: 't', anchor: 'top' } };
    const info = computeArrowPath(arrow, [box('s', 0, 0), box('t', 320, 220)]);
    expect(info.labelPt).toEqual(info.midPt);
    expect(info.endAngle).toBeCloseTo(Math.PI / 2);
    expect(info.startAngle).toBeCloseTo(0);
  });
  test('draw.io export escapes labels and retains bindings and ports', () => {
    const source = box('source', 0, 0), target = box('target', 320, 220);
    const arrow = { ...base, id: 'a', type: 'arrow', startX: 120, startY: 40, endX: 380, endY: 220, routing: 'elbow', label: '<Request & response>', startBinding: { elementId: 'source', anchor: 'right' }, endBinding: { elementId: 'target', anchor: 'top' } };
    const xml = boardToDrawio({ title: 'A & B', elements: [source, target, arrow] });
    expect(xml).toContain('source="source" target="target"');
    expect(xml).toContain('exitX=1;exitY=0.5;');
    expect(xml).toContain('&lt;Request &amp; response&gt;');
    const selected = boardToDrawio({ title: 'Selection', elements: [source, target, arrow] }, [arrow]);
    expect(selected).not.toContain('source="source"');
  });
});
