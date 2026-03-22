import { useCallback, useState } from "react";

/** Stored entry — only the diagram ID and when it was opened. */
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

function writeRecentRefs(refs: RecentDiagramRef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
}

/** Remove a diagram from the recent list (e.g. after deletion). */
export function removeRecentRef(id: string): void {
  const refs = readRecentRefs().filter((r) => r.id !== id);
  writeRecentRefs(refs);
}

// ── React hook ──

export function useRecentDiagrams() {
  const [recent, setRecent] = useState<RecentDiagramRef[]>(() => readRecentRefs());

  const recordOpened = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [
        { id, openedAt: Date.now() },
        ...prev.filter((x) => x.id !== id),
      ].slice(0, MAX_RECENT);
      writeRecentRefs(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeRecentRefs(next);
      return next;
    });
  }, []);

  return { recent, recordOpened, removeRecent };
}
