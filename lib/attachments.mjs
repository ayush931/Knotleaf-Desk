export function isValidAttachment(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 180 || /[\x00-\x1f\\/]/.test(value.name)) return false;
  if (typeof value.mimeType !== 'string' || value.mimeType.length > 120 || !/^[\w.+-]+\/[\w.+-]+$/.test(value.mimeType)) return false;
  if (!Number.isSafeInteger(value.size) || value.size < 0 || typeof value.source !== 'string') return false;
  const prefix='data:application/octet-stream;base64,';
  if (!value.source.startsWith(prefix)) return false;
  const payload=value.source.slice(prefix.length);
  if (payload.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return false;
  return payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0)===value.size;
}
export function attachmentSize(size) { return size < 1000 ? `${size} B` : size < 1_000_000 ? `${(size/1000).toFixed(1)} KB` : `${(size/1_000_000).toFixed(1)} MB`; }
