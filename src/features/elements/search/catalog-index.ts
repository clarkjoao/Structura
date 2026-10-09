import type { LucideIcon } from "lucide-react";
import i18n from "@/infrastructure/i18n";
import { COMPONENT_TYPE_PANEL } from "@/features/diagram/model/component-type-constants";
import { getPanelKindForAwsService } from "@/lib/catalogs/panels";
import { offeredElements } from "../element.registry";
import { paletteEntriesForElements } from "../element.palette";
import type { ElementCreateOptions, ElementTypeId } from "../element.types";
import { allCloudFamilies } from "../families/cloud-family.registry";
import type { CloudFamilyDefinition } from "../families/cloud-family.types";
import { conceptTerms, type CatalogConceptId } from "./concepts";
import { fold, foldWithMap, toSourceRange, type FoldedText, type MatchRange } from "./normalize";

/** What picking an entry does. */
export type CatalogInsert =
  | { kind: "element"; type: ElementTypeId; createOptions: ElementCreateOptions }
  /** A user-saved preset (`features/element-presets`). */
  | { kind: "preset"; presetId: string }
  /** A business service from the diagram's service catalog. */
  | { kind: "service"; serviceId: string };

/** One thing the catalog offers. Everything the search reads is on it. */
export interface CatalogEntry {
  /** Stable across sessions and locales — what Recents store. */
  id: string;
  /** The chip it lives under. */
  groupId: string;
  label: string;
  description: string;
  /** Names and abbreviations, matched as written (`palette.searchKeys`). */
  synonyms: readonly string[];
  /** Concept terms from every locale (`CATALOG_CONCEPTS`). */
  tags: readonly string[];
  icon: LucideIcon;
  /** Rendered instead of `icon` when present (panel kinds borrowed from the AWS pack). */
  awsIconName?: string;
  /** Rendered through `CloudIcon` instead of `icon` when present. */
  familyIcon?: { familyId: string; iconName: string };
  insert: CatalogInsert;
}

export interface CatalogGroup {
  id: string;
  label: string;
}

/**
 * Entries in display order, grouped by `groups` order. Search keeps the
 * folded forms next to each entry so a keystroke folds only the query.
 */
export interface CatalogIndex {
  groups: readonly CatalogGroup[];
  entries: readonly CatalogEntry[];
  folded: ReadonlyMap<string, FoldedEntry>;
}

interface FoldedEntry {
  label: FoldedText;
  synonyms: readonly FoldedText[];
  synonymSources: readonly string[];
  tags: readonly FoldedText[];
  tagSources: readonly string[];
}

export type CatalogMatchField = "name" | "synonym" | "tag";

export interface CatalogHit {
  entry: CatalogEntry;
  /** Lower is better; see `searchCatalog`. */
  rank: number;
  matchedOn: CatalogMatchField;
  /** The text that matched: the label, or the synonym / tag that did. */
  matchedText: string;
  /** Where in `matchedText` the query is, for highlighting. */
  ranges: readonly MatchRange[];
}

export interface CatalogSearchResult {
  hits: readonly CatalogHit[];
  /** Hits per group id; a group with none is absent. */
  countsByGroup: ReadonlyMap<string, number>;
}

/**
 * Palette categories shown before the catalog families, in this order. Kept
 * as literals — the same ids the descriptors declare — so this module does not
 * import the canvas enum.
 */
const LEADING_GROUP_IDS = ["c4", "flowchart", "canvas"] as const;

/**
 * A group's chip label: the catalog's own label when it has one, then the
 * catalog family's, then the family-label convention the LLM catalog uses,
 * then the bare id — never a raw i18n key.
 */
function groupLabel(groupId: string, family: CloudFamilyDefinition | undefined): string {
  const own = `elementCatalog.groups.${groupId}`;
  if (i18n.exists(own)) return i18n.t(own);
  if (family) return i18n.t(family.labelKey);
  const convention = `elements.families.${groupId}.label`;
  return i18n.exists(convention) ? i18n.t(convention) : groupId;
}

function tagsFor(concepts: readonly CatalogConceptId[]): string[] {
  return [...new Set(concepts.flatMap(conceptTerms))];
}

/**
 * Within a catalog family: its spotlight services first, in the order it
 * lists them; then the primary categories, in theirs; the rest after, in
 * catalog order.
 */
function entryRank(
  family: CloudFamilyDefinition | undefined,
  elementId: string,
  serviceId: string | undefined,
): number {
  const spotlight = serviceId ? (family?.spotlightServiceIds?.indexOf(serviceId) ?? -1) : -1;
  if (spotlight !== -1) return spotlight - SPOTLIGHT_OFFSET;
  const primary = family?.primaryCategoryIds?.indexOf(elementId) ?? -1;
  return primary === -1 ? Number.MAX_SAFE_INTEGER : primary;
}

/** Puts every spotlight rank below every category rank. */
const SPOTLIGHT_OFFSET = 1_000_000;

/**
 * Every entry the element registry offers, label-resolved in the active
 * locale. Rebuild on a language change.
 */
export function registryCatalogEntries(): {
  groups: CatalogGroup[];
  entries: CatalogEntry[];
} {
  const familiesByPaletteCategory = new Map(
    allCloudFamilies().map((family) => [family.paletteCategoryId, family]),
  );
  const familiesById = new Map(allCloudFamilies().map((family) => [family.id, family]));

  const byGroup = new Map<string, { rank: number; order: number; entry: CatalogEntry }[]>();
  let order = 0;

  for (const element of offeredElements()) {
    const family = familiesById.get(element.family);
    for (const palette of paletteEntriesForElements([element])) {
      const { serviceId } = palette.createOptions;
      const rank = entryRank(family, element.id, serviceId);
      const service = serviceId
        ? family?.services.find((candidate) => candidate.id === serviceId)
        : undefined;
      const descriptionKey = service?.descriptionKey ?? element.descriptionKey;

      // AWS services that are really containers (a VPC, an EKS cluster) are
      // created as the panel kind that draws them — the picker always did.
      const panelKind =
        family?.id === "aws" && serviceId ? getPanelKindForAwsService(serviceId) : undefined;
      const insert: CatalogInsert = panelKind
        ? { kind: "element", type: COMPONENT_TYPE_PANEL, createOptions: { panelKind } }
        : { kind: "element", type: palette.type, createOptions: palette.createOptions };

      const entry: CatalogEntry = {
        id: palette.key,
        groupId: palette.categoryId,
        label: palette.label,
        description: i18n.t(descriptionKey),
        synonyms: palette.searchKeys,
        tags: tagsFor(palette.concepts),
        icon: palette.icon,
        ...(palette.awsIconName ? { awsIconName: palette.awsIconName } : {}),
        ...(palette.familyIcon ? { familyIcon: palette.familyIcon } : {}),
        insert,
      };
      const list = byGroup.get(entry.groupId) ?? [];
      list.push({ rank, order: order++, entry });
      byGroup.set(entry.groupId, list);
    }
  }

  const groupIds = [
    ...LEADING_GROUP_IDS.filter((id) => byGroup.has(id)),
    ...allCloudFamilies()
      .map((family) => family.paletteCategoryId)
      .filter((id) => byGroup.has(id)),
  ];
  for (const id of byGroup.keys()) if (!groupIds.includes(id)) groupIds.push(id);

  const groups = groupIds.map((id) => ({
    id,
    label: groupLabel(id, familiesByPaletteCategory.get(id)),
  }));
  const entries = groupIds.flatMap((id) =>
    (byGroup.get(id) ?? [])
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map((row) => row.entry),
  );
  return { groups, entries };
}

/**
 * The searchable index over `groups` and `entries`. Entries whose group is
 * not listed are dropped; groups keep the order given.
 */
export function createCatalogIndex(
  groups: readonly CatalogGroup[],
  entries: readonly CatalogEntry[],
): CatalogIndex {
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => groupOrder.has(entry.groupId))
    .sort(
      (a, b) =>
        (groupOrder.get(a.entry.groupId) ?? 0) - (groupOrder.get(b.entry.groupId) ?? 0) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);

  const folded = new Map<string, FoldedEntry>();
  for (const entry of ordered) {
    folded.set(entry.id, {
      label: foldWithMap(entry.label),
      synonyms: entry.synonyms.map(foldWithMap),
      synonymSources: entry.synonyms,
      tags: entry.tags.map(foldWithMap),
      tagSources: entry.tags,
    });
  }
  return { groups, entries: ordered, folded };
}

/** Entries per group id, over the whole index. */
export function catalogGroupCounts(index: CatalogIndex): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of index.entries) {
    counts.set(entry.groupId, (counts.get(entry.groupId) ?? 0) + 1);
  }
  return counts;
}

/** True when `at` starts a word in `text` (start, or after a non-alphanumeric). */
function isWordStart(text: string, at: number): boolean {
  return at === 0 || !/[a-z0-9]/.test(text[at - 1]);
}

const RANK = {
  nameExact: 0,
  namePrefix: 1,
  nameWord: 2,
  nameContains: 3,
  synonymExact: 4,
  synonym: 5,
  tag: 6,
} as const;

function matchName(label: FoldedText, query: string): number | null {
  const at = label.folded.indexOf(query);
  if (at === -1) return null;
  if (at === 0) return label.folded.length === query.length ? RANK.nameExact : RANK.namePrefix;
  // "sqs" in "Amazon SQS" is a better hit than "sq" inside a word.
  return findWordStart(label.folded, query) === -1 ? RANK.nameContains : RANK.nameWord;
}

function findWordStart(text: string, query: string): number {
  let at = text.indexOf(query);
  while (at !== -1) {
    if (isWordStart(text, at)) return at;
    at = text.indexOf(query, at + 1);
  }
  return -1;
}

/** Index of the best occurrence: a word start when there is one, else the first. */
function bestOccurrence(text: string, query: string): number {
  const word = findWordStart(text, query);
  return word === -1 ? text.indexOf(query) : word;
}

function firstMatch(
  candidates: readonly FoldedText[],
  sources: readonly string[],
  query: string,
): { text: string; folded: FoldedText; exact: boolean } | null {
  let fallback: { text: string; folded: FoldedText; exact: boolean } | null = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (candidate.folded === query) return { text: sources[i], folded: candidate, exact: true };
    if (!fallback && candidate.folded.includes(query)) {
      fallback = { text: sources[i], folded: candidate, exact: false };
    }
  }
  return fallback;
}

/**
 * Ranked search over name, synonyms and concept tags, accent- and
 * case-insensitive. Rank: exact name, name prefix, a word of the name, inside
 * the name, exact synonym, synonym, tag. Ties keep index order (group, then
 * position within the group) — tag ties prefer the more specific entry — so
 * the first hit is the "best match".
 *
 * An empty query matches nothing: browsing is the caller's job.
 */
export function searchCatalog(index: CatalogIndex, rawQuery: string): CatalogSearchResult {
  const query = fold(rawQuery.trim());
  const hits: CatalogHit[] = [];
  const countsByGroup = new Map<string, number>();
  if (!query) return { hits, countsByGroup };

  index.entries.forEach((entry) => {
    const folded = index.folded.get(entry.id);
    if (!folded) return;

    let hit: CatalogHit | null = null;
    const nameRank = matchName(folded.label, query);
    if (nameRank !== null) {
      const at = bestOccurrence(folded.label.folded, query);
      hit = {
        entry,
        rank: nameRank,
        matchedOn: "name",
        matchedText: entry.label,
        ranges: [toSourceRange(folded.label, at, at + query.length)],
      };
    } else {
      const synonym = firstMatch(folded.synonyms, folded.synonymSources, query);
      const tag = synonym ? null : firstMatch(folded.tags, folded.tagSources, query);
      const found = synonym ?? tag;
      if (found) {
        const at = bestOccurrence(found.folded.folded, query);
        hit = {
          entry,
          rank: synonym ? (found.exact ? RANK.synonymExact : RANK.synonym) : RANK.tag,
          matchedOn: synonym ? "synonym" : "tag",
          matchedText: found.text,
          ranges: [toSourceRange(found.folded, at, at + query.length)],
        };
      }
    }
    if (!hit) return;
    hits.push(hit);
    countsByGroup.set(entry.groupId, (countsByGroup.get(entry.groupId) ?? 0) + 1);
  });

  // Stable: equal ranks keep index order — except between two tag hits, where
  // the entry that is fewer things wins: "fila" is SQS before MSK, which is
  // also an event stream.
  hits.sort(
    (a, b) =>
      a.rank - b.rank || (a.rank === RANK.tag ? a.entry.tags.length - b.entry.tags.length : 0),
  );
  return { hits, countsByGroup };
}
