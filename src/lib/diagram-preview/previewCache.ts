import { kvGetItem, kvKeys, kvRemoveItem, kvSetItem } from "@/infrastructure/persistence/kvStorage";
import type { PreviewTheme } from "./generatePreviewSvg";

const PREVIEW_KEY_PREFIX = "structura_diagram-preview:";

/** Light keeps the original key so previews cached before themes existed stay valid. */
function previewKey(diagramId: string, theme: PreviewTheme = "light"): string {
  return theme === "dark"
    ? `${PREVIEW_KEY_PREFIX}dark:${diagramId}`
    : `${PREVIEW_KEY_PREFIX}${diagramId}`;
}

export function setPreview(diagramId: string, svg: string, theme: PreviewTheme = "light"): void {
  // A failed write (quota) drops the stale entry rather than leaving an outdated preview.
  if (!kvSetItem(previewKey(diagramId, theme), svg)) kvRemoveItem(previewKey(diagramId, theme));
}

export function getPreview(diagramId: string, theme: PreviewTheme = "light"): string | null {
  try {
    return kvGetItem(previewKey(diagramId, theme));
  } catch {
    return null;
  }
}

export function deletePreview(diagramId: string): void {
  try {
    kvRemoveItem(previewKey(diagramId, "light"));
    kvRemoveItem(previewKey(diagramId, "dark"));
  } catch {
    // ignore
  }
}

export function clearAllPreviews(): void {
  if (typeof window === "undefined") return;

  for (const key of kvKeys()) {
    if (key.startsWith(PREVIEW_KEY_PREFIX)) kvRemoveItem(key);
  }
}
