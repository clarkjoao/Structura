import type { Folder } from "@/features/diagram";
import type { WalkthroughPresentation } from "./model/walkthrough.types";

export type WalkthroughChip = "all" | "recent" | "favorites";
export type WalkthroughSortKey = "name" | "updatedAt" | "sceneCount";

/** How many the "recent" shelf holds. */
export const RECENT_WALKTHROUGH_LIMIT = 12;

/**
 * The folder a walkthrough is listed under.
 *
 * A `folderId` naming a folder that no longer exists reads as the root rather
 * than hiding the walkthrough from every listing — the same rule `moveDiagram`
 * applies to a diagram pointed at a missing folder. Deleting a folder must not
 * be able to strand a walkthrough somewhere unreachable.
 */
export function effectiveFolderId(
  presentation: WalkthroughPresentation,
  folders: Record<string, Folder>,
): string | null {
  const folderId = presentation.folderId;
  if (!folderId) return null;
  return folders[folderId] ? folderId : null;
}

/** Walkthroughs filed directly in each folder, keyed by folder id. */
export function countByFolderId(
  presentations: readonly WalkthroughPresentation[],
  folders: Record<string, Folder>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const presentation of presentations) {
    const folderId = effectiveFolderId(presentation, folders);
    if (!folderId) continue;
    counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
  }
  return counts;
}

function matchesSearch(presentation: WalkthroughPresentation, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  if (presentation.title.toLowerCase().includes(needle)) return true;
  return (presentation.description ?? "").toLowerCase().includes(needle);
}

function compare(
  a: WalkthroughPresentation,
  b: WalkthroughPresentation,
  key: WalkthroughSortKey,
): number {
  switch (key) {
    case "name":
      return a.title.localeCompare(b.title);
    case "sceneCount":
      return a.steps.length - b.steps.length;
    case "updatedAt":
      return a.updatedAt - b.updatedAt;
  }
}

export interface WalkthroughListingQuery {
  presentations: readonly WalkthroughPresentation[];
  folders: Record<string, Folder>;
  /** `null` lists every folder. */
  selectedFolderId: string | null;
  chip: WalkthroughChip;
  search: string;
  sortKey: WalkthroughSortKey;
  sortAsc: boolean;
  favoriteIds: ReadonlySet<string>;
}

/**
 * What the library lists, given everything narrowing it.
 *
 * Narrowing composes rather than replacing: a search inside a selected folder
 * searches that folder, and a chip narrows what the folder already chose. Only
 * "recent" ignores the sort, because being a shelf of the most recently edited
 * is the whole of what it means.
 */
export function selectWalkthroughs({
  presentations,
  folders,
  selectedFolderId,
  chip,
  search,
  sortKey,
  sortAsc,
  favoriteIds,
}: WalkthroughListingQuery): WalkthroughPresentation[] {
  let listed = presentations.filter((presentation) => {
    if (selectedFolderId !== null && effectiveFolderId(presentation, folders) !== selectedFolderId)
      return false;
    if (chip === "favorites" && !favoriteIds.has(presentation.id)) return false;
    return matchesSearch(presentation, search);
  });

  if (chip === "recent") {
    return [...listed].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT_WALKTHROUGH_LIMIT);
  }

  listed = [...listed].sort((a, b) => {
    const cmp = compare(a, b, sortKey);
    return sortAsc ? cmp : -cmp;
  });
  return listed;
}
