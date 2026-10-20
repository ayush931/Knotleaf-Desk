/** A bounded queue keeps encoding off the UI thread without using every CPU core. */
let tail: Promise<unknown> = Promise.resolve();
let queued = 0;
let worker: Worker | null = null;
let workerUnavailable = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

function releaseWorker() { worker?.terminate(); worker = null; }

async function nativeEncode(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image encoding failed. Try a lower export quality.")), mime, 1));
  }
  // Older canvas implementations retain the same format validation.
  const data = canvas.toDataURL(mime, 1);
  if (!data.startsWith(`data:${mime};`)) throw new Error("This image format is unavailable. Choose PNG instead.");
  return new Blob([Uint8Array.from(atob(data.slice(data.indexOf(",") + 1)), c => c.charCodeAt(0))], { type: mime });
}

async function encode(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  if (!workerUnavailable && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | undefined;
    try {
      if (idleTimer) clearTimeout(idleTimer);
      worker ||= new Worker("/workers/raster-encoder.js", { name: "Knotleaf image export" });
      const active = worker;
      bitmap = await createImageBitmap(canvas);
      const id = ++sequence;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const blob = await new Promise<Blob>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Image encoding timed out.")), 30000);
        active.onmessage = event => {
          if (event.data.id !== id) return;
          clearTimeout(timer);
          if (event.data.blob instanceof Blob) resolve(event.data.blob);
          else reject(new Error(event.data.error || "Image encoding failed."));
        };
        active.onerror = event => { event.preventDefault(); clearTimeout(timer); reject(new Error("Image worker is unavailable.")); };
        active.postMessage({ id, bitmap, mime }, [bitmap!]);
      }).finally(() => { if (timer) clearTimeout(timer); });
      idleTimer = setTimeout(releaseWorker, 15000);
      return blob;
    } catch {
      bitmap?.close(); releaseWorker(); workerUnavailable = true;
      // The native asynchronous encoder supports browsers without worker canvases.
    }
  }
  return nativeEncode(canvas, mime);
}

export function encodeRaster(canvas: HTMLCanvasElement, mime = "image/png"): Promise<Blob> {
  if (queued >= 2) return Promise.reject(new Error("Another export is running. Wait for it to finish and try again."));
  queued++;
  const job = tail.then(async () => {
    const blob = await encode(canvas, mime);
    if (blob.type !== mime) throw new Error("This image format is unavailable. Choose PNG instead.");
    return blob;
  });
  tail = job.catch(() => undefined).finally(() => { queued--; });
  return job;
}
