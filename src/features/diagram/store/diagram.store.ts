import { create } from "zustand";
import type { StoreApi } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { defaultStorage, type IStoragePort } from "@/infrastructure/persistence";
import { recordLocalStorageDiagramSyncSuccess } from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useIconStore, type IconStore } from "@/features/icons";
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
  scenesSlice,
  iconsSlice,
  userTemplatesSlice,
} from "./slices";
import { buildPersistStoragePayload, createPersistConfig, PERSIST_KEY } from "./persist.config";

export type { AppState, DiagramSnapshot } from "./store.types";
export type { ClipboardEntry, DiagramStore } from "./store.types";

export function createDiagramStore(
  storage: IStoragePort = defaultStorage,
  iconStoreOverride?: Pick<StoreApi<IconStore>, "getState">,
) {
  const iconStore = iconStoreOverride ?? useIconStore;
  return create<import("./store.types").DiagramStore>()(
    persist(
      immer((set, get) => ({
        past: [] as DiagramSnapshot[],
        future: [] as DiagramSnapshot[],
        _lastUndoRedoAt: 0,
        _flowSession: null as { undoMark: number | null } | null,
        _flowSewNotices: null as AppState["_flowSewNotices"],
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
        ...scenesSlice(set, get as () => AppState),
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
      createPersistConfig(storage),
    ),
  );
}

export const useDiagramStore = createDiagramStore();

export async function flushDiagramStoreToLocalStorageNow(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const payload = buildPersistStoragePayload(useDiagramStore.getState());

  if (defaultStorage.paused && !options.force) {
    return false;
  }

  if (defaultStorage.paused && options.force) {
    const ok = await defaultStorage.forceSave(PERSIST_KEY, payload);
    if (ok) {
      recordLocalStorageDiagramSyncSuccess();
    }
    return ok;
  }

  const json = JSON.stringify({
    state: payload.state,
    version: payload.version,
  });
  await defaultStorage.setItem(PERSIST_KEY, json);
  recordLocalStorageDiagramSyncSuccess();
  return true;
}

/**
 * Best-effort synchronous persist on tab close. Uses the same semantics as
 * {@link flushDiagramStoreToLocalStorageNow} with `{ force: true }` when folder sync pauses local writes.
 */
export function flushDiagramStoreToLocalStorageBeforeUnloadSync(): void {
  const payload = buildPersistStoragePayload(useDiagramStore.getState());

  if (defaultStorage.paused) {
    const ok = defaultStorage.forceSaveSync(PERSIST_KEY, payload);
    if (ok) {
      recordLocalStorageDiagramSyncSuccess();
    }
    return;
  }

  const json = JSON.stringify({
    state: payload.state,
    version: payload.version,
  });
  defaultStorage.setItemSync(PERSIST_KEY, json);
  recordLocalStorageDiagramSyncSuccess();
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
  "deleteDiagram",
  "addFolder",
  "renameFolder",
  "deleteFolder",
  "moveDiagram",
  "groupNodes",
  "ungroupNodes",
  "addComponent",
  "updateComponent",
  "removeComponent",
  "removeElements",
  "updateHandleOrder",
  "addExternalLink",
  "updateExternalLink",
  "removeExternalLink",
  "addConnection",
  "updateConnection",
  "removeConnection",
  "updateNodeLayout",
  "updateViewport",
  "setEdgeControlPoints",
  "addEdgeControlPoint",
  "removeEdgeControlPoint",
  "resetEdgeControlPoints",
  "setEdgeLabelOffset",
  "bringToFront",
  "sendToBack",
  "fitGroupToChildren",
  "applyAutoLayout",
  "addService",
  "updateService",
  "removeService",
  "linkComponentToService",
  "linkComponentToDiagram",
  "setParent",
  "commitNodeDrag",
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
  "addScene",
  "duplicateScene",
  "removeScene",
  "mergeSceneIntoBase",
  "setActiveScene",
  "setCompareScene",
  "renameScene",
  "addComponentToScene",
  "removeComponentFromScene",
  "addConnectionToScene",
  "removeConnectionFromScene",
  "updateSceneNodeLayout",
  "saveUserTemplate",
  "updateUserTemplate",
  "deleteUserTemplate",
]);

const selectComponentActions = pickFromStore([
  "addComponent",
  "updateComponent",
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
]);

const selectLayoutActions = pickFromStore([
  "updateNodeLayout",
  "updateViewport",
  "setEdgeControlPoints",
  "addEdgeControlPoint",
  "removeEdgeControlPoint",
  "resetEdgeControlPoints",
  "setEdgeLabelOffset",
  "bringToFront",
  "sendToBack",
  "fitGroupToChildren",
  "applyAutoLayout",
  "commitNodeDrag",
  "batchCommitNodeDrag",
  "setParent",
]);

const selectSceneActions = pickFromStore([
  "addScene",
  "duplicateScene",
  "removeScene",
  "mergeSceneIntoBase",
  "setActiveScene",
  "setCompareScene",
  "renameScene",
  "addComponentToScene",
  "removeComponentFromScene",
  "addConnectionToScene",
  "removeConnectionFromScene",
  "updateSceneNodeLayout",
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

const selectCatalogActions = pickFromStore([
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

export const useSceneActions = () => useDiagramStore(selectSceneActions);

export const useClipboardActions = () => useDiagramStore(selectClipboardActions);

export const useIconActions = () => useDiagramStore(selectIconActions);

export const useCatalogActions = () => useDiagramStore(selectCatalogActions);
