/** Fast, browser-free feedback; a check never changes a document. */
export function lintPresentation(source) {
  const issues = [];
  let slide = 1,
    fence = "",
    fenceSize = 0,
    fenceLine = 0,
    math = false,
    mathLine = 0,
    words = 0,
    bullets = 0,
    hasContent = false;
  const lines = source.split(/\r?\n/);
  const add = (line, rule, message, severity = "warning") =>
    issues.push({ line, slide, rule, message, severity });
  const finish = (line) => {
    if (!hasContent) add(line, "empty-slide", "This slide is empty.");
    if (words > 170)
      add(
        line,
        "dense-prose",
        `${words} words may overflow. Split this slide into smaller ideas.`,
      );
    if (bullets > 9)
      add(
        line,
        "dense-list",
        `${bullets} bullets may be difficult to read. Split or reveal them.`,
      );
    words = 0;
    bullets = 0;
    hasContent = false;
  };
  for (const [index, line] of lines.entries()) {
    const number = index + 1,
      marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker && !math) {
      if (!fence) {
        fence = marker[1][0];
        fenceSize = marker[1].length;
        fenceLine = number;
        if (!marker[2].trim())
          add(
            number,
            "code-language",
            "Add a language after this code fence for highlighting.",
          );
      } else if (
        marker[1][0] === fence &&
        marker[1].length >= fenceSize &&
        !marker[2].trim()
      )
        fence = "";
      hasContent = true;
      continue;
    }
    if (fence) continue;
    if (
      line.trim() === "$$" ||
      line.trim() === "\\[" ||
      line.trim() === "\\]"
    ) {
      if (!math) mathLine = number;
      math = !math;
      hasContent = true;
      continue;
    }
    if (math) continue;
    if (/^\s*---\s*$/.test(line)) {
      finish(number);
      slide++;
      continue;
    }
    if (/^\s*<!--/.test(line)) continue;
    if (line.trim()) hasContent = true;
    words += line.trim() ? line.trim().split(/\s+/).length : 0;
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) bullets++;
    if (/^#{1,6}\s/.test(line) && line.length > 100)
      add(
        number,
        "long-heading",
        "Shorten this heading so it fits comfortably.",
      );
    for (const image of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      if (!image[1].trim())
        add(
          number,
          "image-alt",
          "Add a description inside the image brackets.",
        );
      const opacity = image[2].match(/opacity\s*[:= ]\s*([^\s"']+)/i);
      if (
        opacity &&
        (!Number.isFinite(Number(opacity[1])) ||
          Number(opacity[1]) < 0 ||
          Number(opacity[1]) > 1)
      )
        add(
          number,
          "image-opacity",
          "Image opacity should be between 0 and 1.",
          "error",
        );
    }
    if (line.includes("{reveal}") && !/(?:\{reveal\})\s*$/.test(line))
      add(
        number,
        "reveal-position",
        "Place {reveal} at the end of a block or on its own line.",
        "error",
      );
  }
  finish(lines.length);
  if (fence) add(fenceLine, "unclosed-code", "Close this code fence.", "error");
  if (math)
    add(mathLine, "unclosed-math", "Close this display equation.", "error");
  return issues;
}
