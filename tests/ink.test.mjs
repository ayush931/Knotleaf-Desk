import { describe, expect, test } from 'bun:test';
import { INK_STYLES, inkWidths, smoothInkWidths, smoothPressure, velocityPressure } from '../draw/ink.ts';
import { isValidElement } from '../lib/elementValidation.mjs';

const pencil = (props = {}) => ({
  id: 'ink',
  type: 'pencil',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  stroke: '#ffffff',
  strokeWidth: 2,
  strokeStyle: 'solid',
  fill: 'transparent',
  fillStyle: 'none',
  roundness: 'round',
  opacity: 1,
  points: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 50 }],
  ...props,
});

describe('ink studio math', () => {
  test('catalogues four distinct, named inks', () => {
    expect(INK_STYLES.map(style => style.id)).toEqual(['fountain', 'brush', 'marker', 'technical']);
    expect(new Set(INK_STYLES.map(style => style.name)).size).toBe(4);
    expect(INK_STYLES.every(style => style.description.length > 20)).toBe(true);
  });

  test('pressure estimates respond to speed without leaving a usable range', () => {
    expect(velocityPressure(2, 16)).toBeGreaterThan(velocityPressure(80, 16));
    expect(velocityPressure(100000, 1)).toBeGreaterThanOrEqual(0.24);
    expect(velocityPressure(0, 1)).toBeLessThanOrEqual(0.93);
    expect(velocityPressure(-20, 0)).toBeGreaterThan(0);
    expect(smoothPressure(undefined, 0.8)).toBe(0.8);
    expect(smoothPressure(1, 0)).toBeGreaterThan(0);
    expect(smoothPressure(1, 0)).toBeLessThan(1);
  });

  test('fountain and brush taper while marker and technical stay even', () => {
    const points = [
      { x: 0, y: 0, pressure: 0.15 },
      { x: 20, y: 4, pressure: 0.9 },
      { x: 40, y: 8, pressure: 0.55 },
      { x: 60, y: 12, pressure: 0.2 },
    ];
    const fountain = inkWidths(points, 3, 'fountain');
    const brush = inkWidths(points, 3, 'brush');
    const marker = inkWidths(points, 3, 'marker');
    const technical = inkWidths(points, 3, 'technical');
    expect(fountain[1]).toBeGreaterThan(fountain[0]);
    expect(brush[1]).toBeGreaterThan(fountain[1]);
    expect(new Set(marker).size).toBe(1);
    expect(new Set(technical).size).toBe(1);
    expect(Math.min(...fountain)).toBeGreaterThan(0.6);
  });

  test('stroke weights scale the output', () => {
    const points = [{ x: 0, y: 0, pressure: 0.6 }, { x: 10, y: 10, pressure: 0.6 }, { x: 20, y: 20, pressure: 0.6 }];
    const fine = inkWidths(points, 1, 'fountain');
    const bold = inkWidths(points, 4, 'fountain');
    expect(bold[1]).toBeGreaterThan(fine[1] * 2);
  });

  test('smoothing tapers corners without moving the stroke ends', () => {
    const widths = [1, 8, 2, 9, 1];
    const smoothed = smoothInkWidths(widths);
    expect(smoothed[0]).toBe(1);
    expect(smoothed.at(-1)).toBe(1);
    expect(smoothed[1]).toBeLessThan(8);
    expect(smoothed[2]).toBeLessThan(9);
    expect(smoothInkWidths([2])).toEqual([2]);
    expect(smoothInkWidths([2, 4])).toEqual([2, 4]);
  });
});

describe('ink persistence validation', () => {
  test('accepts known styles and bounded pressure', () => {
    for (const inkStyle of ['fountain', 'brush', 'marker', 'technical']) {
      expect(isValidElement(pencil({ inkStyle, points: [{ x: 0, y: 0, pressure: 0.4 }, { x: 4, y: 4, pressure: 1 }] }))).toBe(true);
    }
    expect(isValidElement(pencil({ points: [{ x: 0, y: 0 }, { x: 4, y: 4 }] }))).toBe(true);
  });

  test('rejects unknown styles and out-of-range pressure', () => {
    expect(isValidElement(pencil({ inkStyle: 'calligraphy' }))).toBe(false);
    for (const pressure of [-0.1, 1.1, Number.NaN, '0.5']) {
      expect(isValidElement(pencil({ points: [{ x: 0, y: 0, pressure }] }))).toBe(false);
    }
  });
});
