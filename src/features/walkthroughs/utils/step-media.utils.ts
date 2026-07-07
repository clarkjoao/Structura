import { sanitizeSvg } from "@/features/canvas";
import type { WalkthroughStep } from "../types";

/**
 * Apenas data URLs raster geradas pelo editor (FileReader).
 * Bloqueia javascript:, SVG/HTML em data:, etc.
 */
export function sanitizeWalkthroughImageSrc(src: string): string | null {
  const trimmed = src.trim();
  if (trimmed === "") return null;
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export type SafeWalkthroughVisual = { kind: "svg"; html: string } | { kind: "image"; src: string };

/** Conteúdo visual seguro para render (SVG sanitizado ou imagem permitida). */
export function getSafeWalkthroughVisual(step: WalkthroughStep): SafeWalkthroughVisual | null {
  if (step.mediaContent?.type === "svg") {
    const html = sanitizeSvg(step.mediaContent.data);
    return html !== null ? { kind: "svg", html } : null;
  }
  if (step.mediaContent?.type === "image") {
    const src = sanitizeWalkthroughImageSrc(step.mediaContent.data);
    return src !== null ? { kind: "image", src } : null;
  }
  if (step.svgContent) {
    const html = sanitizeSvg(step.svgContent);
    return html !== null ? { kind: "svg", html } : null;
  }
  return null;
}

export function stepHasVisualMedia(step: WalkthroughStep): boolean {
  return getSafeWalkthroughVisual(step) !== null;
}
