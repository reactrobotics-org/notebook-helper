/**
 * Downscales and re-encodes an image in the browser before upload, so a
 * multi-megabyte phone-camera photo doesn't get sent to Supabase Storage
 * as-is. Falls back to the original file if compression fails for any
 * reason (unsupported format, old browser, etc.) so uploads never break.
 */

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );

    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    const compressedFile = new File([blob], newName, { type: "image/jpeg" });

    console.log(
      `Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB ` +
        `(${Math.round((1 - compressedFile.size / file.size) * 100)}% smaller)`
    );

    return compressedFile;

    //return new File([blob], newName, { type: "image/jpeg" });
  } catch (error) {
    console.error("Image compression failed, using original file:", error);
    return file;
  }
}
