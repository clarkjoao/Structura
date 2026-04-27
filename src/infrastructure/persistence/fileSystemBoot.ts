

import { useDiagramStore, VIEWPORT_DEBOUNCE_MS, PERSIST_KEY, type Diagram, type IconDefinition } from "@/features/diagram";
import { useJourneyStore } from "@/features/journeys";
import { fileSystemAdapter, type WorkspacePayload } from "./FileSystemAdapter";
import { clearLocalStorageDiagramSyncTimestamp } from "./localStorageSyncTimestamp";
import {
  clearFolderSyncTimestamp,
  recordFolderSyncSuccess,
} from "./folderSyncTimestamp";
import { defaultStorage } from "./LocalStorageAdapter";
import { useCustomComponentStore, type CustomComponentTemplate } from "@/features/custom-components";
import { useIconStore } from "@/features/icons";
import { mergeCustomComponentTemplates } from "./merge-custom-component-templates";
import { diagramStoreWorkspaceEqualsForFolderSync } from "./workspace-folder-sync-equality";
import { manifestSemanticFingerprint } from "./workspace-manifest-fingerprint";

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
  let max = Date.parse(workspace.manifestUpdatedAt);
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


export async function flushWorkspaceToConnectedFolder(
  state: DiagramStoreState,
): Promise<boolean> {
  if (!fileSystemAdapter.isConnected) return false;

  fileSystemAdapter.setFolders(state.folders);

  const diagramWrites = await Promise.all(
    Object.values(state.diagrams).map((diagram) => fileSystemAdapter.writeDiagram(diagram)),
  );
  if (diagramWrites.some((ok) => !ok)) return false;

  const customComponentTemplates = useCustomComponentStore.getState().templates;

  const iconLibrary = useIconStore.getState().icons;

  const manifestOk = await fileSystemAdapter.writeManifest({
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: Object.keys(state.diagrams),
    serviceRegistry: state.serviceRegistry,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    customComponentTemplates,
    iconLibrary,
  });
  if (!manifestOk) return false;

  const journeys = useJourneyStore.getState().journeys;
  const journeysOk = await fileSystemAdapter.writeJourneys(journeys);
  if (!journeysOk) return false;

  lastSyncedManifestFingerprint = manifestSemanticFingerprint({
    diagramIds: Object.keys(state.diagrams),
    serviceRegistry: state.serviceRegistry,
    folders: state.folders,
    activeDiagramId: state.activeDiagramId,
    customComponentTemplates,
    iconLibrary,
  });
  lastSyncedJourneysJson = JSON.stringify(journeys);

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

    defaultStorage.paused = true;
    fileSystemAdapter.setFolders(useDiagramStore.getState().folders);

    const workspace = await fileSystemAdapter.loadWorkspace();
    if (workspace) {
      const current = useDiagramStore.getState();
      const memLatest = latestMsFromStore(current);
      const fsLatest = latestMsFromWorkspacePayload(workspace);
      if (memLatest > fsLatest) {
        const flushed = await flushWorkspaceToConnectedFolder(current);
        if (flushed) {
          await clearLocalCache();
        }
        _reconnected = true;
        return true;
      }

      const hydrated = hydrateIconStoreFromWorkspace(workspace);
      useDiagramStore.setState((s) => ({
        ...s,
        diagrams: hydrated.diagrams as typeof s.diagrams,
        serviceRegistry: workspace.serviceRegistry as typeof s.serviceRegistry,
        folders: workspace.folders as typeof s.folders,
        activeDiagramId: workspace.activeDiagramId,
        past: [],
        future: [],
      }));
      fileSystemAdapter.setFolders(
        workspace.folders as unknown as DiagramStoreState["folders"],
      );

      const workspaceTemplates: Record<string, CustomComponentTemplate> | undefined =
        workspace.customComponentTemplates;
      if (workspaceTemplates) {
        useCustomComponentStore.setState((state) => ({
          templates: mergeCustomComponentTemplates(state.templates, workspaceTemplates),
        }));
      }

      const fsJourneys = await fileSystemAdapter.readJourneys();
      if (fsJourneys) {
        useJourneyStore.setState((state) => ({
          journeys: { ...state.journeys, ...fsJourneys },
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



let _syncUnsub: (() => void) | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _flushChain: Promise<void> = Promise.resolve();
let lastFlushedDiagrams: Record<string, Diagram> = {};
/** Path segments captured at the last flush, keyed by diagramId. Used to detect moves. */
let lastFlushedPathSegments: Record<string, string[]> = {};
/** Skips redundant structura-manifest.json writes during incremental sync (reset in stopFileSystemSync). */
let lastSyncedManifestFingerprint = "";
let lastSyncedJourneysJson = "";


export function startFileSystemSync(): void {
  stopFileSystemSync();

  const initialDiagrams = useDiagramStore.getState().diagrams;
  lastFlushedDiagrams = { ...initialDiagrams };
  lastFlushedPathSegments = {};
  for (const [id, diagram] of Object.entries(initialDiagrams)) {
    lastFlushedPathSegments[id] = fileSystemAdapter.computePathSegments(diagram);
  }

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
          const diagramState = useDiagramStore.getState();
          const prevDiagrams = lastFlushedDiagrams;
          const prevPathSegments = lastFlushedPathSegments;

          // Snapshot old path segments BEFORE updating adapter's folder state,
          // so we can resolve the old file location for moves and deletes.
          const oldSegments: Record<string, string[]> = { ...prevPathSegments };

          fileSystemAdapter.setFolders(diagramState.folders);

          let wroteSomething = false;

          // Delete files for diagrams removed from the store entirely.
          const deletePromises = Object.entries(prevDiagrams)
            .filter(([id]) => !diagramState.diagrams[id])
            .map(([id]) =>
              fileSystemAdapter.deleteAtSegments(id, oldSegments[id] ?? []).then(() => {
                wroteSomething = true;
              }),
            );
          await Promise.all(deletePromises);

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
              await fileSystemAdapter.deleteAtSegments(id, prev);
              wroteSomething = true;
            }
          }

          const diagramsToWrite = Object.entries(diagramState.diagrams).filter(
            ([id, diagram]) => movedIds.has(id) || diagram !== prevDiagrams[id],
          );
          if (diagramsToWrite.length > 0) {
            await Promise.all(diagramsToWrite.map(([, diagram]) => fileSystemAdapter.writeDiagram(diagram)));
            wroteSomething = true;
          }

          const customComponentTemplates = useCustomComponentStore.getState().templates;
          const iconLibrary = useIconStore.getState().icons;

          const manifestFp = manifestSemanticFingerprint({
            diagramIds: Object.keys(diagramState.diagrams),
            serviceRegistry: diagramState.serviceRegistry,
            folders: diagramState.folders,
            activeDiagramId: diagramState.activeDiagramId,
            customComponentTemplates,
            iconLibrary,
          });

          if (manifestFp !== lastSyncedManifestFingerprint) {
            await fileSystemAdapter.writeManifest({
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              diagramIds: Object.keys(diagramState.diagrams),
              serviceRegistry: diagramState.serviceRegistry,
              folders: diagramState.folders,
              activeDiagramId: diagramState.activeDiagramId,
              customComponentTemplates,
              iconLibrary,
            });
            lastSyncedManifestFingerprint = manifestFp;
            wroteSomething = true;
          }

          const journeys = useJourneyStore.getState().journeys;
          const journeysJson = JSON.stringify(journeys);
          if (journeysJson !== lastSyncedJourneysJson) {
            await fileSystemAdapter.writeJourneys(journeys);
            lastSyncedJourneysJson = journeysJson;
            wroteSomething = true;
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
        });
    }, VIEWPORT_DEBOUNCE_MS);
  };

  const diagramUnsubscribe = useDiagramStore.subscribe((state, prevState) => {
    if (diagramStoreWorkspaceEqualsForFolderSync(state, prevState)) return;
    runDebouncedFlush();
  });

  const customComponentUnsubscribe = useCustomComponentStore.subscribe(() => {
    runDebouncedFlush();
  });

  const iconLibraryUnsubscribe = useIconStore.subscribe(() => {
    runDebouncedFlush();
  });

  const journeyUnsubscribe = useJourneyStore.subscribe(() => {
    runDebouncedFlush();
  });

  _syncUnsub = () => {
    diagramUnsubscribe();
    customComponentUnsubscribe();
    iconLibraryUnsubscribe();
    journeyUnsubscribe();
  };
}


export function stopFileSystemSync(): void {
  if (_syncUnsub) {
    _syncUnsub();
    _syncUnsub = null;
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  lastSyncedManifestFingerprint = "";
  lastSyncedJourneysJson = "";
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
