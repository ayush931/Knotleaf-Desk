export function isValidElement(value) {
  if (!value || typeof value !== "object") return false;
  const el = value;
  if (typeof el.id !== "string" || !["rectangle", "diamond", "circle", "arrow", "line", "pencil", "text", "sticky", "icon", "frame", "image"].includes(String(el.type))) return false;
  if (!["x", "y", "width", "height", "strokeWidth", "opacity"].every(k => typeof el[k] === "number" && Number.isFinite(el[k]))) return false;
  if (!["stroke", "fill", "strokeStyle", "fillStyle", "roundness"].every(k => typeof el[k] === "string")) return false;
  if (el.fillOpacity !== undefined && (typeof el.fillOpacity !== "number" || !Number.isFinite(el.fillOpacity) || el.fillOpacity < 0 || el.fillOpacity > 1)) return false;
  if (el.type === "arrow" || el.type === "line") return ["startX", "startY", "endX", "endY"].every(k => typeof el[k] === "number" && Number.isFinite(el[k]));
  if (el.type === "pencil") return Array.isArray(el.points) && el.points.every(p => p && typeof p.x === "number" && Number.isFinite(p.x) && typeof p.y === "number" && Number.isFinite(p.y));
  if (el.type === "text" && el.containerId !== undefined) {
    const offset = el.containerOffset;
    if (typeof el.containerId !== "string" || !offset || typeof offset.x !== "number" || !Number.isFinite(offset.x) || typeof offset.y !== "number" || !Number.isFinite(offset.y)) return false;
  }
  if (el.type === "text" || el.type === "sticky") return typeof el.text === "string" && typeof el.fontSize === "number" && Number.isFinite(el.fontSize) && (el.isCodeCard === undefined || typeof el.isCodeCard === "boolean") && (el.codeLanguage === undefined || typeof el.codeLanguage === "string" && el.codeLanguage.length <= 40) && (!el.isCodeCard || el.text.length <= 100_000);
  if (el.type === "frame") return typeof el.title === "string";
  if (el.type === "image") return typeof el.source === "string" && el.source.length <= 4_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(el.source) && typeof el.imageName === "string" && el.width > 0 && el.height > 0;
  if (el.type === "icon") return typeof el.iconId === "string";
  return true;
}
