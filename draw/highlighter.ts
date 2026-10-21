import type { Point } from "./types";

export const HIGHLIGHTER_LIFETIME = 1000;
export const HIGHLIGHTER_LIMIT = 160;
export interface HighlightPoint extends Point { at: number; start?: boolean }
export interface HighlightPacket { sequence: number; sentAt: number; points: HighlightPoint[] }
export function liveHighlights(points: HighlightPoint[], now = Date.now()): HighlightPoint[] {
  return points.filter(p => now - p.at < HIGHLIGHTER_LIFETIME && p.at <= now).slice(-HIGHLIGHTER_LIMIT);
}
/** Use point ages rather than peer wall clocks; reject malformed presence data. */
export function readHighlights(value: unknown, now = Date.now()): HighlightPacket | null {
  if (!value || typeof value !== "object") return null;
  const packet = value as HighlightPacket;
  if (!Number.isSafeInteger(packet.sequence) || !Number.isFinite(packet.sentAt) || !Array.isArray(packet.points) || packet.points.length > HIGHLIGHTER_LIMIT) return null;
  const points: HighlightPoint[] = [];
  for (const p of packet.points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.at)) return null;
    const age = packet.sentAt - p.at;
    if (age >= 0 && age < HIGHLIGHTER_LIFETIME) points.push({ x: p.x, y: p.y, at: now - age, start: p.start === true });
  }
  return { sequence: packet.sequence, sentAt: now, points };
}
