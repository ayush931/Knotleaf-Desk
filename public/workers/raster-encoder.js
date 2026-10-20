// One job at a time; transferred bitmaps avoid copying the full pixel buffer.
globalThis.onmessage = async ({ data: { id, bitmap, mime } }) => {
  let canvas;
  try {
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' });
    if (!context) throw new Error('Image encoding is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: mime, quality: 1 });
    if (blob.type !== mime) throw new Error('This image format is unavailable. Choose PNG instead.');
    globalThis.postMessage({ id, blob });
  } catch (error) {
    globalThis.postMessage({ id, error: error instanceof Error ? error.message : 'Image encoding failed.' });
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
};
