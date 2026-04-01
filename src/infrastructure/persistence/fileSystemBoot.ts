/**
 * Singleton module that manages the file-system connection lifecycle.
 *
 * The reconnection attempt and the store subscription for syncing run
 * **once** for the entire app lifetime — they are NOT tied to any React
 * component mount/unmount cycle.  React hooks (`useFileSystemStorage`,
 * `useFileSystemSync`) simply read/drive this global state.
 */

import { useDiagramStore, VIEWPORT_DEBOUNCE_MS, PERSIST_KEY, type Diagram, type IconDefinition } from "@/features/diagram";
import { fileSystemAdapter } from "./FileSystemAdapter";
import { defaultStorage } from "./LocalStorageAdapter";
import { useCustomComponentStore, type CustomComponentTemplate } from "@/features/custom-components";
import { useIconStore } from "@/features/icons";

type DiagramStoreState = ReturnType<typeof useDiagramStore.getState>;

function mergeTemplates(
  local: Record<string, CustomComponentTemplate>,
  remote: Record<string, CustomComponentTemplate>,
): Record<string, CustomComponentTemplate> {
  const result = { ...local };
  for (const [id, remoteTemplate] of Object.entries(remote)) {
    const localTemplate = result[id];
    if (!localTemplate || remoteTemplate.updatedAt > localTemplate.updatedAt) {
      result[id] = remoteTemplate;
    }
  }
  return result;
}

export interface WorkspaceIconSource {
  diagrams: Record<string, Diagram>;
  iconLibrary?: Record<string, IconDefinition>;
}

/**
 * Merges manifest `iconLibrary` into the global icon store (existing store entries win),
 * then moves any per-diagram `snapshot.iconLibrary` entries into the global store and clears them.
 * Safe to call multiple times; failures are swallowed so FS / UI flows are not blocked.
 */
export function hydrateIconStoreFromWorkspace(workspace: WorkspaceIconSource): void {
  try {
    if (workspace.iconLibrary) {
      useIconStore.setState((state) => ({
        icons: { ...workspace.iconLibrary, ...state.icons },
      }));
    }
  } catch {
    // Icon store not ready — do not block caller.
  }

  try {
    for (const diagram of Object.values(workspace.diagrams)) {
      const library = diagram.snapshot?.iconLibrary ?? {};
      if (Object.keys(library).length === 0) {
        continue;
      }
      const globalIcons = useIconStore.getState().icons;
      for (const [iconId, icon] of Object.entries(library)) {
        if (!globalIcons[iconId]) {
          useIconStore.getState().addIcon(icon as IconDefinition);
        }
      }
      diagram.snapshot.iconLibrary = {};
    }
  } catch {
    // Do not block caller.
  }
}

/**
 * Writes every diagram, folders, and manifest to the connected folder.
 * Used after merge/overwrite so local-only or unchanged-reference diagrams are not skipped
 * (the debounced subscriber only writes when `diagram !== prevDiagrams[id]`).
 */
export async function flushWorkspaceToConnectedFolder(
  state: DiagramStoreState,
): Promise<void> {
  if (!fileSystemAdapter.isConnected) return;

  fileSystemAdapter.setFolders(state.folders);

  for (const diagram of Object.values(state.diagrams)) {
    await fileSystemAdapter.writeDiagram(diagram);
  }

  const customComponentTemplates = useCustomComponentStore.getState().templates;

  const iconLibrary = useIconStore.getState().icons;

  await fileSystemAdapter.writeManifest({
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
}

// ── Global state ──

let _reconnected = false;
let _reconnecting: Promise<boolean> | null = null;

/** Has the one-time silent reconnect already completed? */
export function hasReconnected(): boolean {
  return _reconnected;
}

/** Returns the in-flight reconnect promise (if any). */
export function getReconnectPromise(): Promise<boolean> | null {
  return _reconnecting;
}

// ── One-time silent reconnect ──

async function clearLocalCache(): Promise<void> {
  await defaultStorage.delete(PERSIST_KEY);
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
      useDiagramStore.setState((s) => ({
        ...s,
        diagrams: workspace.diagrams as typeof s.diagrams,
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
          templates: mergeTemplates(state.templates, workspaceTemplates),
        }));
      }

      hydrateIconStoreFromWorkspace(workspace);
    }
    await clearLocalCache();

    _reconnected = true;
    return true;
  } catch {
    _reconnected = true;
    return false;
  }
}

/**
 * Trigger the one-time silent reconnect.  Safe to call multiple times —
 * subsequent calls return the same promise.
 */
export function bootFileSystem(): Promise<boolean> {
  if (!_reconnecting) {
    _reconnecting = doReconnect();
  }
  return _reconnecting;
}

// ── Singleton store → disk sync subscription ──

let _syncUnsub: (() => void) | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start listening for store changes and writing them to the connected folder.
 * Idempotent — calling it multiple times does NOT create duplicate subscriptions.
 */
export function startFileSystemSync(): void {
  if (_syncUnsub) return; // already running

  const scheduleWorkspaceWrite = (
    diagramState: DiagramStoreState,
    previousDiagramState: DiagramStoreState,
  ): void => {
    if (!fileSystemAdapter.isConnected) return;

    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      try {
        fileSystemAdapter.setFolders(diagramState.folders);

        const prevDiagrams = previousDiagramState.diagrams;
        for (const [id, previousDiagram] of Object.entries(prevDiagrams)) {
          if (!diagramState.diagrams[id]) {
            fileSystemAdapter.setFolders(previousDiagramState.folders);
            await fileSystemAdapter.deleteDiagram(id, previousDiagram);
          }
        }

        fileSystemAdapter.setFolders(diagramState.folders);
        for (const [id, diagram] of Object.entries(diagramState.diagrams)) {
          if (diagram !== prevDiagrams[id]) {
            await fileSystemAdapter.writeDiagram(diagram);
          }
        }

        const customComponentTemplates = useCustomComponentStore.getState().templates;
        const iconLibrary = useIconStore.getState().icons;

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
      } catch (error) {
        console.error("[FileSystemSync] write failed:", error);
      }
    }, VIEWPORT_DEBOUNCE_MS);
  };

  const diagramUnsubscribe = useDiagramStore.subscribe((state, prevState) => {
    scheduleWorkspaceWrite(state, prevState);
  });

  const customComponentUnsubscribe = useCustomComponentStore.subscribe(() => {
    const currentDiagramState = useDiagramStore.getState();
    scheduleWorkspaceWrite(currentDiagramState, currentDiagramState);
  });

  const iconLibraryUnsubscribe = useIconStore.subscribe(() => {
    const currentDiagramState = useDiagramStore.getState();
    scheduleWorkspaceWrite(currentDiagramState, currentDiagramState);
  });

  _syncUnsub = () => {
    diagramUnsubscribe();
    customComponentUnsubscribe();
    iconLibraryUnsubscribe();
  };
}

/** Stop the sync subscription (called on disconnect). */
export function stopFileSystemSync(): void {
  if (_syncUnsub) {
    _syncUnsub();
    _syncUnsub = null;
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
}

/**
 * Reset internal state (used after a manual disconnect so that
 * `bootFileSystem` can re-run when the user connects a new folder).
 */
export function resetBootState(): void {
  _reconnected = false;
  _reconnecting = null;
  stopFileSystemSync();
}
