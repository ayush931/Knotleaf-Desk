"use client";
import { useEffect, useRef, useState, useCallback } from "react";
export type InkTool = "off" | "pen" | "eraser";
interface Stroke {
  points: [number, number][];
  color: string;
  width: number;
}
const boards = new Map<string, Stroke[]>();
export function PresentationInk({
  documentId,
  slideId,
  tool,
  color,
  width,
  blank,
  clearVersion,
  undoVersion,
  fullViewport = false,
}: {
  documentId: string;
  slideId: number;
  tool: InkTool;
  color: string;
  width: number;
  blank: boolean;
  clearVersion: number;
  undoVersion: number;
  fullViewport?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef<Stroke | null>(null),
    oldVersions = useRef({ clearVersion, undoVersion });
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0),
    [bounds, setBounds] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(
        Math.min(
          entry.contentRect.width / 1280,
          entry.contentRect.height / 720,
        ),
      );
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const key = `${documentId}:${slideId}`;
  const paint = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1280, 720);
    for (const stroke of boards.get(key) || []) {
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = ctx.lineJoin = "round";
      for (const [index, [x, y]] of stroke.points.entries())
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0][0] + 0.1, stroke.points[0][1] + 0.1);
      }
      ctx.stroke();
    }
  }, [key]);
  useEffect(() => {
    drawing.current = null;
    paint();
  }, [paint]);
  useEffect(() => {
    if (oldVersions.current.clearVersion !== clearVersion) {
      boards.set(key, []);
      paint();
    } else if (oldVersions.current.undoVersion !== undoVersion) {
      boards.get(key)?.pop();
      paint();
    }
    oldVersions.current = { clearVersion, undoVersion };
  }, [clearVersion, undoVersion, key, paint]);
  const point = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * 1280,
      ((event.clientY - rect.top) / rect.height) * 720,
    ];
  };
  const erase = (value: [number, number]) => {
    const keep = (boards.get(key) || []).filter(
      (stroke) =>
        !stroke.points.some(
          ([x, y]) =>
            Math.hypot(x - value[0], y - value[1]) < width * 3 + stroke.width,
        ),
    );
    boards.set(key, keep);
    paint();
  };
  return (
    <div
      ref={host}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div
        className="relative"
        style={{
          width: fullViewport ? bounds.width : 1280 * scale,
          height: fullViewport ? bounds.height : 720 * scale,
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvas}
          width={1280}
          height={720}
          aria-label="Presentation annotation canvas"
          className={`absolute inset-0 h-full w-full ${tool === "off" ? "pointer-events-none" : "pointer-events-auto touch-none"}`}
          style={{
            cursor:
              tool === "eraser"
                ? "cell"
                : tool === "pen"
                  ? "crosshair"
                  : "default",
            background: blank ? "#f5f3ed" : "transparent",
          }}
          onPointerDown={(event) => {
            if (tool === "off") return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            const value = point(event);
            if (tool === "eraser") {
              erase(value);
              return;
            }
            const stroke = { points: [value], color, width };
            drawing.current = stroke;
            boards.set(key, [...(boards.get(key) || []), stroke]);
            paint();
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            event.preventDefault();
            event.stopPropagation();
            const value = point(event);
            if (tool === "eraser") {
              erase(value);
              return;
            }
            const stroke = drawing.current;
            if (!stroke) return;
            const previous = stroke.points[stroke.points.length - 1];
            stroke.points.push(value);
            const ctx = canvas.current?.getContext("2d");
            if (ctx) {
              ctx.beginPath();
              ctx.strokeStyle = stroke.color;
              ctx.lineWidth = stroke.width;
              ctx.lineCap = "round";
              ctx.moveTo(...previous);
              ctx.lineTo(...value);
              ctx.stroke();
            }
          }}
          onPointerUp={(event) => {
            drawing.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drawing.current = null;
          }}
        />
      </div>
    </div>
  );
}
