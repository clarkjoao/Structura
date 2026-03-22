const CACHE_KEY = "structura_diagram-previews";

function loadCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

export function setPreview(diagramId: string, svg: string): void {
  const cache = loadCache();
  cache[diagramId] = svg;
  saveCache(cache);
}

export function getPreview(diagramId: string): string | null {
  return loadCache()[diagramId] ?? null;
}

export function deletePreview(diagramId: string): void {
  const cache = loadCache();
  delete cache[diagramId];
  saveCache(cache);
}

export function clearAllPreviews(): void {
  localStorage.removeItem(CACHE_KEY);
}
