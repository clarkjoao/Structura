import type { Diagram, Folder, IconDefinition } from "@/features/diagram";
import { FileSystemEntryKind } from "@/features/diagram";
import type { ElementPreset } from "@/features/element-presets";
import i18n from "@/infrastructure/i18n";
import {
  isDiagramTombstoneJson,
  validateDiagramFile,
  validateManifest,
} from "./validateWorkspaceFile";
import { readElementPresetsField } from "./read-element-presets-field";
import { type StagedDiagramWrite, getTempFileName, isTempFile } from "./stagedDiagramWrite";
import { isValidFolderId } from "./folderSync";

const MAX_DIRECTORY_SCAN_DEPTH = 64;
/** Orphan `.json.tmp` files older than this are removed on reconnect/connect. */
const ORPHAN_TEMP_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * `FileSystemFileHandle.move` is available in Chromium (local FS + OPFS) and
 * Safari/Firefox (primarily the two-arg form). Signature differs by engine, so
 * we feature-detect and try both forms before falling back to copy+delete.
 */
type FileSystemFileHandleWithMove = FileSystemFileHandle & {
  move?: (destinationOrName: FileSystemDirectoryHandle | string, name?: string) => Promise<void>;
};

const DB_NAME = "structura-fs";
const DB_STORE = "handles";
const HANDLE_KEY = "workspace-handle";
const MANIFEST_FILE = "structura-manifest.json";

type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemPermissionState = "granted" | "denied" | "prompt";

interface FileSystemPermissionRequest {
  mode?: FileSystemPermissionMode;
}

interface FileSystemDirectoryHandleWithPermissions extends FileSystemDirectoryHandle {
  queryPermission?: (
    descriptor?: FileSystemPermissionRequest,
  ) => Promise<FileSystemPermissionState>;
  requestPermission?: (
    descriptor?: FileSystemPermissionRequest,
  ) => Promise<FileSystemPermissionState>;
}

export type { FileSystemDirectoryHandleWithPermissions };

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: unknown) => Promise<FileSystemDirectoryHandle>;
}

type DirectoryEntryTuple = [string, FileSystemHandle];

function directoryEntries(dir: FileSystemDirectoryHandle): AsyncIterable<DirectoryEntryTuple> {
  return (dir as unknown as { entries: () => AsyncIterable<DirectoryEntryTuple> }).entries();
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function clearHandleFromIDB(): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = "readwrite",
): Promise<boolean> {
  const directoryHandle = handle as FileSystemDirectoryHandleWithPermissions;
  const opts = { mode };
  if ((await directoryHandle.queryPermission?.(opts)) === "granted") return true;
  if ((await directoryHandle.requestPermission?.(opts)) === "granted") return true;
  return false;
}

function resolveDiagramPathSegments(diagram: Diagram, folders: Record<string, Folder>): string[] {
  const segments: string[] = [];

  if (diagram.folderId) {
    const folderChain: Folder[] = [];
    let current: Folder | undefined = folders[diagram.folderId];
    while (current) {
      folderChain.unshift(current);
      current = current.parentId ? folders[current.parentId] : undefined;
    }
    // Use folder ID (stable, not tied to name) so renames don't orphan files on disk.
    // Domain/tag is logical-only (stored in diagram JSON), not reflected in the path.
    segments.push(...folderChain.map((f) => f.id));
  }

  return segments;
}

async function getOrCreateDirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

export interface WorkspaceManifest {
  version: 1 | 2;
  createdAt: string;
  updatedAt: string;
  diagramIds: string[];
  services: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  elementPresets?: Record<string, ElementPreset>;
  /** @deprecated F10 — read via `readElementPresetsField`; rewritten as `elementPresets`. */
  customComponentTemplates?: Record<string, ElementPreset>;
  iconLibrary?: Record<string, IconDefinition>;
}

/** Prefer `services`; fall back to legacy `serviceCatalog` from pre-v14 manifests. */
function resolveManifestServices(raw: Record<string, unknown>): Record<string, unknown> {
  const current = raw.services;
  if (current && typeof current === "object" && !Array.isArray(current)) {
    const asRecord = current as Record<string, unknown>;
    if (Object.keys(asRecord).length > 0) return asRecord;
  }
  const legacy = raw.serviceCatalog;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    return legacy as Record<string, unknown>;
  }
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as Record<string, unknown>;
  }
  return {};
}

function normalizeWorkspaceManifest(raw: Record<string, unknown>): WorkspaceManifest {
  return {
    ...(raw as unknown as WorkspaceManifest),
    services: resolveManifestServices(raw),
  };
}

export type WorkspacePayload = {
  diagrams: Record<string, Diagram>;
  services: Record<string, unknown>;
  folders: Record<string, unknown>;
  activeDiagramId: string | null;
  /** ISO timestamp from manifest; used for merge/reconnect conflict resolution. */
  manifestUpdatedAt?: string;
  elementPresets?: Record<string, ElementPreset>;
  /** @deprecated F10 — read via `readElementPresetsField`. */
  customComponentTemplates?: Record<string, ElementPreset>;
  iconLibrary?: Record<string, IconDefinition>;
};

export interface WorkspaceScanResult {
  valid: Diagram[];
  invalid: { fileName: string; reason: string }[];
  manifest: WorkspaceManifest | null;
  manifestError: string | null;
  totalFilesScanned: number;
}

export class FileSystemAdapter {
  private handle: FileSystemDirectoryHandle | null = null;
  private folders: Record<string, Folder> = {};
  /** Handle loaded from IDB that still requires a user-gesture permission request. */
  private _pendingHandle: FileSystemDirectoryHandle | null = null;
  /**
   * Set to true when a write fails because the OS/browser revoked write permission
   * after the session started. The handle still exists but writes will fail until
   * the user re-grants permission via requestReconnectPermission().
   */
  private _hasPermissionError = false;
  /** Called (once) each time a write fails due to lost permission. */
  private _onPermissionError: (() => void) | null = null;
  /** Bound visibilitychange listener — kept so it can be removed on disconnect. */
  private _visibilityCleanup: (() => void) | null = null;

  /**
   * Register a callback to invoke when a write fails because permission was lost.
   * Replaces any previously registered callback.
   */
  setPermissionErrorCallback(cb: (() => void) | null): void {
    this._onPermissionError = cb;
  }

  /**
   * Queries readwrite permission on the connected handle.
   * On denial or query failure, sets `_hasPermissionError` and always fires the
   * permission-error callback so the UI can re-open the modal on tab focus.
   * On grant, clears a previous permission-error flag.
   *
   * @example
   * if (!(await fileSystemAdapter.checkPermission())) return;
   */
  async checkPermission(): Promise<boolean> {
    if (!this.handle) return false;
    try {
      const directoryHandle = this.handle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });
      if (state === "granted") {
        this._hasPermissionError = false;
        return true;
      }
      this._hasPermissionError = true;
      this._onPermissionError?.();
      return false;
    } catch {
      this._hasPermissionError = true;
      this._onPermissionError?.();
      return false;
    }
  }

  /**
   * Starts monitoring permission state while a folder is connected.
   * Checks permission each time the tab becomes visible (handles OS/browser revocation
   * that happens while the tab is backgrounded) and periodically every 60 s.
   * Safe to call multiple times — only one monitor runs at a time.
   */
  private _startPermissionMonitor(): void {
    this._stopPermissionMonitor();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (!this.handle) return;
      // Shared path with tab-focus revalidation — always notifies the UI callback
      // when access is missing so the permission modal can re-open.
      await this.checkPermission();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    // Periodic heartbeat — OS may revoke permission without a visibility change
    intervalId = setInterval(() => void check(), 60_000);

    this._visibilityCleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalId !== null) clearInterval(intervalId);
      this._visibilityCleanup = null;
    };
  }

  private _stopPermissionMonitor(): void {
    this._visibilityCleanup?.();
  }

  /**
   * True when a write failed due to permission being revoked mid-session.
   * The handle still exists but writes will fail until the user re-authorizes.
   */
  get hasPermissionError(): boolean {
    return this._hasPermissionError;
  }

  get isConnected(): boolean {
    return this.handle !== null && !this._hasPermissionError;
  }

  get folderName(): string | null {
    return this.handle?.name ?? null;
  }

  /** True when a handle was found in IDB but requires a user gesture to grant readwrite access. */
  get needsPermission(): boolean {
    return this._pendingHandle !== null && this.handle === null && !this._hasPermissionError;
  }

  get pendingFolderName(): string | null {
    return this._pendingHandle?.name ?? null;
  }

  setFolders(folders: Record<string, Folder>): void {
    this.folders = folders;
  }

  /**
   * Attempts silent reconnection using only queryPermission (no user gesture required).
   * If permission is "prompt", saves the handle as _pendingHandle so the user can
   * later trigger requestReconnectPermission() from a click handler.
   */
  async tryReconnect(): Promise<boolean> {
    try {
      const handle = await loadHandleFromIDB();
      if (!handle) return false;

      const directoryHandle = handle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });

      if (state === "granted") {
        this.handle = handle;
        this._pendingHandle = null;
        this._hasPermissionError = false;
        this._startPermissionMonitor();
        // Best-effort: remove leftover .json.tmp from interrupted two-phase commits.
        void this.cleanupOrphanedTempFiles();
        return true;
      }

      // prompt / denied / missing queryPermission — keep the handle for a
      // user-gesture reconnect (requestPermission requires a click).
      this._pendingHandle = handle;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Must be called from a user gesture (click handler).
   * Requests readwrite permission for the pending handle (boot) or the still-
   * held handle after a mid-session revocation, then activates the connection.
   */
  async requestReconnectPermission(): Promise<boolean> {
    const target = this._pendingHandle ?? this.handle;
    if (!target) return false;
    try {
      const directoryHandle = target as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.requestPermission?.({ mode: "readwrite" });
      if (state === "granted") {
        this.handle = target;
        this._pendingHandle = null;
        this._hasPermissionError = false;
        this._startPermissionMonitor();
        void this.cleanupOrphanedTempFiles();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async connect(): Promise<boolean> {
    try {
      const windowWithDirectoryPicker = window as unknown as WindowWithDirectoryPicker;
      const picker = windowWithDirectoryPicker.showDirectoryPicker;
      if (!picker) return false;

      const handle = await picker({
        mode: "readwrite",
        startIn: "documents",
      });
      const ok = await verifyPermission(handle);
      if (!ok) return false;
      this.handle = handle;
      await saveHandleToIDB(handle);
      this._startPermissionMonitor();
      // Best-effort: remove leftover .json.tmp from interrupted two-phase commits.
      void this.cleanupOrphanedTempFiles();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this._stopPermissionMonitor();
    this.handle = null;
    this._pendingHandle = null;
    await clearHandleFromIDB();
  }

  computePathSegments(diagram: Diagram): string[] {
    return resolveDiagramPathSegments(diagram, this.folders);
  }

  async deleteAtSegments(diagramId: string, segments: string[]): Promise<void> {
    if (!this.handle) return;
    try {
      const dir = await getOrCreateDirectory(this.handle, segments);
      await dir.removeEntry(`${diagramId}.json`);
    } catch {
      // File may not exist at this path (already moved/deleted), not an error
    }
  }

  async writeDiagram(diagram: Diagram): Promise<boolean> {
    if (!this.handle) return false;

    // Check permission proactively before attempting a write. If revoked mid-session
    // this catches it before the native call throws.
    try {
      const directoryHandle = this.handle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });
      if (state !== "granted") {
        this._hasPermissionError = true;
        console.error("[FileSystemAdapter] writeDiagram: permission not granted:", state);
        this._onPermissionError?.();
        return false;
      }
    } catch (e) {
      this._hasPermissionError = true;
      console.error("[FileSystemAdapter] writeDiagram: permission query failed:", e);
      this._onPermissionError?.();
      return false;
    }

    try {
      const segments = resolveDiagramPathSegments(diagram, this.folders);
      const dir = await getOrCreateDirectory(this.handle, segments);
      const file = await dir.getFileHandle(`${diagram.id}.json`, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(diagram, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      // After a native API throw, treat it as a permission issue (handle revoked
      // between the queryPermission check above and the write). Surface it so
      // the UI can show a reconnect prompt.
      this._hasPermissionError = true;
      console.error("[FileSystemAdapter] writeDiagram failed:", e);
      this._onPermissionError?.();
      return false;
    }
  }

  /**
   * Phase 1 of two-phase commit: writes a diagram to a .tmp file.
   * The caller should track the returned StagedDiagramWrite and either:
   * - call commitStagedDiagram() to finalize (rename .tmp → .json)
   * - call rollbackStagedDiagram() to clean up on failure
   */
  async writeDiagramStaged(diagram: Diagram): Promise<StagedDiagramWrite | null> {
    if (!this.handle) return null;

    const finalSegments = resolveDiagramPathSegments(diagram, this.folders);
    const tempFileName = getTempFileName(diagram.id);

    try {
      const dir = await getOrCreateDirectory(this.handle, finalSegments);
      const file = await dir.getFileHandle(tempFileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(diagram, null, 2));
      await writable.close();
      return {
        diagramId: diagram.id,
        tempSegments: [...finalSegments, tempFileName],
        finalSegments,
      };
    } catch (e) {
      console.error("[FileSystemAdapter] writeDiagramStaged failed for", diagram.id, e);
      return null;
    }
  }

  /**
   * Phase 2 (commit): renames all staged `.tmp` files to their final `.json` names.
   *
   * Atomicity strategy:
   * 1. Prefer `FileSystemFileHandle.move()` when present — a same-directory
   *    rename is atomic on supporting engines (Chromium local FS / OPFS,
   *    Safari/Firefox two-arg form). Feature-detect; never assume availability.
   * 2. Fallback: copy content into the final file then `removeEntry` the `.tmp`.
   *    That path is NOT crash-atomic (a crash between write and remove leaves an
   *    orphan `.tmp`). `cleanupOrphanedTempFiles()` on connect/reconnect removes
   *    orphans older than {@link ORPHAN_TEMP_MAX_AGE_MS}.
   *
   * Partial failure is intentional: already-committed renames are kept; callers
   * must not roll those back (would delete the only good copy). Returns false if
   * any rename failed.
   */
  async commitStagedDiagrams(staged: StagedDiagramWrite[]): Promise<boolean> {
    if (!this.handle) return false;
    if (staged.length === 0) return true;

    const errors: string[] = [];

    for (const { diagramId, tempSegments, finalSegments } of staged) {
      if (!diagramId) {
        errors.push(
          `Failed to commit staged diagram at ${finalSegments.join("/")}: missing diagramId`,
        );
        continue;
      }
      const finalFileName = `${diagramId}.json`;

      try {
        const tempFileName = tempSegments[tempSegments.length - 1];
        if (!tempFileName) {
          errors.push(`Failed to commit staged diagram ${diagramId}: empty tempSegments`);
          continue;
        }
        const parentSegments = tempSegments.slice(0, -1);
        const parentDir = await getOrCreateDirectory(this.handle, parentSegments);
        const finalDir = await getOrCreateDirectory(this.handle, finalSegments);
        const tempFile = await parentDir.getFileHandle(tempFileName);

        const renamed = await this._tryAtomicRename(tempFile, finalDir, finalFileName);
        if (!renamed) {
          await this._copyThenRemoveTemp(
            tempFile,
            parentDir,
            tempFileName,
            finalDir,
            finalFileName,
          );
        }
      } catch (e) {
        errors.push(
          `Failed to commit staged diagram ${diagramId} (${finalSegments.join("/")}): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    if (errors.length > 0) {
      console.error("[FileSystemAdapter] commitStagedDiagrams errors:", errors);
      return false;
    }
    return true;
  }

  /**
   * Attempts an atomic rename via `move()`. Returns true on success, false if
   * `move` is unavailable or both call forms threw (caller should copy-delete).
   */
  private async _tryAtomicRename(
    tempFile: FileSystemFileHandle,
    finalDir: FileSystemDirectoryHandle,
    finalFileName: string,
  ): Promise<boolean> {
    const movable = tempFile as FileSystemFileHandleWithMove;
    if (typeof movable.move !== "function") return false;

    // Existing final must go first — move() does not overwrite in all engines.
    try {
      await finalDir.removeEntry(finalFileName);
    } catch {
      // NotFoundError is fine — no prior final file.
    }

    try {
      // Two-arg form: Safari + Chromium (directory + new name).
      await movable.move(finalDir, finalFileName);
      return true;
    } catch {
      try {
        // One-arg form: Chromium same-directory rename by name alone.
        await movable.move(finalFileName);
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Non-atomic fallback used when `move()` is missing or failed. */
  private async _copyThenRemoveTemp(
    tempFile: FileSystemFileHandle,
    parentDir: FileSystemDirectoryHandle,
    tempFileName: string,
    finalDir: FileSystemDirectoryHandle,
    finalFileName: string,
  ): Promise<void> {
    const finalFile = await finalDir.getFileHandle(finalFileName, { create: true });
    const writable = await finalFile.createWritable();
    const content = await (await tempFile.getFile()).text();
    await writable.write(content);
    await writable.close();
    await parentDir.removeEntry(tempFileName);
  }

  /**
   * Removes orphaned `*.json.tmp` files older than `maxAgeMs` under the connected
   * root. Called on connect/reconnect so a crash mid-commit (copy-delete path)
   * does not leave staging files forever. Returns the number of files removed.
   */
  async cleanupOrphanedTempFiles(maxAgeMs = ORPHAN_TEMP_MAX_AGE_MS): Promise<number> {
    if (!this.handle) return 0;
    const cutoff = Date.now() - maxAgeMs;
    return this._cleanupOrphanedTempInDir(this.handle, cutoff);
  }

  private async _cleanupOrphanedTempInDir(
    dir: FileSystemDirectoryHandle,
    cutoffMs: number,
    depth = 0,
  ): Promise<number> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) return 0;
    let removed = 0;

    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && isTempFile(name)) {
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.lastModified < cutoffMs) {
            await dir.removeEntry(name);
            removed += 1;
          }
        } catch (e) {
          console.warn("[FileSystemAdapter] orphan temp cleanup skipped", name, e);
        }
        continue;
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        removed += await this._cleanupOrphanedTempInDir(
          entry as FileSystemDirectoryHandle,
          cutoffMs,
          depth + 1,
        );
      }
    }

    return removed;
  }

  /**
   * Cleanup: deletes all staged .tmp files. Called when manifest write fails
   * after diagrams were written to .tmp files.
   */
  async rollbackStagedDiagrams(staged: StagedDiagramWrite[]): Promise<void> {
    if (!this.handle) return;

    for (const { tempSegments } of staged) {
      try {
        const tempFileName = tempSegments[tempSegments.length - 1];
        const parentSegments = tempSegments.slice(0, -1);
        const parentDir = await getOrCreateDirectory(this.handle, parentSegments);
        await parentDir.removeEntry(tempFileName);
      } catch (e) {
        // Best effort cleanup - log but don't throw
        console.warn("[FileSystemAdapter] Failed to rollback temp file", tempSegments, e);
      }
    }
  }

  // ─── Folder Sync Methods ────────────────────────────────────────────────────

  /**
   * Scans the root directory and returns all folder IDs (subdirectory names).
   * Used for bidirectional folder sync.
   */
  async scanDirectoryStructure(): Promise<Set<string>> {
    const folderIds = new Set<string>();
    if (!this.handle) return folderIds;

    try {
      for await (const [name, entry] of directoryEntries(this.handle)) {
        if (entry.kind === FileSystemEntryKind.Directory && isValidFolderId(name)) {
          folderIds.add(name);
        }
      }
    } catch (e) {
      console.warn("[FileSystemAdapter] scanDirectoryStructure failed:", e);
    }

    return folderIds;
  }

  /**
   * Creates a directory in the filesystem for a given folder ID.
   */
  async createDirectory(folderId: string): Promise<boolean> {
    if (!this.handle) return false;

    try {
      await this.handle.getDirectoryHandle(folderId, { create: true });
      return true;
    } catch (e) {
      console.error(`[FileSystemAdapter] Failed to create directory ${folderId}:`, e);
      return false;
    }
  }

  /**
   * Deletes a directory from the filesystem for a given folder ID.
   * Only deletes if the directory is empty (safety check).
   */
  async deleteDirectory(folderId: string): Promise<boolean> {
    if (!this.handle) return false;

    try {
      const dir = await this.handle.getDirectoryHandle(folderId);
      // Check if directory is empty before deleting
      let isEmpty = true;
      for await (const _ of directoryEntries(dir)) {
        isEmpty = false;
        break;
      }

      if (isEmpty) {
        await this.handle.removeEntry(folderId);
        return true;
      } else {
        console.warn(`[FileSystemAdapter] Directory ${folderId} not empty, skipping delete`);
        return false;
      }
    } catch (e) {
      // Directory might not exist, which is fine
      if ((e as Error).name !== "NotFoundError") {
        console.warn(`[FileSystemAdapter] deleteDirectory failed for ${folderId}:`, e);
      }
      return false;
    }
  }

  async readDiagram(diagramId: string): Promise<Diagram | null> {
    if (!this.handle) return null;
    return this._findDiagramFile(this.handle, diagramId);
  }

  private async _findDiagramFile(
    dir: FileSystemDirectoryHandle,
    diagramId: string,
    depth = 0,
  ): Promise<Diagram | null> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) return null;
    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && name === `${diagramId}.json`) {
        const f = await (entry as FileSystemFileHandle).getFile();
        const raw = JSON.parse(await f.text());
        const validation = validateDiagramFile(raw);
        return validation.valid ? validation.diagram : null;
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const result = await this._findDiagramFile(
          entry as FileSystemDirectoryHandle,
          diagramId,
          depth + 1,
        );
        if (result) return result;
      }
    }
    return null;
  }

  async deleteDiagram(diagramId: string, diagram?: Diagram): Promise<void> {
    if (!this.handle) return;
    try {
      const segments = diagram ? resolveDiagramPathSegments(diagram, this.folders) : [];
      const dir = await getOrCreateDirectory(this.handle, segments);
      await dir.removeEntry(`${diagramId}.json`);
    } catch {
      try {
        const segments = diagram ? resolveDiagramPathSegments(diagram, this.folders) : [];
        const dir = await getOrCreateDirectory(this.handle, segments);
        const file = await dir.getFileHandle(`${diagramId}.json`, {
          create: true,
        });
        const writable = await file.createWritable();
        await writable.write(
          JSON.stringify(
            { deleted: true, id: diagramId, deletedAt: new Date().toISOString() },
            null,
            2,
          ),
        );
        await writable.close();
      } catch (error) {
        console.warn(
          "[StructuraContext] FileSystemAdapter deleteDiagram tombstone fallback failed",
          error,
        );
      }
    }
  }

  async writeManifest(manifest: WorkspaceManifest): Promise<boolean> {
    if (!this.handle) return false;

    try {
      const directoryHandle = this.handle as FileSystemDirectoryHandleWithPermissions;
      const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });
      if (state !== "granted") {
        this._hasPermissionError = true;
        console.error("[FileSystemAdapter] writeManifest: permission not granted:", state);
        this._onPermissionError?.();
        return false;
      }
    } catch (e) {
      this._hasPermissionError = true;
      console.error("[FileSystemAdapter] writeManifest: permission query failed:", e);
      this._onPermissionError?.();
      return false;
    }

    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE, {
        create: true,
      });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(manifest, null, 2));
      await writable.close();
      return true;
    } catch (e) {
      this._hasPermissionError = true;
      console.error("[FileSystemAdapter] writeManifest failed:", e);
      this._onPermissionError?.();
      return false;
    }
  }

  /**
   * Writes the manifest with retry and exponential backoff.
   * Returns true if the manifest was written successfully.
   * On final failure, returns false so the caller can decide whether to
   * save diagrams without manifest (partial save) or roll back.
   */
  async writeManifestWithRetry(manifest: WorkspaceManifest, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 0ms, 250ms, 500ms
        await new Promise((resolve) => setTimeout(resolve, 250 * Math.pow(2, attempt - 1)));
      }
      if (await this.writeManifest(manifest)) {
        return true;
      }
    }
    return false;
  }

  async readManifest(): Promise<WorkspaceManifest | null> {
    if (!this.handle) return null;
    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE);
      const f = await file.getFile();
      const raw = JSON.parse(await f.text()) as Record<string, unknown>;
      return normalizeWorkspaceManifest(raw);
    } catch {
      return null;
    }
  }

  async loadWorkspace(): Promise<WorkspacePayload | null> {
    const manifest = await this.readManifest();
    if (!manifest) return null;

    const diagrams = await this._scanAllDiagrams(this.handle!);

    let activeDiagramId = manifest.activeDiagramId;
    if (activeDiagramId && !diagrams[activeDiagramId]) {
      activeDiagramId = Object.keys(diagrams)[0] ?? null;
    }

    return {
      diagrams,
      services: manifest.services,
      folders: manifest.folders,
      activeDiagramId,
      manifestUpdatedAt: manifest.updatedAt,
      elementPresets: readElementPresetsField(manifest),
      iconLibrary: manifest.iconLibrary,
    };
  }

  async scanWorkspace(): Promise<WorkspaceScanResult> {
    if (!this.handle) throw new Error("No folder connected");

    const result: WorkspaceScanResult = {
      valid: [],
      invalid: [],
      manifest: null,
      manifestError: null,
      totalFilesScanned: 0,
    };

    await this._scanDirectory(this.handle, result);
    return result;
  }

  private async _scanDirectory(
    dir: FileSystemDirectoryHandle,
    result: WorkspaceScanResult,
    depth = 0,
  ): Promise<void> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) return;

    for await (const [name, entry] of directoryEntries(dir)) {
      if (entry.kind === FileSystemEntryKind.File && name.endsWith(".json")) {
        result.totalFilesScanned++;
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          const text = await f.text();

          let raw: unknown;
          try {
            raw = JSON.parse(text);
          } catch {
            result.invalid.push({
              fileName: name,
              reason: i18n.t("workspaceMerge.errors.invalidJson"),
            });
            continue;
          }

          if (name === MANIFEST_FILE) {
            const mv = validateManifest(raw);
            if (mv.valid === true) {
              result.manifest = mv.manifest;
            } else {
              result.manifestError = mv.reason;
            }
            continue;
          }

          const dv = validateDiagramFile(raw);
          if (dv.valid === true) {
            result.valid.push(dv.diagram);
          } else {
            result.invalid.push({ fileName: name, reason: dv.reason });
          }
        } catch (e) {
          result.invalid.push({
            fileName: name,
            reason: i18n.t("workspaceMerge.errors.readFile", {
              message: e instanceof Error ? e.message : i18n.t("workspaceMerge.errors.unknown"),
            }),
          });
        }
      }

      if (entry.kind === FileSystemEntryKind.Directory) {
        await this._scanDirectory(entry as FileSystemDirectoryHandle, result, depth + 1);
      }
    }
  }

  private async _scanAllDiagrams(
    dir: FileSystemDirectoryHandle,
    depth = 0,
  ): Promise<Record<string, Diagram>> {
    if (depth > MAX_DIRECTORY_SCAN_DEPTH) {
      return {};
    }
    const result: Record<string, Diagram> = {};
    for await (const [name, entry] of directoryEntries(dir)) {
      if (
        entry.kind === FileSystemEntryKind.File &&
        name.endsWith(".json") &&
        name !== MANIFEST_FILE
      ) {
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          const rawUnknown: unknown = JSON.parse(await f.text());
          if (isDiagramTombstoneJson(rawUnknown)) continue;
          const validation = validateDiagramFile(rawUnknown);
          if (validation.valid && validation.diagram.id) {
            result[validation.diagram.id] = validation.diagram;
          }
        } catch (error) {
          console.warn(
            "[StructuraContext] FileSystemAdapter scan diagram file skipped",
            name,
            error,
          );
        }
      }
      if (entry.kind === FileSystemEntryKind.Directory) {
        const nested = await this._scanAllDiagrams(entry as FileSystemDirectoryHandle, depth + 1);
        Object.assign(result, nested);
      }
    }
    return result;
  }
}

export const fileSystemAdapter = new FileSystemAdapter();
