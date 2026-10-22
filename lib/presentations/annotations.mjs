/** Standalone DOM runtime; deliberately has no external closure dependencies. */
export function installTextAnnotations(root, notify) {
  let marks = [],
    active = null;
  const textNodes = () => {
    const nodes = [],
      walk = root.ownerDocument.createTreeWalker(root, 4);
    while (walk.nextNode()) nodes.push(walk.currentNode);
    return nodes;
  };
  const allowed = (node) =>
    !node.parentElement?.closest(
      "script,style,svg,math,.katex,button,input,textarea",
    );
  const capture = () => {
    const selection = root.ownerDocument.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount)
      return null;
    const range = selection.getRangeAt(0);
    if (
      !root.contains(range.commonAncestorContainer) ||
      !allowed(range.startContainer) ||
      !allowed(range.endContainer)
    )
      return null;
    if (
      [...root.querySelectorAll("svg,math,.katex")].some((node) =>
        range.intersectsNode(node),
      )
    )
      return null;
    const quote = range.toString();
    if (!quote.trim()) return null;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    const offset = prefix.toString().length,
      full = root.textContent || "",
      rect = range.getBoundingClientRect();
    return {
      quote,
      prefix: full.slice(Math.max(0, offset - 40), offset),
      suffix: full.slice(offset + quote.length, offset + quote.length + 40),
      x: rect.left,
      y: rect.bottom,
    };
  };
  const clear = () => {
    root
      .querySelectorAll("mark[data-kl-note]")
      .forEach((mark) => mark.replaceWith(...mark.childNodes));
    root.normalize();
  };
  const paint = () => {
    clear();
    const full = root.textContent || "";
    for (const mark of marks) {
      let offset = full.indexOf(mark.quote),
        position = -1;
      while (offset >= 0) {
        if (
          (!mark.prefix ||
            full.slice(Math.max(0, offset - mark.prefix.length), offset) ===
              mark.prefix) &&
          (!mark.suffix ||
            full.slice(
              offset + mark.quote.length,
              offset + mark.quote.length + mark.suffix.length,
            ) === mark.suffix)
        ) {
          position = offset;
          break;
        }
        offset = full.indexOf(mark.quote, offset + 1);
      }
      if (position < 0) continue;
      let cursor = 0;
      for (const node of textNodes()) {
        const length = node.textContent.length,
          start = Math.max(0, position - cursor),
          end = Math.min(length, position + mark.quote.length - cursor);
        cursor += length;
        if (
          start >= end ||
          !allowed(node) ||
          node.parentElement.closest("mark[data-kl-note]")
        )
          continue;
        const target = end < length ? (node.splitText(end), node) : node;
        const selected = start ? target.splitText(start) : target;
        const wrapper = root.ownerDocument.createElement("mark");
        wrapper.dataset.klNote = mark.id;
        wrapper.title = mark.comment || "Highlight · click to edit";
        wrapper.style.cssText = `background:${mark.comment ? "#a5e2ea" : "#f3d76a"};color:#202329;border-radius:2px;padding:0;cursor:pointer`;
        selected.replaceWith(wrapper);
        wrapper.append(selected);
      }
    }
  };
  const up = () => {
    const value = capture();
    if (value) {
      active = value;
      notify({ kind: "selection", anchor: value });
    }
  };
  const click = (event) => {
    const target =
      event.target instanceof root.ownerDocument.defaultView.Element
        ? event.target.closest("mark[data-kl-note]")
        : null;
    if (target) {
      const mark = marks.find((item) => item.id === target.dataset.klNote);
      if (mark) {
        event.stopPropagation();
        notify({ kind: "edit", mark });
      }
    }
  };
  root.addEventListener("mouseup", up);
  root.addEventListener("touchend", up);
  root.addEventListener("click", click);
  return {
    setMarks(value) {
      marks = value;
      paint();
    },
    clearSelection() {
      root.ownerDocument.getSelection()?.removeAllRanges();
      active = null;
    },
    capture: () => active || capture(),
    destroy() {
      clear();
      root.removeEventListener("mouseup", up);
      root.removeEventListener("touchend", up);
      root.removeEventListener("click", click);
    },
  };
}
