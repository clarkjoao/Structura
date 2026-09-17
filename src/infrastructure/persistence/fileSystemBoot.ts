import {
  useDiagramStore,
  VIEWPORT_DEBOUNCE_MS,
  PERSIST_KEY,
  type Diagram,
  type IconDefinition,
} from "@/features/diagram";
import {
  fileSystemAdapter,
  type FileSystemDirectoryHandleWithPermissions,
  type WorkspacePayload,
  type WorkspaceScanResult,
} from "./FileSystemAdapter";
import { clearLocalStorageDiagramSyncTimestamp } from "./localStorageSyncTimestamp";
import { clearFolderSyncTimestamp, recordFolderSyncSuccess } from "./folderSyncTimestamp";
import { defaultStorage } from "./LocalStorageAdapter";
import { useElementPresetStore } from "@/features/element-presets";
import { useIconStore } from "@/features/diagram/store";
import { mergeElementPresets } from "./merge-element-presets";
import { readElementPresetsField } from "./read-element-presets-field";
import { diagramStoreWorkspaceEqualsForFolderSync } from "./workspace-folder-sync-equality";
import { manifestSemanticFingerprint } from "./workspace-manifest-fingerprint";
import { WORKSPACE_SCHEMA_VERSION } from "./versions";
import { toast } from "sonner";
import i18n from "@/infrastructure/i18n";
import {
  openWorkspaceBroadcast,
  closeWorkspaceBroadcast,
  broadcastManifestChanged,
} from "./workspaceBroadcast";
import type { StagedDiagramWrite } from "./stagedDiagramWrite";

type DiagramStoreState = ReturnType<typeof useDiagramStore.getState>;

function parseTimestampMs(timestamp: number | undefined): number {
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return 0;
  return timestamp;
}

function latestMsFromStore(state: DiagramStoreState): number {
  let max = 0;
  for (const diagram of Object.values(state.diagrams)) {
    max = Math.max(max, parseTimestampMs(diagram.updatedAt));
  }
  return max;
}

function latestMsFromWorkspacePayload(workspace: WorkspacePayload): number {
  let max = workspace.manifestUpdatedAt ? Date.parse(workspace.manifestUpdatedAt) : 0;
  for (const diagram of Object.values(workspace.diagrams)) {
    max = Math.max(max, parseTimestampMs(diagram.updatedAt));
  }
  return max;
}

export interface WorkspaceIconSource {
  diagrams: Record<string, Diagram>;
  iconLibrary?: Record<string, IconDefinition>;
}

/**
 * Moves embedded diagram icons into the global icon store and returns a copy of
 * `workspace` with per-diagram `iconLibrary` cleared (no in-place mutation).
 */
export function hydrateIconStoreFromWorkspace(workspace: WorkspaceIconSource): WorkspaceIconSource {
  try {
    if (workspace.iconLibrary) {
      useIconStore.setState((state) => ({
        icons: { ...workspace.iconLibrary, ...state.icons },
      }));
    }
  } catch {
    // ignore
  }

  try {
    const nextDiagrams: Record<string, Diagram> = {};
    for (const [id, diagram] of Object.entries(workspace.diagrams)) {
      const library = diagram.snapshot?.iconLibrary ?? {};
      if (Object.keys(library).length === 0) {
        nextDiagrams[id] = diagram;
        continue;
      }
      const globalIcons = useIconStore.getState().icons;
      for (const [iconId, icon] of Object.entries(library)) {
        if (!globalIcons[iconId]) {
          useIconStore.getState().addIcon(icon as IconDefinition);
        }
      }
      nextDiagrams[id] = {
        ...diagram,
        snapshot: { ...diagram.snapshot, iconLibrary: {} },
      };
    }
    return { ...workspace, diagrams: nextDiagrams };
  } catch {
    return workspace;
  }
}

export async function flushWorkspaceToConnectedFolder(state: DiagramStoreState): Promise<boolean> {
  if (!fileSystemAdapter.isConnected) return false;

  fileSystemAdapter.setFolders(state.folders);

  // Phase 1 (Prepare): Write all diagrams to .tmp files
  const stagedWrites: StagedDiagramWrite[] = [];
  for (const diagram of Object.values(state.diagrams)) {
    const staged = await fileSystemAdapter.writeDiagramStaged(diagram);
    if (!staged) {
      // Rollback any diagrams that were already written to .tmp
      await fileSystemAdapter.rollbackStagedDiagrams(stagedWrites);
      return false;
    }
    stagedWrites.push(staged);
  }

  const elementPresets = useElementPresetStore.getState().presets;

  const iconLibrary = useIconStore.getState().icons;

  // Phase 2 (Commit): Write manifest
  const manifestOk = await fileSystemAdapter.writeManifestWithRetry({
    version: WORKSPACE_SCHEMA_VERSION as 1 | 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: Object.keys(state.diagrams),
    serviceCatalog: state.serviceCatalog,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    elementPresets,
    iconLibrary,
  });

  if (!manifestOk) {
    // Rollback: delete .tmp files since manifest failed
    await fileSystemAdapter.rollbackStagedDiagrams(stagedWrites);
    return false;
  }

  // Commit: rename .tmp → .json
  const commitOk = await fileSystemAdapter.commitStagedDiagrams(stagedWrites);
  if (!commitOk) {
    // Commit partially failed - this is a serious inconsistency
    // The manifest references diagrams that may not exist
    console.error("[FileSystemBoot] Partial commit failure - manifest references may be invalid");
    // Don't rollback - some diagrams may have been committed
    // The next sync will detect and fix this
  }

  lastSyncedManifestFingerprint = manifestSemanticFingerprint({
    diagramIds: Object.keys(state.diagrams),
    serviceCatalog: state.serviceCatalog,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    elementPresets,
    iconLibrary,
  });

  recordFolderSyncSuccess();

  return true;
}

let _reconnected = false;
let _reconnecting: Promise<boolean> | null = null;

export function hasReconnected(): boolean {
  return _reconnected;
}

export function getReconnectPromise(): Promise<boolean> | null {
  return _reconnecting;
}

async function clearLocalCache(): Promise<void> {
  await defaultStorage.delete(PERSIST_KEY);
  clearLocalStorageDiagramSyncTimestamp();
}

async function doReconnect(): Promise<boolean> {
  if (_reconnected) return fileSystemAdapter.isConnected;

  const isSupported = "showDirectoryPicker" in globalThis;
  if (!isSupported) {
    _reconnected = true;
    return false;
  }

  try {
    const ok = await fileSystemAdapter.tryReconnect();
    if (!ok) {
      _reconnected = true;
      return false;
    }

    fileSystemAdapter.setFolders(useDiagramStore.getState().folders);

    const workspace = await fileSystemAdapter.loadWorkspace();
    if (workspace) {
      const current = useDiagramStore.getState();
      const memLatest = latestMsFromStore(current);
      const fsLatest = latestMsFromWorkspacePayload(workspace);
      if (memLatest > fsLatest) {
        // Conflict: in-memory store has newer edits than what's on disk.
        // Previously this path silently flushed the in-memory state to the
        // folder, which could destroy work the user did offline. Instead,
        // hand the scan off to the UI so the same merge/overwrite dialog
        // used during a fresh connect can surface the conflict.
        try {
          const scan = await fileSystemAdapter.scanWorkspace();
          resolveBootScan(scan);
        } catch (error) {
          console.warn("[Structura] boot conflict scan failed; falling back to fresh load", error);
        }
        _reconnected = true;
        return true;
      }

      const hydrated = hydrateIconStoreFromWorkspace(workspace);
      // Deliberately no orphan-folder reparenting here. `manifest.folders` is not validated
      // (`validateManifest` only checks `version` and `diagramIds`), so it can be absent —
      // and treating "unknown folder map" as "no folders exist" would strip every
      // `folderId` and make the sync rewrite those diagram files to the workspace root on
      // the user's disk. Import-time sanitisation plus the persisted-state migration cover
      // the orphan case without touching a connected folder.
      useDiagramStore.setState((s) => ({
        ...s,
        diagrams: hydrated.diagrams as typeof s.diagrams,
        serviceCatalog: workspace.serviceCatalog as typeof s.serviceCatalog,
        folders: workspace.folders as typeof s.folders,
        activeDiagramId: workspace.activeDiagramId,
        past: [],
        future: [],
      }));
      fileSystemAdapter.setFolders(workspace.folders as unknown as DiagramStoreState["folders"]);

      const workspaceTemplates = readElementPresetsField(workspace);
      if (workspaceTemplates) {
        useElementPresetStore.setState((state) => ({
          presets: mergeElementPresets(state.presets, workspaceTemplates),
        }));
      }
    }
    await clearLocalCache();

    _reconnected = true;
    return true;
  } catch {
    _reconnected = true;
    return false;
  }
}

export function bootFileSystem(): Promise<boolean> {
  if (!_reconnecting) {
    _reconnecting = doReconnect();
  }
  return _reconnecting;
}

/**
 * Bridge between the boot-time conflict path in {@link doReconnect} and the UI.
 *
 * When boot detects that the in-memory store has newer diagrams than the
 * folder, we cannot silently flush (it would overwrite offline edits without
 * confirmation). Instead, {@link doReconnect} calls {@link resolveBootScan}
 * with the scanned folder contents; {@link awaitBootScan} exposes that scan
 * to {@link useFileSystemStorage}, which surfaces it via the same
 * WorkspaceMergeDialog used during a fresh connect.
 *
 * Only one boot-conflict can be in flight at a time. A second caller before
 * the first resolves will see its promise resolved with `null` immediately.
 */
let _bootScanResolver: ((scan: WorkspaceScanResult | null) => void) | null = null;

export function awaitBootScan(): Promise<WorkspaceScanResult | null> {
  return new Promise((resolve) => {
    _bootScanResolver = resolve;
  });
}

export function resolveBootScan(scan: WorkspaceScanResult | null): void {
  _bootScanResolver?.(scan);
  _bootScanResolver = null;
}

// ─── Bidirectional Folder Sync ────────────────────────────────────────────────

export interface FolderSyncResult {
  foldersCreatedInStore: string[];
  directoriesCreated: string[];
  directoriesDeleted: string[];
}

/**
 * Synchronizes folder structure between filesystem and Zustand store.
 *
 * Trust model:
 *   - The `structura-manifest.json` file is the source of truth for folder IDs
 *     and names. We only read directory names from the FS to detect folders
 *     that are NOT yet in the store AND NOT in the manifest.
 *   - For directories whose name already matches a known folder ID, we do
 *     nothing — the folder is already represented in the store or in the
 *     manifest. Creating a new folder from a directory name would generate a
 *     fresh ID and orphan the original directory on the next write.
 *
 * This function:
 *   1. Scans directories in the filesystem
 *   2. Compares with store folders
 *   3. Creates directories for folders in store that don't have them
 *   4. Logs (but does NOT auto-create) folders for unknown directories —
 *      those need a manifest entry to be imported safely.
 */
export async function syncFoldersFromFilesystem(): Promise<FolderSyncResult | null> {
  if (!fileSystemAdapter.isConnected) return null;

  const result: FolderSyncResult = {
    foldersCreatedInStore: [],
    directoriesCreated: [],
    directoriesDeleted: [],
  };

  try {
    // Get current folder state from store
    const storeFolderIds = new Set(Object.keys(useDiagramStore.getState().folders));

    // Scan filesystem for directories
    const fsFolderIds = await fileSystemAdapter.scanDirectoryStructure();

    // Find directories in FS that don't have folders in store.
    // We do NOT auto-import them — the directory name is not necessarily the
    // folder ID. If the user wants to import a folder that was created outside
    // the app, the manifest must reference it first. We log so this is visible
    // in dev tools.
    const unknownDirs: string[] = [];
    for (const folderId of fsFolderIds) {
      if (!storeFolderIds.has(folderId)) {
        unknownDirs.push(folderId);
      }
    }

    // Find folders in store that don't have directories in FS
    // Create directories for them
    for (const folderId of storeFolderIds) {
      if (!fsFolderIds.has(folderId)) {
        const created = await fileSystemAdapter.createDirectory(folderId);
        if (created) {
          result.directoriesCreated.push(folderId);
        }
      }
    }

    // Log results
    if (unknownDirs.length > 0) {
      console.info(
        `[FileSystemBoot] Found ${unknownDirs.length} directories on disk without a matching store folder (skipped — manifest must reference them first):`,
        unknownDirs,
      );
    }
    if (result.directoriesCreated.length > 0) {
      console.info(
        `[FileSystemBoot] Created ${result.directoriesCreated.length} directories in filesystem:`,
        result.directoriesCreated,
      );
    }

    return result;
  } catch (e) {
    console.warn("[FileSystemBoot] syncFoldersFromFilesystem failed:", e);
    return null;
  }
}

let _syncUnsub: (() => void) | null = null;
let _folderWatcherCleanup: (() => void) | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _flushChain: Promise<void> = Promise.resolve();
let lastFlushedDiagrams: Record<string, Diagram> = {};
/** Path segments captured at the last flush, keyed by diagramId. Used to detect moves. */
let lastFlushedPathSegments: Record<string, string[]> = {};
/** Skips redundant structura-manifest.json writes during incremental sync (reset in stopFileSystemSync). */
let lastSyncedManifestFingerprint = "";

/** Module-level listener set by useFileSystemStorage to be notified of remote tab changes. */
let _onRemoteTabWrite: (() => void) | null = null;

/**
 * Called by useFileSystemStorage to register a handler that fires when another tab
 * successfully writes to the workspace. The handler should trigger a merge check.
 */
export function setOnRemoteTabWrite(cb: (() => void) | null): void {
  _onRemoteTabWrite = cb;
}

/** Returns the fingerprint of the last manifest that was successfully synced to disk. */
export function getLastSyncedManifestFingerprint(): string {
  return lastSyncedManifestFingerprint;
}

export function startFileSystemSync(): void {
  stopFileSystemSync();

  const initialDiagrams = useDiagramStore.getState().diagrams;
  lastFlushedDiagrams = { ...initialDiagrams };
  lastFlushedPathSegments = {};
  for (const [id, diagram] of Object.entries(initialDiagrams)) {
    lastFlushedPathSegments[id] = fileSystemAdapter.computePathSegments(diagram);
  }

  // Open BroadcastChannel so this tab can receive writes from other tabs.
  const workspacePath = fileSystemAdapter.folderName ?? "";
  if (workspacePath) {
    openWorkspaceBroadcast(workspacePath, () => {
      _onRemoteTabWrite?.();
    });
  }

  // ─── Folder Change Watcher ─────────────────────────────────────────────────
  // Folder changes in the store are written to disk by the regular diagram
  // flush path: `resolveDiagramPathSegments` rebuilds the path from the folder
  // ID at write time, so a folder created in the UI gets a directory the next
  // time a diagram is written into it. We deliberately do NOT subscribe to
  // `state.folders` here — a prior version did, and it interacted badly with
  // the store-level debounced flush (every folder change re-queued the flush,
  // every flush re-walked folders), which surfaced as React Flow's
  // `StoreUpdater` repeatedly calling `setNodes` until React aborted with
  // "Maximum update depth exceeded".
  //
  // Cleanup of the previous subscription is kept as a no-op for callers that
  // still invoke it; new code should rely on the flush path.
  void _folderWatcherCleanup;
  void _syncUnsub;

  /**
   * Debounced folder sync runs in parallel with Zustand persist (PERSIST_DEBOUNCE_MS in
   * persist.config.ts). Both are best-effort; ordering is not guaranteed by design.
   */
  const runDebouncedFlush = (): void => {
    if (!fileSystemAdapter.isConnected) return;

    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
      _flushChain = _flushChain
        .then(async () => {
          // Proactively check write permission before attempting any writes.
          // This surfaces permission loss (e.g. OS revoked it) before the
          // native API throws, so the UI can show an error banner immediately.
          try {
            const directoryHandle = fileSystemAdapter["handle"] as FileSystemDirectoryHandleWithPermissions | null;
            if (directoryHandle) {
              const state = await directoryHandle.queryPermission?.({ mode: "readwrite" });
              if (state !== "granted") {
                fileSystemAdapter["_hasPermissionError"] = true;
                fileSystemAdapter["_onPermissionError"]?.();
                return;
              }
            }
          } catch {
            // If we can't even query permission, treat it as an error.
            fileSystemAdapter["_hasPermissionError"] = true;
            fileSystemAdapter["_onPermissionError"]?.();
            return;
          }

          const diagramState = useDiagramStore.getState();
          const prevDiagrams = lastFlushedDiagrams;
          const prevPathSegments = lastFlushedPathSegments;

          // Snapshot old path segments BEFORE updating adapter's folder state,
          // so we can resolve the old file location for moves and deletes.
          const oldSegments: Record<string, string[]> = { ...prevPathSegments };

          fileSystemAdapter.setFolders(diagramState.folders);

          let wroteSomething = false;
          let deleteFailed = false;

          // Delete files for diagrams removed from the store entirely.
          const deletePromises = Object.entries(prevDiagrams)
            .filter(([id]) => !diagramState.diagrams[id])
            .map(([id]) =>
              fileSystemAdapter.deleteAtSegments(id, oldSegments[id] ?? []).then(() => {
                wroteSomething = true;
              }).catch(() => {
                deleteFailed = true;
              }),
            );
          await Promise.all(deletePromises);
          if (deleteFailed) {
            toast.error(i18n.t("filesystem.deleteFailed") as string);
          }

          // Detect moves: same diagram ID, but path segments changed.
          // Delete the old file first; the write loop below will create the new one.
          const movedIds = new Set<string>();
          for (const [id, diagram] of Object.entries(diagramState.diagrams)) {
            const prev = oldSegments[id];
            if (!prev) continue; // new diagram, not a move
            const curr = fileSystemAdapter.computePathSegments(diagram);
            const pathChanged =
              prev.length !== curr.length || prev.some((seg, i) => seg !== curr[i]);
            if (pathChanged) {
              movedIds.add(id);
              try {
                await fileSystemAdapter.deleteAtSegments(id, prev);
                wroteSomething = true;
              } catch {
                deleteFailed = true;
              }
            }
          }
          if (deleteFailed) {
            toast.error(i18n.t("filesystem.deleteFailed") as string);
          }

          const diagramsToWrite = Object.entries(diagramState.diagrams).filter(
            ([id, diagram]) => movedIds.has(id) || diagram !== prevDiagrams[id],
          );

          // Phase 1 (Prepare): Write changed diagrams to .tmp files
          const stagedWrites: StagedDiagramWrite[] = [];
          for (const [, diagram] of diagramsToWrite) {
            const staged = await fileSystemAdapter.writeDiagramStaged(diagram);
            if (!staged) {
              // Rollback any diagrams that were already written to .tmp
              await fileSystemAdapter.rollbackStagedDiagrams(stagedWrites);
              toast.error(
                i18n.t("filesystem.diagramWriteFailed", { count: 1 }) as string,
              );
              return;
            }
            stagedWrites.push(staged);
          }

          const elementPresets = useElementPresetStore.getState().presets;
          const iconLibrary = useIconStore.getState().icons;

          const manifestFp = manifestSemanticFingerprint({
            diagramIds: Object.keys(diagramState.diagrams),
            serviceCatalog: diagramState.serviceCatalog,
            folders: diagramState.folders,
            activeDiagramId: diagramState.activeDiagramId,
            elementPresets,
            iconLibrary,
          });

          if (manifestFp !== lastSyncedManifestFingerprint) {
            const manifest = {
              version: WORKSPACE_SCHEMA_VERSION as 1 | 2,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              diagramIds: Object.keys(diagramState.diagrams),
              serviceCatalog: diagramState.serviceCatalog,
              folders: diagramState.folders,
              activeDiagramId: diagramState.activeDiagramId,
              elementPresets,
              iconLibrary,
            };

            // Phase 2 (Commit): Write manifest
            const manifestOk = await fileSystemAdapter.writeManifestWithRetry(manifest);

            if (manifestOk) {
              // Commit: rename .tmp → .json
              const commitOk = await fileSystemAdapter.commitStagedDiagrams(stagedWrites);
              if (!commitOk) {
                // Partial commit - log but don't fail the sync
                // The manifest is valid and diagrams may be accessible
                console.warn("[FileSystemBoot] Partial commit - some diagrams may need retry");
              }

              lastSyncedManifestFingerprint = manifestFp;
              wroteSomething = true;
              // Notify other tabs that the manifest changed so they can re-check for conflicts.
              broadcastManifestChanged(fileSystemAdapter.folderName ?? "");
            } else {
              // Rollback: delete .tmp files since manifest failed
              await fileSystemAdapter.rollbackStagedDiagrams(stagedWrites);
              console.warn("[FileSystemBoot] Manifest write failed after retry — staged diagrams rolled back.");
              toast.error(i18n.t("filesystem.manifestWriteFailed") as string);
            }
          } else {
            // No manifest change needed, but we still need to commit the staged files
            // (they were written for moves/deletes that detected path changes)
            if (stagedWrites.length > 0) {
              const commitOk = await fileSystemAdapter.commitStagedDiagrams(stagedWrites);
              if (!commitOk) {
                console.warn("[FileSystemBoot] Commit failed for path changes");
              } else {
                wroteSomething = true;
              }
            }
          }

          if (wroteSomething) {
            recordFolderSyncSuccess();
          }

          lastFlushedDiagrams = { ...diagramState.diagrams };
          lastFlushedPathSegments = {};
          for (const [id, diagram] of Object.entries(diagramState.diagrams)) {
            lastFlushedPathSegments[id] = fileSystemAdapter.computePathSegments(diagram);
          }
        })
        .catch((error: unknown) => {
          console.error("[FileSystemSync] write failed:", error);
          // If this looks like a permission error (handle still exists but writes
          // failed), flag it so the UI surfaces a reconnect prompt.
          if (fileSystemAdapter["_hasPermissionError"]) {
            fileSystemAdapter["_onPermissionError"]?.();
          }
        });
    }, VIEWPORT_DEBOUNCE_MS);
  };

  const diagramUnsubscribe = useDiagramStore.subscribe((state, prevState) => {
    if (diagramStoreWorkspaceEqualsForFolderSync(state, prevState)) return;
    runDebouncedFlush();
  });

  const customComponentUnsubscribe = useElementPresetStore.subscribe(() => {
    runDebouncedFlush();
  });

  const iconLibraryUnsubscribe = useIconStore.subscribe(() => {
    runDebouncedFlush();
  });

  _syncUnsub = () => {
    diagramUnsubscribe();
    customComponentUnsubscribe();
    iconLibraryUnsubscribe();
  };
}

export function stopFileSystemSync(): void {
  closeWorkspaceBroadcast();
  if (_syncUnsub) {
    _syncUnsub();
    _syncUnsub = null;
  }
  if (_folderWatcherCleanup) {
    _folderWatcherCleanup();
    _folderWatcherCleanup = null;
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  lastSyncedManifestFingerprint = "";
  lastFlushedPathSegments = {};
}

export function resetBootState(): void {
  _reconnected = false;
  _reconnecting = null;
  stopFileSystemSync();
  _flushChain = Promise.resolve();
  clearFolderSyncTimestamp();
}

export type ForceSaveToFolderResult = "ok" | "no_folder" | "error";

export async function forceSaveToConnectedFolder(): Promise<ForceSaveToFolderResult> {
  if (!fileSystemAdapter.isConnected) return "no_folder";
  try {
    const flushed = await flushWorkspaceToConnectedFolder(useDiagramStore.getState());
    return flushed ? "ok" : "error";
  } catch {
    return "error";
  }
}
