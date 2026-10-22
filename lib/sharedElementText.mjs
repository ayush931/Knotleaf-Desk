/** One canonical character CRDT for each editable canvas text/card. */
export function elementTextKey(element) {
  if (element.type === "text" && !element.attachment)
    return `${element.isCodeCard ? "code" : "text"}:${element.id}`;
  if (element.type === "sticky") return `text:${element.id}`;
  return null;
}
/** Run on the authoritative server before the first client sync, avoiding racing migrations. */
export function migrateElementText(doc) {
  doc.transact(() => {
    const elements = doc.getMap("elements");
    for (const [id, element] of elements) {
      const key = elementTextKey(element);
      if (!key) continue;
      if (!doc.share.has(key)) doc.getText(key).insert(0, element.text || "");
      if (element.text) elements.set(id, { ...element, text: "" });
    }
  }, "text-migration");
}
export function readElementText(doc, element) {
  const key = elementTextKey(element);
  return key && doc.share.has(key)
    ? { ...element, text: doc.getText(key).toString() }
    : element;
}
