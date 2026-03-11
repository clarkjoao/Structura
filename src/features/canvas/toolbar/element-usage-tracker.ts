const STORAGE_KEY = "archflow_element-usage";
const MAX_ENTRIES = 30;

export interface UsageEntry {
  /** e.g. "c4:person", "aws:ec2", "canvas:panel", "registry:svc-id" */
  key: string;
  count: number;
  lastUsed: number;
}

function load(): UsageEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(entries: UsageEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
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
