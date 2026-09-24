import type { PreviewTheme } from "./generatePreviewSvg";

const PREVIEW_KEY_PREFIX = "structura_diagram-preview:";

/** Light keeps the original key so previews cached before themes existed stay valid. */
function previewKey(diagramId: string, theme: PreviewTheme = "light"): string {
  return theme === "dark"
    ? `${PREVIEW_KEY_PREFIX}dark:${diagramId}`
    : `${PREVIEW_KEY_PREFIX}${diagramId}`;
}

export function setPreview(diagramId: string, svg: string, theme: PreviewTheme = "light"): void {
  try {
    localStorage.setItem(previewKey(diagramId, theme), svg);
  } catch {
    try {
      localStorage.removeItem(previewKey(diagramId, theme));
    } catch {
      // ignore
    }
  }
}

export function getPreview(diagramId: string, theme: PreviewTheme = "light"): string | null {
  try {
    return localStorage.getItem(previewKey(diagramId, theme));
  } catch {
    return null;
  }
}

export function deletePreview(diagramId: string): void {
  try {
    localStorage.removeItem(previewKey(diagramId, "light"));
    localStorage.removeItem(previewKey(diagramId, "dark"));
  } catch {
    // ignore
  }
}

export function clearAllPreviews(): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (storageKey?.startsWith(PREVIEW_KEY_PREFIX)) {
      keysToRemove.push(storageKey);
    }
  }
  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
