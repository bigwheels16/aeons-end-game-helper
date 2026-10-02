/** Largest image the scanner accepts. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Smallest long edge to shrink to; card text becomes unreadable below it. */
const MIN_LONG_EDGE_PX = 1024;

/**
 * Re-encodes an image as JPEG, scaling it down until it fits under MAX_UPLOAD_BYTES.
 * Throws if the image can't be decoded or can't be made small enough.
 */
export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    for (;;) {
      canvas.width = width;
      canvas.height = height;
      // JPEG has no alpha; a white fill keeps transparent regions from turning black
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Failed to encode image');
      if (blob.size <= MAX_UPLOAD_BYTES) {
        const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      }

      if (Math.max(width, height) * 0.75 < MIN_LONG_EDGE_PX) {
        throw new Error('Image is too large to shrink under 10MB');
      }
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
    }
  } finally {
    bitmap.close();
  }
}
