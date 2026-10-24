import type { Diagram, Folder } from "@/features/diagram";
import { foldText } from "./palette.search";
import type { PaletteGroup, PaletteItem, PaletteSuggestion } from "./palette.types";

/** What picking a diagram hands back. */
export interface DiagramRef {
  id: string;
}

export const IMPORTED_GROUP_ID = "__imported__";
export const NO_FOLDER_GROUP_ID = "__no-folder__";

/** How many diagrams the "Recent" chip lists. */
export const RECENT_DIAGRAMS = 8;

/**
 * Importing stamped the title with " - imported dd/mm/yyyy" (or "importado"). The stamp is
 * metadata, not a name: it comes off the title and the card says "Imported" quietly instead.
 */
const IMPORT_SUFFIX = /\s+[-–]\s+(?:imported|importado)\s+[\d./-]+\s*$/i;

export function stripImportedSuffix(name: string): { name: string; imported: boolean } {
  const stripped = name.replace(IMPORT_SUFFIX, "");
  return { name: stripped.trim(), imported: stripped !== name };
}

interface BuildOptions {
  /** The diagram the element sits in: linking to it would be a loop. */
  excludeId?: string | null;
  levelLabel: (level: string) => string;
  importedLabel: string;
  noFolderLabel: string;
  /** Folder icon-free card icon. */
  icon?: PaletteItem<DiagramRef>["icon"];
}

export interface DiagramLinkSource {
  items: PaletteItem<DiagramRef>[];
  groups: PaletteGroup[];
  recentIds: string[];
}

/** The palette's source for linking a diagram: every diagram, by folder, with imports apart. */
export function buildDiagramLinkSource(
  diagrams: readonly Diagram[],
  folders: Readonly<Record<string, Folder>>,
  options: BuildOptions,
): DiagramLinkSource {
  const usedFolders = new Set<string>();
  let anyImported = false;
  let anyUnfiled = false;
  const items: PaletteItem<DiagramRef>[] = [];
  for (const diagram of diagrams) {
    if (diagram.id === options.excludeId) continue;
    const { name, imported } = stripImportedSuffix(diagram.name);
    const folder = diagram.folderId ? folders[diagram.folderId] : undefined;
    const groupIds: string[] = [];
    if (folder) {
      groupIds.push(folder.id);
      usedFolders.add(folder.id);
    } else {
      groupIds.push(NO_FOLDER_GROUP_ID);
      anyUnfiled = true;
    }
    if (imported) {
      groupIds.push(IMPORTED_GROUP_ID);
      anyImported = true;
    }
    items.push({
      id: diagram.id,
      label: name || diagram.name,
      description: [options.levelLabel(diagram.level), folder?.name].filter(Boolean).join(" · "),
      ...(imported ? { meta: options.importedLabel } : {}),
      groupIds,
      icon: options.icon,
      keywords: diagram.domain ? [diagram.domain] : undefined,
      payload: { id: diagram.id },
    });
  }
  items.sort((a, b) => a.label.localeCompare(b.label));

  const groups: PaletteGroup[] = [
    ...[...usedFolders]
      .map((id) => ({ id, label: folders[id]?.name ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ...(anyUnfiled ? [{ id: NO_FOLDER_GROUP_ID, label: options.noFolderLabel }] : []),
    ...(anyImported ? [{ id: IMPORTED_GROUP_ID, label: options.importedLabel }] : []),
  ];

  const updatedAt = new Map(diagrams.map((d) => [d.id, d.updatedAt]));
  const recentIds = items
    .map((item) => item.id)
    .sort((a, b) => (updatedAt.get(b) ?? 0) - (updatedAt.get(a) ?? 0))
    .slice(0, RECENT_DIAGRAMS);

  return { items, groups, recentIds };
}

/**
 * The diagram that carries the element's name, if there is one — said out loud with `reason`. An
 * empty name suggests nothing: matching "" against every title once suggested the first diagram.
 */
export function suggestDiagram(
  items: readonly PaletteItem<DiagramRef>[],
  elementName: string,
  reason: string,
): PaletteSuggestion<DiagramRef>[] {
  const wanted = foldText(elementName).trim();
  if (!wanted) return [];
  const match = items.find((item) => foldText(item.label).trim() === wanted);
  return match ? [{ item: match, reason }] : [];
}
