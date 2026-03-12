const STORAGE_KEY = "structura_element-usage";
const MAX_ENTRIES = 30;

export interface UsageEntry {
  /** e.g. "c4:person", "aws:ec2", "canvas:panel", "registry:svc-id" */
  key: string;
  count: number;
  lastUsed: number;
}

function fallbackKeys(): string[] {
  const matches: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey || storageKey === STORAGE_KEY) continue;
    if (storageKey.endsWith("element-usage")) matches.push(storageKey);
  }

  return matches;
}

function load(): UsageEntry[] {
  try {
    const currentValue = localStorage.getItem(STORAGE_KEY);
    if (currentValue) return JSON.parse(currentValue);

    for (const fallbackKey of fallbackKeys()) {
      const fallbackValue = localStorage.getItem(fallbackKey);
      if (fallbackValue) return JSON.parse(fallbackValue);
    }

    return [];
  } catch {
    return [];
  }
}

function save(entries: UsageEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  fallbackKeys().forEach((fallbackKey) => {
    localStorage.removeItem(fallbackKey);
  });
}

export function trackUsage(key: string) {
  const entries = load();
  const existing = entries.find((e) => e.key === key);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = Date.now();
  } else {
    entries.push({ key, count: 1, lastUsed: Date.now() });
  }
  // Sort by count desc, then lastUsed desc
  entries.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
  save(entries);
}

/** Returns top N most-used element keys, scored by frequency + recency. */
export function getTopUsed(n = 8): UsageEntry[] {
  return load().slice(0, n);
}
