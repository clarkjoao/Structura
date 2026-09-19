const STORAGE_KEY = "structura:favoriteDiagrams";

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return uniqueIds(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return [];
  }
}

export function writeFavoriteIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds(ids)));
}

export function isFavoriteDiagram(id: string): boolean {
  return readFavoriteIds().includes(id);
}

/** Toggle membership; returns the new favorite id list (newest first). */
export function toggleFavoriteDiagram(id: string): string[] {
  const current = readFavoriteIds();
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [id, ...current];
  writeFavoriteIds(next);
  return next;
}
