interface Resource { image: HTMLImageElement; ready: boolean; failed: boolean; loaded: Promise<void>; listeners: Set<() => void> }
const cache = new Map<string, Resource>();
export function isEmbeddedImage(source: unknown, maxLength = 4_000_000): source is string { return typeof source === 'string' && source.length <= maxLength && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(source); }
export function getImageResource(source: string, onLoad?: () => void, maxLength = 4_000_000): Resource {
  let entry = cache.get(source);
  if (!entry && !isEmbeddedImage(source, maxLength)) throw new Error('Could not read this embedded image.');
  if (!entry) {
    const image = new Image(), listeners = new Set<() => void>();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => { entry!.ready = true; resolve(); for (const fn of listeners) fn(); listeners.clear(); };
      image.onerror = () => { entry!.failed = true; reject(new Error('Could not decode this image.')); for (const fn of listeners) fn(); listeners.clear(); };
    });
    entry = { image, ready: false, failed: false, loaded, listeners }; cache.set(source, entry);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    image.src = source; void loaded.catch(() => undefined);
  }
  if (!entry.ready && !entry.failed && onLoad) entry.listeners.add(onLoad);
  return entry;
}
