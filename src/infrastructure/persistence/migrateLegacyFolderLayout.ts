import type { Diagram, Folder } from "@/features/diagram";

/** Written to `structura-manifest.json` after a successful one-shot layout migration. */
export const FOLDER_LAYOUT_VERSION = 1;

/** Matches `generateId("folder")` directory names used by the current path layout. */
const FOLDER_ID_SEGMENT_RE = /^folder-[a-f0-9]+$/i;

/**
 * Pre-ID path layout: folder display names (and optional domain) were slugified
 * into directory segments. Kept only for migration from that layout.
 *
 * @example
 * legacySlugify("Pix Ledger") // "pix-ledger"
 */
export function legacySlugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isFolderIdSegment(segment: string): boolean {
  return FOLDER_ID_SEGMENT_RE.test(segment);
}

/**
 * Current on-disk path: ancestor folder IDs only (no domain segment).
 */
export function resolveIdPathSegments(
  diagram: Diagram,
  folders: Record<string, Folder>,
): string[] {
  const segments: string[] = [];
  if (!diagram.folderId) return segments;

  const folderChain: Folder[] = [];
  let current: Folder | undefined = folders[diagram.folderId];
  while (current) {
    folderChain.unshift(current);
    current = current.parentId ? folders[current.parentId] : undefined;
  }
  segments.push(...folderChain.map((folder) => folder.id));
  return segments;
}

/**
 * Legacy on-disk path: slugified folder names + optional domain slug.
 */
export function resolveLegacyPathSegments(
  diagram: Diagram,
  folders: Record<string, Folder>,
): string[] {
  const segments: string[] = [];
  if (diagram.folderId) {
    const folderChain: Folder[] = [];
    let current: Folder | undefined = folders[diagram.folderId];
    while (current) {
      folderChain.unshift(current);
      current = current.parentId ? folders[current.parentId] : undefined;
    }
    segments.push(...folderChain.map((folder) => legacySlugify(folder.name)));
  }
  if (diagram.domain?.trim()) {
    segments.push(legacySlugify(diagram.domain.trim()));
  }
  return segments;
}

function segmentsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

/**
 * Infers a human folder name from the directory where a diagram file was found.
 * Prefers the last non-id segment (legacy slug or free-form name).
 */
export function inferFolderNameFromPath(pathSegments: string[]): string {
  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    const segment = pathSegments[index];
    if (segment && !isFolderIdSegment(segment)) {
      return segment;
    }
  }
  return pathSegments[pathSegments.length - 1] ?? "Folder";
}

/**
 * Ensures every diagram `folderId` has a Folder entry so the sidebar can render.
 * Does not clear orphan folderIds — reconstructs stubs instead.
 */
export function repairFoldersFromDiagrams(
  foldersInput: Record<string, Folder>,
  diagrams: Record<string, Diagram>,
  pathByDiagramId: Record<string, string[]>,
): { folders: Record<string, Folder>; repaired: number } {
  const folders: Record<string, Folder> = { ...foldersInput };
  let repaired = 0;

  for (const diagram of Object.values(diagrams)) {
    const folderId = diagram.folderId;
    if (!folderId || folders[folderId]) continue;

    const pathSegments = pathByDiagramId[diagram.id] ?? [];
    const name = inferFolderNameFromPath(pathSegments);
    folders[folderId] = {
      id: folderId,
      name: name || folderId,
      parentId: null,
    };
    repaired += 1;
  }

  return { folders, repaired };
}

export function pathsNeedMigration(
  diagram: Diagram,
  folders: Record<string, Folder>,
  currentPath: string[],
): { needsMove: boolean; targetSegments: string[]; legacySegments: string[] } {
  const targetSegments = resolveIdPathSegments(diagram, folders);
  const legacySegments = resolveLegacyPathSegments(diagram, folders);
  const onTarget = segmentsEqual(currentPath, targetSegments);
  const onLegacy =
    legacySegments.length > 0 && segmentsEqual(currentPath, legacySegments);
  const offTarget = !onTarget && currentPath.length >= 0;

  // Move when not already at the ID path (legacy slug path, or any other location
  // found by the recursive scan — e.g. domain segment still present).
  const needsMove = Boolean(diagram.folderId) && !onTarget && (onLegacy || offTarget);
  return { needsMove, targetSegments, legacySegments };
}

export interface LegacyFolderMigrationPlan {
  folders: Record<string, Folder>;
  foldersRepaired: number;
  moves: Array<{
    diagramId: string;
    fromSegments: string[];
    toSegments: string[];
  }>;
}

/**
 * Pure planning step: repair folder map and list file moves (no I/O).
 */
export function planLegacyFolderMigration(
  foldersInput: Record<string, Folder>,
  diagrams: Record<string, Diagram>,
  pathByDiagramId: Record<string, string[]>,
): LegacyFolderMigrationPlan {
  const { folders, repaired } = repairFoldersFromDiagrams(
    foldersInput,
    diagrams,
    pathByDiagramId,
  );

  const moves: LegacyFolderMigrationPlan["moves"] = [];
  for (const diagram of Object.values(diagrams)) {
    const currentPath = pathByDiagramId[diagram.id];
    if (!currentPath) continue;
    const { needsMove, targetSegments } = pathsNeedMigration(diagram, folders, currentPath);
    if (!needsMove) continue;
    moves.push({
      diagramId: diagram.id,
      fromSegments: currentPath,
      toSegments: targetSegments,
    });
  }

  return { folders, foldersRepaired: repaired, moves };
}

/**
 * Coerce a loose manifest/store folders record into typed Folder entries.
 */
export function coerceFoldersRecord(raw: Record<string, unknown> | undefined): Record<string, Folder> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, Folder> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : key;
    const name = typeof entry.name === "string" ? entry.name : id;
    const parentId =
      entry.parentId === null || typeof entry.parentId === "string" ? entry.parentId : null;
    result[id] = {
      id,
      name,
      parentId,
      ...(typeof entry.domain === "string" ? { domain: entry.domain } : {}),
    };
  }
  return result;
}
