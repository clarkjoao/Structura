import { useSaveStatusStore } from "./saveStatus.store";

/** Soma o tamanho de todas as chaves/valores do localStorage em bytes (UTF-16: char × 2). */
export function measureLocalStorageUsage(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) ?? "";
      total += (key.length + value.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Chaves que podem ser limpas sem perda de dados de diagrama. */
const CLEARABLE_KEYS = [
  "structura:llm:history",
  "structura:recentDiagrams",
  "structura:compareTooltipSeen",
  "structura:sidebarFolders",
  "structura:lastEdgeStyle",
  "structura:lastElementCategory",
  "structura:toolbar-collapsed",
];

/**
 * Remove chaves não-essenciais do localStorage.
 * Nunca remove diagram-store, structura:journeys ou structura:icon-library.
 * Retorna quantos bytes foram liberados.
 */
export function clearNonEssentialStorage(): number {
  const before = measureLocalStorageUsage();
  for (const key of CLEARABLE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  const after = measureLocalStorageUsage();
  return Math.max(0, before - after);
}

/** Executa uma medição e atualiza o store. */
export function checkStorageHealth(): void {
  const used = measureLocalStorageUsage();
  useSaveStatusStore.getState()._setStorageUsage(used);
}
