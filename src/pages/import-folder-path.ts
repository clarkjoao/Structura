/**
 * Path helpers for multi-file / folder-tree diagram import.
 *
 * Hierarchy comes from the filesystem relative path (webkitdirectory /
 * webkitRelativePath), not from `Diagram.folderId` in the JSON — that id is
 * foreign to the receiving workspace.
 */

/** Skip workspace manifests and non-JSON when walking a picked folder. */
export function isImportableDiagramFileName(fileName: string): boolean {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const lower = base.toLowerCase();
  if (!lower.endsWith(".json")) return false;
  if (lower === "structura-manifest.json") return false;
  if (base.startsWith(".")) return false;
  return true;
}

/**
 * Folder name segments from a relative file path, excluding the file name.
 *
 * @example
 * folderSegmentsFromRelativePath("Acme/API/checkout.json")
 * // → ["Acme", "API"]
 */
export function folderSegmentsFromRelativePath(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((part) => part.length > 0);
  if (parts.length <= 1) return [];
  return parts.slice(0, -1).filter((segment) => segment !== "." && !segment.startsWith("."));
}

export interface FolderLike {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * Walk (or create) a folder chain under `baseParentId`.
 *
 * `getFolders` is re-read after each create so newly added folders are visible.
 * Returns `baseParentId` when `segments` is empty.
 */
export function ensureFolderPath(
  segments: readonly string[],
  baseParentId: string | null,
  getFolders: () => Record<string, FolderLike>,
  addFolder: (name: string, parentId: string | null) => FolderLike,
): string | null {
  let parentId: string | null = baseParentId;
  for (const name of segments) {
    const folders = getFolders();
    const existing = Object.values(folders).find(
      (folder) => (folder.parentId ?? null) === parentId && folder.name === name,
    );
    if (existing) {
      parentId = existing.id;
      continue;
    }
    parentId = addFolder(name, parentId).id;
  }
  return parentId;
}
