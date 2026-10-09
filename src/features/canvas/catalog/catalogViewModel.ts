import type {
  CatalogEntry,
  CatalogGroup,
  CatalogHit,
  CatalogIndex,
  CatalogSearchResult,
} from "@/features/elements/search";

/** The chip that shows every group. */
export const ALL_GROUPS = "all";

/** Tiles per row in the browse grid. */
export const CATALOG_GRID_COLUMNS = 4;

/** Tiles per group in the "All" view before "View all". */
export const CATALOG_GROUP_PREVIEW = 8;

/** One selectable item. `key` is unique in the view: an entry may be both recent and listed. */
export interface CatalogOption {
  key: string;
  entry: CatalogEntry;
  hit?: CatalogHit;
}

export type CatalogSection =
  | { kind: "recents"; key: string; options: CatalogOption[] }
  | {
      kind: "grid";
      key: string;
      group: CatalogGroup;
      options: CatalogOption[];
      /** Entries in the group, beyond the ones shown. */
      total: number;
    }
  | { kind: "best"; key: string; options: [CatalogOption] }
  | { kind: "results"; key: string; group: CatalogGroup; options: CatalogOption[] };

function option(sectionKey: string, entry: CatalogEntry, hit?: CatalogHit): CatalogOption {
  return { key: `${sectionKey}:${entry.id}`, entry, ...(hit ? { hit } : {}) };
}

/**
 * Browsing (no query): Recents and a capped grid per group under "All", or
 * one group's full grid.
 */
export function browseSections(
  index: CatalogIndex,
  recents: readonly CatalogEntry[],
  activeGroup: string,
): CatalogSection[] {
  const sections: CatalogSection[] = [];
  const all = activeGroup === ALL_GROUPS;
  if (all && recents.length > 0) {
    sections.push({
      kind: "recents",
      key: "recents",
      options: recents.map((entry) => option("recents", entry)),
    });
  }
  for (const group of index.groups) {
    if (!all && group.id !== activeGroup) continue;
    const entries = index.entries.filter((entry) => entry.groupId === group.id);
    if (all && entries.length === 0) continue;
    const shown = all ? entries.slice(0, CATALOG_GROUP_PREVIEW) : entries;
    sections.push({
      kind: "grid",
      key: group.id,
      group,
      options: shown.map((entry) => option(group.id, entry)),
      total: entries.length,
    });
  }
  return sections;
}

/**
 * Searching: the best hit on its own, then the rest grouped in index order.
 * A group with no hits is left out.
 */
export function searchSections(
  index: CatalogIndex,
  result: CatalogSearchResult,
  activeGroup: string,
): CatalogSection[] {
  const hits =
    activeGroup === ALL_GROUPS
      ? result.hits
      : result.hits.filter((hit) => hit.entry.groupId === activeGroup);
  const [best, ...rest] = hits;
  if (!best) return [];
  const sections: CatalogSection[] = [
    { kind: "best", key: "best", options: [option("best", best.entry, best)] },
  ];
  for (const group of index.groups) {
    const groupHits = rest.filter((hit) => hit.entry.groupId === group.id);
    if (groupHits.length === 0) continue;
    sections.push({
      kind: "results",
      key: group.id,
      group,
      options: groupHits.map((hit) => option(group.id, hit.entry, hit)),
    });
  }
  return sections;
}

/** Option keys in rows, as the arrow keys see them: a grid wraps at `columns`, a list is one per row. */
export function sectionRows(
  sections: readonly CatalogSection[],
  columns = CATALOG_GRID_COLUMNS,
): string[][] {
  const rows: string[][] = [];
  for (const section of sections) {
    const keys = section.options.map((candidate) => candidate.key);
    if (section.kind === "grid") {
      for (let i = 0; i < keys.length; i += columns) rows.push(keys.slice(i, i + columns));
    } else if (section.kind === "recents") {
      rows.push(keys);
    } else {
      for (const key of keys) rows.push([key]);
    }
  }
  return rows;
}

export type CatalogMove = "up" | "down" | "left" | "right";

/**
 * The option an arrow key moves to. Up and down keep the column where the next
 * row has one; left and right walk the reading order across rows. Stops at the
 * ends rather than wrapping.
 */
export function moveActive(
  rows: readonly string[][],
  activeKey: string | null,
  move: CatalogMove,
): string | null {
  if (rows.length === 0) return null;
  let row = rows.findIndex((candidate) => activeKey !== null && candidate.includes(activeKey));
  if (row === -1) return rows[0][0] ?? null;
  const col = rows[row].indexOf(activeKey ?? "");

  if (move === "up" || move === "down") {
    row = move === "down" ? Math.min(row + 1, rows.length - 1) : Math.max(row - 1, 0);
    return rows[row][Math.min(col, rows[row].length - 1)] ?? null;
  }
  const flat = rows.flat();
  const at = flat.indexOf(activeKey ?? "");
  const next = move === "right" ? Math.min(at + 1, flat.length - 1) : Math.max(at - 1, 0);
  return flat[next] ?? null;
}

/** The chip after (or before) `current` in `chips`, wrapping. */
export function cycleGroup(chips: readonly string[], current: string, backwards: boolean): string {
  if (chips.length === 0) return current;
  const at = chips.indexOf(current);
  const step = backwards ? -1 : 1;
  return chips[(at + step + chips.length) % chips.length];
}
