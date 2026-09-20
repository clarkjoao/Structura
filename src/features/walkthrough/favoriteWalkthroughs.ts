import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";

/**
 * Walkthroughs the reader marked, kept per device.
 *
 * Its own key, never the walkthrough's own file: a favorite is how *this*
 * browser feels about a walkthrough, not part of the walkthrough, and writing
 * it into the file would push a personal mark at everyone the folder is shared
 * with. Diagram favorites live under their own key too and the two never meet.
 *
 * Goes through `IStoragePort` rather than `localStorage` directly, per the
 * repository's persistence rule — which is why these are async where
 * `favoriteDiagrams.ts` is not.
 */
const STORAGE_KEY = "walkthrough_favorites";

const storage = new LocalStorageAdapter();

function uniqueIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export async function readFavoriteWalkthroughIds(): Promise<string[]> {
  const stored = await storage.load<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return uniqueIds(stored);
}

export async function writeFavoriteWalkthroughIds(ids: readonly string[]): Promise<void> {
  await storage.save(STORAGE_KEY, uniqueIds(ids));
}

/** Toggles membership and returns the new list, most recently marked first. */
export async function toggleFavoriteWalkthrough(id: string): Promise<string[]> {
  const current = await readFavoriteWalkthroughIds();
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [id, ...current];
  await writeFavoriteWalkthroughIds(next);
  return next;
}
