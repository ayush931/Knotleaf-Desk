import type { Board, CanvasElement } from "./types";
import { computeArrowPath, normalizeRect } from "./renderer";
const xml = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
/** Exports editable shapes and bound connectors for diagrams.net / draw.io. */
export function boardToDrawio(board: Board, elements: CanvasElement[] = board.elements) {
  const ids = new Set(elements.map(e => e.id));
  const cells = elements.map(el => {
    const r = normalizeRect(el);
    const style = `strokeColor=${el.stroke};strokeWidth=${el.strokeWidth};fillColor=${el.fillStyle === "none" || el.fill === "transparent" ? "none" : el.fill};opacity=${Math.round(el.opacity * 100)};fontColor=#f4f4f5;whiteSpace=wrap;html=0;${el.strokeStyle === "dashed" || el.strokeStyle === "dotted" ? "dashed=1;" : ""}`;
    if (el.type === "arrow" || el.type === "line") {
      const info = el.type === "arrow" ? computeArrowPath(el, board.elements) : null;
      const binding = (b: { elementId: string; anchor: string } | undefined, kind: string) => {
        if (!b || !ids.has(b.elementId)) return "";
        return ` ${kind}="${xml(b.elementId)}"`;
      };
      const portStyle = (anchor: string | undefined, prefix: string) => {
        if (!anchor) return "";
        const [x, y] = anchor === "top" ? [0.5, 0] : anchor === "bottom" ? [0.5, 1] : anchor === "left" ? [0, 0.5] : [1, 0.5];
        return `${prefix}X=${x};${prefix}Y=${y};${prefix}Dx=0;${prefix}Dy=0;${prefix}Perimeter=0;`;
      };
      const cap = (head: unknown, fallback: string) => head === false || head === "none" ? "none" : head === "dot" ? "oval" : head === "diamond" ? "diamond" : head === "bar" ? "ERone" : head === undefined ? fallback : "classic";
      const arrow = el.type === "arrow" ? el : null;
      const route = info?.routing === "curved" ? "curved=1;" : info?.routing === "elbow" ? "rounded=1;" : "";
      return `<mxCell id="${xml(el.id)}" value="${xml(el.label || "")}" style="${xml(style + route + `startArrow=${cap(arrow?.arrowHeadStart, "none")};endArrow=${arrow ? cap(arrow.arrowHeadEnd, "classic") : "none"};` + portStyle(arrow?.startBinding?.anchor, "exit") + portStyle(arrow?.endBinding?.anchor, "entry"))}" edge="1" parent="1"${binding(arrow?.startBinding, "source")}${binding(arrow?.endBinding, "target")}><mxGeometry relative="1" as="geometry"><mxPoint x="${el.startX}" y="${el.startY}" as="sourcePoint"/><mxPoint x="${el.endX}" y="${el.endY}" as="targetPoint"/>${info && info.points.length > 2 ? `<Array as="points">${info.points.slice(1, -1).map(p => `<mxPoint x="${p.x}" y="${p.y}"/>`).join("")}</Array>` : info?.cpx !== undefined ? `<Array as="points"><mxPoint x="${info.cpx}" y="${info.cpy}"/></Array>` : ""}</mxGeometry></mxCell>`;
    }
    const shape = el.type === "circle" ? "ellipse;" : el.type === "diamond" ? "rhombus;" : el.type === "text" ? "text;strokeColor=none;fillColor=none;align=left;" : el.type === "sticky" ? "shape=note;" : `rounded=${el.roundness === "rounded" ? 1 : 0};`;
    const value = el.type === "text" || el.type === "sticky" ? el.text : el.type === "frame" ? el.title : el.type === "icon" ? el.label || el.iconName : el.label || "";
    return `<mxCell id="${xml(el.id)}" value="${xml(value)}" style="${xml(style + shape)}" vertex="1" parent="1"><mxGeometry x="${r.x}" y="${r.y}" width="${Math.max(r.w, 1)}" height="${Math.max(r.h, 1)}" as="geometry"/></mxCell>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="Whiteboard"><diagram name="${xml(board.title)}"><mxGraphModel background="#121212"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
}
export function exportToDrawio(board: Board, elements = board.elements) {
  const url = URL.createObjectURL(new Blob([boardToDrawio(board, elements)], { type: "application/xml" }));
  const link = document.createElement("a"); link.href = url; link.download = `${board.title.replace(/[^a-z0-9_-]/gi, "-") || "board"}.drawio`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
