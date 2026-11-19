import { create } from "zustand";
import type { StoreApi } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { workspaceStorage } from "@/infrastructure/persistence/workspaceStorage";
import type { IStoragePort } from "@/infrastructure/persistence/IStoragePort";
import { recordLocalStorageDiagramSyncSuccess } from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useIconStore, type IconStore } from "./icon-store";
import type { UserTemplate } from "../model/diagram.types";
import type { AppState, DiagramSnapshot, DiagramStore } from "./store.types";
import { createStableSlice } from "./stableSlice";
import {
  historySlice,
  componentsSlice,
  componentParentingSlice,
  componentLinksSlice,
  connectionsSlice,
  flowsSlice,
  layoutSlice,
  servicesSlice,
  clipboardSlice,
  diagramsSlice,
  foldersSlice,
  patternsSlice,
  generatedGraphSlice,
  versionsSlice,
  iconsSlice,
  userTemplatesSlice,
} from "./slices";
import { buildPersistStoragePayload, createPersistConfig, PERSIST_KEY } from "./persist.config";
import { loadSeedWorkspace, type FreshWorkspace } from "./seedWorkspace";

export type { AppState, DiagramSnapshot } from "./store.types";
export type { ClipboardEntry, DiagramStore } from "./store.types";

let settleHydration: (error?: unknown) => void = () => {};

/**
 * Resolves when the workspace store has read its persisted copy, or failed
 * to: the app renders only after it (openspec indexeddb-workspace-storage),
 * so nothing is shown or edited on an empty workspace that is about to load.
 */
export const diagramStoreHydrated = new Promise<void>((resolve) => {
  settleHydration = (error) => {
    if (error) console.error("[Structura] workspace could not be loaded", error);
    resolve();
  };
});

export function createDiagramStore(
  storage: IStoragePort = workspaceStorage,
  iconStoreOverride?: Pick<StoreApi<IconStore>, "getState">,
  onRehydrated?: (error?: unknown) => void,
  loadFreshWorkspace?: () => Promise<FreshWorkspace>,
) {
  const iconStore = iconStoreOverride ?? useIconStore;
  return create<import("./store.types").DiagramStore>()(
    persist(
      immer((set, get) => ({
        past: [] as DiagramSnapshot[],
        future: [] as DiagramSnapshot[],
        _lastUndoRedoAt: 0,
        _lastUndoRedoTimestamp: 0,
        _lastLayoutWriteAt: 0,
        _lastRemoteWriteAt: 0,
        _flowSession: null as { undoMark: number | null } | null,
        _flowSewNotices: null as AppState["_flowSewNotices"],
        _sharedRefNotice: null as AppState["_sharedRefNotice"],
        ...diagramsSlice(set, get as () => AppState),
        ...componentsSlice(set, get as () => AppState),
        ...componentParentingSlice(set, get as () => AppState),
        ...componentLinksSlice(set, get as () => AppState),
        ...connectionsSlice(set, get as () => AppState),
        ...flowsSlice(set, get as () => AppState),
        ...layoutSlice(set, get as () => AppState),
        ...servicesSlice(set, get as () => AppState),
        ...clipboardSlice(set, get as () => AppState),
        ...historySlice(set, get as () => AppState),
        ...foldersSlice(set, get as () => AppState),
        ...patternsSlice(set, get as () => AppState),
        ...generatedGraphSlice(set, get as () => AppState),
        ...versionsSlice(set, get as () => AppState),
        ...iconsSlice(set, get as () => AppState),
        ...userTemplatesSlice(set, get as () => AppState),
        addIcon: (_diagramId, icon) => {
          iconStore.getState().addIcon(icon);
        },
        removeIcon: (diagramId, iconId) => {
          iconStore.getState().removeIcon(iconId);
          (
            get() as AppState & {
              removeIconReferences?: (diagramId: string, iconId: string) => void;
            }
          ).removeIconReferences?.(diagramId, iconId);
        },
        updateIconName: (_diagramId, iconId, name) => {
          iconStore.getState().updateIconName(iconId, name);
        },
        incrementIconUsage: (_diagramId, iconId) => {
          iconStore.getState().incrementIconUsage(iconId);
        },
        decrementIconUsage: (_diagramId, iconId) => {
          iconStore.getState().decrementIconUsage(iconId);
        },
      })),
      createPersistConfig(storage, { onRehydrated, loadFreshWorkspace }),
    ),
  );
}

export const useDiagramStore = createDiagramStore(
  workspaceStorage,
  undefined,
  (error) => settleHydration(error),
  loadSeedWorkspace,
);

/**
 * Writes the workspace to the browser copy now (IndexedDB or localStorage,
 * whichever the boot chose), outside the debounce. `force` writes through
 * folder sync's pause. False when paused without `force`, or when the forced
 * write fails.
 */
export async function flushWorkspaceToBrowserStorageNow(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const payload = buildPersistStoragePayload(useDiagramStore.getState());

  if (workspaceStorage.paused && !options.force) {
    return false;
  }

  if (workspaceStorage.paused && options.force) {
    const ok = await workspaceStorage.forceSave(PERSIST_KEY, payload);
    if (ok) {
      recordLocalStorageDiagramSyncSuccess();
    }
    return ok;
  }

  const json = JSON.stringify({
    state: payload.state,
    version: payload.version,
  });
  await workspaceStorage.setItem(PERSIST_KEY, json);
  recordLocalStorageDiagramSyncSuccess();
  return true;
}

export function updateDiagramDescription(diagramId: string, description: string): void {
  useDiagramStore.getState().updateDiagramDescription(diagramId, description);
}

export function saveUserTemplate(template: UserTemplate): void {
  useDiagramStore.getState().saveUserTemplate(template);
}

export function updateUserTemplate(
  id: string,
  patch: Partial<Pick<UserTemplate, "name" | "description" | "category">>,
): void {
  useDiagramStore.getState().updateUserTemplate(id, patch);
}

export function deleteUserTemplate(id: string): void {
  useDiagramStore.getState().deleteUserTemplate(id);
}

const pickFromStore = createStableSlice<DiagramStore>();

const selectDiagramActions = pickFromStore([
  "addDiagram",
  "addImportedDiagram",
  "importDiagram",
  "duplicateDiagram",
  "openDiagram",
  "updateDiagram",
  "updateDiagramDescription",
  "setTextsVisible",
  "setShowLegend",
  "deleteDiagram",
  "addFolder",
  "renameFolder",
  "deleteFolder",
  "moveDiagram",
  "groupNodes",
  "ungroupNodes",
  "addComponent",
  "addComponentConnectedFrom",
  "addSharedRef",
  "routeConnectionThroughRef",
  "updateComponent",
  "batchUpdateComponents",
  "removeComponent",
  "removeElements",
  "updateHandleOrder",
  "addExternalLink",
  "updateExternalLink",
  "removeExternalLink",
  "addConnection",
  "updateConnection",
  "removeConnection",
  "swapConnectionDirection",
  "updateNodeLayout",
  "batchUpdateNodeLayouts",
  "updateViewport",
  "setEdgeControlPoints",
  "addEdgeControlPoint",
  "removeEdgeControlPoint",
  "resetEdgeControlPoints",
  "setEdgeLabelOffset",
  "bringToFront",
  "sendToBack",
  "setNodeZIndex",
  "alignNodes",
  "distributeNodes",
  "fitGroupToChildren",
  "applyAutoLayout",
  "addService",
  "updateService",
  "removeService",
  "linkComponentToService",
  "linkComponentToDiagram",
  "setParent",
  "batchCommitNodeDrag",
  "addFlow",
  "updateFlow",
  "removeFlow",
  "updateFlowStep",
  "beginFlowSession",
  "commitFlowSession",
  "cancelFlowSession",
  "recordFlowStep",
  "undoLastRecordedStep",
  "insertFlowStepAt",
  "moveFlowStep",
  "removeFlowSteps",
  "addFlowBranch",
  "removeFlowBranch",
  "setFlowBranchLabel",
  "convertStepToCondition",
  "insertPattern",
  "undo",
  "redo",
  "copyToClipboard",
  "pasteFromClipboard",
  "importDrawioResult",
  "importMermaidSequenceResult",
  "clearClipboard",
  "hydrateClipboard",
  "addVersion",
  "duplicateVersion",
  "removeVersion",
  "mergeVersionIntoBase",
  "setVersionStatus",
  "carryActiveVersionKey",
  "removeVersionByKey",
  "setActiveVersionByKey",
  "keepVersionCopy",
  "takeBaseVersion",
  "setActiveVersion",
  "setCompareVersion",
  "renameVersion",
  "addComponentToVersion",
  "removeComponentFromVersion",
  "addConnectionToVersion",
  "removeConnectionFromVersion",
  "updateVersionNodeLayout",
  "saveUserTemplate",
  "updateUserTemplate",
  "deleteUserTemplate",
]);

const selectComponentActions = pickFromStore([
  "addComponent",
  "addComponentConnectedFrom",
  "addSharedRef",
  "routeConnectionThroughRef",
  "updateComponent",
  "batchUpdateComponents",
  "removeComponent",
  "removeElements",
  "groupNodes",
  "ungroupNodes",
  "updateHandleOrder",
  "addExternalLink",
  "updateExternalLink",
  "removeExternalLink",
]);

const selectConnectionActions = pickFromStore([
  "addConnection",
  "updateConnection",
  "removeConnection",
  "swapConnectionDirection",
]);

const selectLayoutActions = pickFromStore([
  "updateNodeLayout",
  "batchUpdateNodeLayouts",
  "updateViewport",
  "setEdgeControlPoints",
  "addEdgeControlPoint",
  "removeEdgeControlPoint",
  "resetEdgeControlPoints",
  "setEdgeLabelOffset",
  "bringToFront",
  "sendToBack",
  "setNodeZIndex",
  "alignNodes",
  "distributeNodes",
  "fitGroupToChildren",
  "applyAutoLayout",
  "batchCommitNodeDrag",
  "setParent",
]);

const selectVersionActions = pickFromStore([
  "addVersion",
  "duplicateVersion",
  "removeVersion",
  "mergeVersionIntoBase",
  "setVersionStatus",
  "carryActiveVersionKey",
  "removeVersionByKey",
  "setActiveVersionByKey",
  "keepVersionCopy",
  "takeBaseVersion",
  "setActiveVersion",
  "setCompareVersion",
  "renameVersion",
  "addComponentToVersion",
  "removeComponentFromVersion",
  "addConnectionToVersion",
  "removeConnectionFromVersion",
  "updateVersionNodeLayout",
]);

const selectClipboardActions = pickFromStore([
  "copyToClipboard",
  "pasteFromClipboard",
  "clearClipboard",
  "hydrateClipboard",
]);

const selectIconActions = pickFromStore([
  "addIcon",
  "removeIcon",
  "updateIconName",
  "incrementIconUsage",
  "decrementIconUsage",
]);

const selectServiceActions = pickFromStore([
  "addService",
  "updateService",
  "removeService",
  "linkComponentToService",
]);

export const useDiagramActions = () => useDiagramStore(selectDiagramActions);

// --- Domain-scoped action hooks ---

export const useComponentActions = () => useDiagramStore(selectComponentActions);

export const useConnectionActions = () => useDiagramStore(selectConnectionActions);

export const useLayoutActions = () => useDiagramStore(selectLayoutActions);

export const useVersionActions = () => useDiagramStore(selectVersionActions);

export const useClipboardActions = () => useDiagramStore(selectClipboardActions);

export const useIconActions = () => useDiagramStore(selectIconActions);

export const useServiceActions = () => useDiagramStore(selectServiceActions);
