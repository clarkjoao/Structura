/**
 * Bidirectional folder synchronization helpers.
 *
 * Note: The core folder sync logic has been integrated into:
 * - FileSystemAdapter: scanDirectoryStructure(), createDirectory(), deleteDirectory()
 * - fileSystemBoot: syncFoldersFromFilesystem(), folder watcher in startFileSystemSync()
 *
 * This file provides shared types and utilities used by the folder sync implementation.
 */

/**
 * Result of a folder synchronization operation.
 */
export interface FolderSyncResult {
  /** IDs of folders created in store (from external directories) */
  foldersCreatedInStore: string[];
  /** IDs of folders removed from store (directories deleted externally) */
  foldersRemovedFromStore: string[];
  /** IDs of directories that were created in filesystem */
  directoriesCreated: string[];
  /** IDs of directories that were deleted from filesystem */
  directoriesDeleted: string[];
  /** IDs of diagrams that were orphaned (folder no longer exists) */
  orphanedDiagrams: string[];
}

/**
 * Checks if a directory name looks like a valid folder ID.
 * Folder IDs are typically generated with a prefix like "folder_" or are UUIDs.
 */
export function isValidFolderId(name: string): boolean {
  // Skip hidden directories
  if (name.startsWith(".")) return false;

  // Skip common non-folder files
  const SKIP_NAMES = [
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    "target",
  ];
  if (SKIP_NAMES.includes(name)) return false;

  return true;
}
