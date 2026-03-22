import { useCallback, useState } from "react";

export interface RecentDiagramEntry {
  id: string;
  name: string;
  openedAt: number;
}

const STORAGE_KEY = "structura:recentDiagrams";
const MAX_RECENT = 5;

export function readRecentDiagrams(): RecentDiagramEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDiagramEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string" && typeof x.name === "string")
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function useRecentDiagrams() {
  const [recent, setRecent] = useState<RecentDiagramEntry[]>(() => readRecentDiagrams());

  const recordOpened = useCallback((id: string, name: string) => {
    setRecent((prev) => {
      const next = [
        { id, name, openedAt: Date.now() },
        ...prev.filter((x) => x.id !== id),
      ].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, recordOpened };
}
