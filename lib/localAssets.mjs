/** Uploads belong to this browser and must never enter room synchronization. */
export function isLocalAsset(el) { return el?.localOnly === true || el?.type === 'text' && el.attachment !== undefined; }
/** @template T @param {T[]} elements @returns {T[]} */
export function sharedElements(elements) { return elements.filter(el => !isLocalAsset(el)); }
