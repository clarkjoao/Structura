const PREVIEW_KEY_PREFIX = "structura_diagram-preview:";

function previewKey(diagramId: string): string {
  return `${PREVIEW_KEY_PREFIX}${diagramId}`;
}

export function setPreview(diagramId: string, svg: string): void {
  try {
    localStorage.setItem(previewKey(diagramId), svg);
  } catch {
    try {
      localStorage.removeItem(previewKey(diagramId));
    } catch {
      // ignore
    }
  }
}

export function getPreview(diagramId: string): string | null {
  try {
    return localStorage.getItem(previewKey(diagramId));
  } catch {
    return null;
  }
}

export function deletePreview(diagramId: string): void {
  try {
    localStorage.removeItem(previewKey(diagramId));
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
