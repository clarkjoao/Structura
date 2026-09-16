import { SVG_MAX_BYTES, SVG_MAX_DIMENSION } from "./svg.utils";

const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export function isRasterImageMime(mime: string): boolean {
  return RASTER_TYPES.has(mime.toLowerCase());
}

export function isRasterImageFile(file: File): boolean {
  if (isRasterImageMime(file.type)) return true;
  return /\.(png|jpe?g)$/i.test(file.name);
}

/**
 * Embed a raster data-URI inside an SVG root so the existing `svg` element /
 * sanitiser path can host JPG/PNG on the canvas.
 *
 * @example
 * wrapRasterImageAsSvg("data:image/png;base64,iVBOR…", 320, 200)
 */
export function wrapRasterImageAsSvg(dataUri: string, width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  // href is SVG2; xlink:href kept for older export consumers.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${w} ${h}">` +
    `<image href="${dataUri}" xlink:href="${dataUri}" width="${w}" height="${h}" ` +
    `preserveAspectRatio="xMidYMid meet"/>` +
    `</svg>`
  );
}

function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = Math.min(maxEdge / width, maxEdge / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function encodeCanvas(canvas: HTMLCanvasElement, mime: "image/png" | "image/jpeg"): string {
  if (mime === "image/jpeg") {
    return canvas.toDataURL("image/jpeg", 0.88);
  }
  return canvas.toDataURL("image/png");
}

/**
 * Decode a PNG/JPEG blob, fit it under `SVG_MAX_DIMENSION`, and wrap it as SVG
 * with a base64 data-URI `<image>`. Returns null when the bitmap cannot be
 * decoded or the encoded payload still exceeds `SVG_MAX_BYTES`.
 */
export async function rasterBlobToSvgMarkup(blob: Blob, mimeHint?: string): Promise<string | null> {
  const mimeRaw = (mimeHint || blob.type || "").toLowerCase();
  const preferredMime: "image/png" | "image/jpeg" =
    mimeRaw.includes("jpeg") || mimeRaw.includes("jpg") ? "image/jpeg" : "image/png";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const fitted = fitWithinMaxEdge(bitmap.width, bitmap.height, SVG_MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0, fitted.width, fitted.height);
  bitmap.close();

  let dataUri = encodeCanvas(canvas, preferredMime);
  // PNG screenshots often blow the string-size budget — fall back to JPEG.
  if (dataUri.length > SVG_MAX_BYTES && preferredMime === "image/png") {
    dataUri = encodeCanvas(canvas, "image/jpeg");
  }
  if (dataUri.length > SVG_MAX_BYTES) {
    return null;
  }

  return wrapRasterImageAsSvg(dataUri, fitted.width, fitted.height);
}
