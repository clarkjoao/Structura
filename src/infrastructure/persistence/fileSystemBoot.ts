

import { useDiagramStore, VIEWPORT_DEBOUNCE_MS, PERSIST_KEY, type Diagram, type IconDefinition } from "@/features/diagram";
import { useJourneyStore } from "@/features/journeys";
import { fileSystemAdapter } from "./FileSystemAdapter";
import { clearLocalStorageDiagramSyncTimestamp } from "./localStorageSyncTimestamp";
import {
  clearFolderSyncTimestamp,
  recordFolderSyncSuccess,
} from "./folderSyncTimestamp";
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


export function hydrateIconStoreFromWorkspace(workspace: WorkspaceIconSource): void {
  try {
    if (workspace.iconLibrary) {
      useIconStore.setState((state) => ({
        icons: { ...workspace.iconLibrary, ...state.icons },
      }));
    }
  } catch {
    
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
    
  }
}


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

  const journeys = useJourneyStore.getState().journeys;
  await fileSystemAdapter.writeJourneys(journeys);

  recordFolderSyncSuccess();
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


export function startFileSystemSync(): void {
  if (_syncUnsub) return; 

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

        const journeys = useJourneyStore.getState().journeys;
        await fileSystemAdapter.writeJourneys(journeys);

        recordFolderSyncSuccess();
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

  const journeyUnsubscribe = useJourneyStore.subscribe(() => {
    const currentDiagramState = useDiagramStore.getState();
    scheduleWorkspaceWrite(currentDiagramState, currentDiagramState);
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
}


export function resetBootState(): void {
  _reconnected = false;
  _reconnecting = null;
  stopFileSystemSync();
  clearFolderSyncTimestamp();
}

export type ForceSaveToFolderResult = "ok" | "no_folder" | "error";


export async function forceSaveToConnectedFolder(): Promise<ForceSaveToFolderResult> {
  if (!fileSystemAdapter.isConnected) return "no_folder";
  try {
    await flushWorkspaceToConnectedFolder(useDiagramStore.getState());
    return "ok";
  } catch {
    return "error";
  }
}
