import type { PaletteItem } from "./palette.types";

/** Lowercase, accent-folded: "Orquestração" and "orquestracao" are the same word. */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * How well an item matches a query: 0 is no match. Every word must hit somewhere; a title that
 * starts with the query beats one that merely contains it, and the title beats everything else.
 */
export function scoreItem<T>(item: PaletteItem<T>, query: string, groupLabels: string): number {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  const label = foldText(item.label);
  const rest = foldText(
    [item.description, item.meta, groupLabels, ...(item.keywords ?? [])].filter(Boolean).join(" "),
  );
  let score = 0;
  for (const word of words) {
    if (label.startsWith(word)) score += 4;
    else if (label.split(/[\s\-_/.]+/).some((part) => part.startsWith(word))) score += 3;
    else if (label.includes(word)) score += 2;
    else if (rest.includes(word)) score += 1;
    else return 0;
  }
  return score;
}

/** Items matching `query`, best first; the original order breaks ties. */
export function filterItems<T>(
  items: readonly PaletteItem<T>[],
  query: string,
  labelOfGroup: (groupId: string) => string,
): PaletteItem<T>[] {
  if (!query.trim()) return [...items];
  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreItem(item, query, item.groupIds.map(labelOfGroup).join(" ")),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
