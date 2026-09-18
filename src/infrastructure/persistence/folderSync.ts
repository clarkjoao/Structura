/**
 * Bidirectional folder synchronization helpers.
 *
 * Core sync lives in:
 * - `FileSystemAdapter.scanDirectoryStructure` / `createDirectory` / `deleteDirectory`
 * - `fileSystemBoot.syncFoldersFromFilesystem` (and the diagram flush path for
 *   store → FS directory creation — there is no separate folder watcher)
 *
 * This module owns the shared result type and the reserved-name filter used
 * when scanning the workspace root.
 */

/**
 * Result of a folder synchronization operation.
 * Only fields that {@link syncFoldersFromFilesystem} actually populates today.
 */
export interface FolderSyncResult {
  /** Reserved for FS→store imports; currently always empty (trust model skips auto-import). */
  foldersCreatedInStore: string[];
  /** Folder IDs for which a directory was created on disk. */
  directoriesCreated: string[];
  /** Folder IDs for which an empty directory was removed; currently unused. */
  directoriesDeleted: string[];
}

const SKIP_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  "dist",
  "build",
  "target",
]);

/**
 * Whether a directory name may be treated as a Structura folder ID.
 * Skips hidden dirs and common tooling folders that should not become
 * "unknown dirs" noise on every sync.
 *
 * @example
 * isValidFolderId("folder_abc") // true
 * isValidFolderId("node_modules") // false
 */
export function isValidFolderId(name: string): boolean {
  if (name.startsWith(".")) return false;
  if (SKIP_DIRECTORY_NAMES.has(name)) return false;
  return true;
}
