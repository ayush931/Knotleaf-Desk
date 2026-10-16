const NS = "http://www.w3.org/2000/svg";
const tags = new Set(["svg", "g", "defs", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "use", "symbol", "clipPath", "mask", "linearGradient", "radialGradient", "stop"]);
const attributes = new Set(["id", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "transform", "opacity", "fill-opacity", "stroke-opacity", "color", "clip-path", "mask", "maskUnits", "maskContentUnits", "clipPathUnits", "viewBox", "preserveAspectRatio", "href", "xlink:href", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod", "fx", "fy", "fr"]);
const presentation = new Set(["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "transform", "opacity", "fill-opacity", "stroke-opacity", "color", "clip-path", "mask", "stop-color", "stop-opacity"]);

/** Keep static SVG artwork, inherited styling and internal references, never active or remote content. */
export function normalizeIconSvg(source: string, viewBox?: string, namespace?: string): { svgMarkup: string; viewBox: string } {
  if (!source.trim() || source.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Invalid icon SVG.");
  const full = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/.test(source);
  const doc = new DOMParser().parseFromString(full ? source : `<svg xmlns="${NS}">${source}</svg>`, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("Invalid icon SVG.");
  const safeValue = (name: string, value: string) => {
    if (name === "href" || name === "xlink:href") return /^#[\w:.-]+$/.test(value);
    const withoutLocalReferences = value.replace(/url\(\s*["']?#[\w:.-]+["']?\s*\)/gi, "");
    return !/url\s*\(|javascript:|data:|https?:|expression\s*\(/i.test(withoutLocalReferences);
  };
  for (const node of [root, ...Array.from(root.getElementsByTagName("*"))]) {
    if (!tags.has(node.localName) || node.namespaceURI !== NS) { node.parentNode?.removeChild(node); continue; }
    const style = node.getAttribute("style");
    if (style) for (const declaration of style.split(";")) {
      const index = declaration.indexOf(":");
      if (index < 0) continue;
      const name = declaration.slice(0, index).trim(), value = declaration.slice(index + 1).trim();
      if (presentation.has(name) && safeValue(name, value)) node.setAttribute(name, value);
    }
    for (const attr of Array.from(node.attributes)) if (!attributes.has(attr.name) || !safeValue(attr.name, attr.value)) node.removeAttribute(attr.name);
  }
  const dimensions = (viewBox || root.getAttribute("viewBox") || "0 0 24 24").trim().split(/[\s,]+/).map(Number);
  if (dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2] <= 0 || dimensions[3] <= 0) throw new Error("Invalid icon dimensions.");
  const group = doc.createElementNS(NS, "g");
  for (const attr of Array.from(root.attributes)) if (presentation.has(attr.name)) group.setAttribute(attr.name, attr.value);
  while (root.firstChild) group.appendChild(root.firstChild);
  if (!group.getElementsByTagName("*").length) throw new Error("The icon contains no supported artwork.");
  if (namespace) {
    const nodes = [group, ...Array.from(group.getElementsByTagName("*"))];
    const ids = new Map<string, string>();
    for (const node of nodes) { const id = node.getAttribute("id"); if (id) ids.set(id, `${namespace.replace(/[^a-z0-9_-]/gi, "-")}-${id}`); }
    for (const node of nodes) for (const attr of Array.from(node.attributes)) {
      if (attr.name === "id") node.setAttribute(attr.name, ids.get(attr.value)!);
      else if ((attr.name === "href" || attr.name === "xlink:href") && attr.value.startsWith("#")) node.setAttribute(attr.name, `#${ids.get(attr.value.slice(1)) || attr.value.slice(1)}`);
      else node.setAttribute(attr.name, attr.value.replace(/url\(\s*["']?#([\w:.-]+)["']?\s*\)/gi, (_, id: string) => `url(#${ids.get(id) || id})`));
    }
  }
  return { svgMarkup: new XMLSerializer().serializeToString(group), viewBox: dimensions.join(" ") };
}

interface IconImage { image: HTMLImageElement; ready: boolean; failed: boolean; loaded: Promise<void>; listeners: Set<() => void> }
const images = new Map<string, IconImage>();
export function getIconImage(markup: string, viewBox: string, color: string, onLoad?: () => void): IconImage {
  const key = JSON.stringify([markup, viewBox, color]);
  let entry = images.get(key);
  if (!entry) {
    const safe = normalizeIconSvg(markup, viewBox);
    const image = new Image();
    const listeners = new Set<() => void>();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => { entry!.ready = true; resolve(); for (const notify of listeners) notify(); listeners.clear(); };
      image.onerror = () => { entry!.failed = true; reject(new Error("Could not render this icon.")); for (const notify of listeners) notify(); listeners.clear(); };
    });
    entry = { image, ready: false, failed: false, loaded, listeners };
    images.set(key, entry);
    if (images.size > 256) images.delete(images.keys().next().value!);
    // Static, self-contained artwork also keeps canvas exports origin-clean.
    const escapedColor = color.replace(/[&<>"']/g, "");
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="${NS}" width="256" height="256" viewBox="${safe.viewBox}" color="${escapedColor}">${safe.svgMarkup}</svg>`)}`;
    void loaded.catch(() => undefined);
  }
  if (!entry.ready && !entry.failed && onLoad) entry.listeners.add(onLoad);
  return entry;
}
