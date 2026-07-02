export interface RecentDiagramRef {
  id: string;
  openedAt: number;
}

const STORAGE_KEY = "structura:recentDiagrams";
const MAX_RECENT = 5;

export function readRecentRefs(): RecentDiagramRef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDiagramRef[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string" && typeof x.openedAt === "number")
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function writeRecentRefs(refs: RecentDiagramRef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
}

export function removeRecentRef(id: string): void {
  const refs = readRecentRefs().filter((r) => r.id !== id);
  writeRecentRefs(refs);
}

export function appendRecentRef(current: RecentDiagramRef[], id: string): RecentDiagramRef[] {
  return [{ id, openedAt: Date.now() }, ...current.filter((x) => x.id !== id)].slice(0, MAX_RECENT);
}
