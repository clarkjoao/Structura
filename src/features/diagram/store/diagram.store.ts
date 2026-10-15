import { create } from "zustand";
import type { StoreApi } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence/IStoragePort";
import { useIconStore, type IconStore } from "./icon-store";
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
import { createPersistConfig } from "./persist.config";

export type { AppState, DiagramSnapshot } from "./store.types";
export type { ClipboardEntry, DiagramStore } from "./store.types";

export function createDiagramStore(
  storage: IStoragePort,
  iconStoreOverride?: Pick<StoreApi<IconStore>, "getState">,
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
      createPersistConfig(storage),
    ),
  );
}

const pickFromStore = createStableSlice<DiagramStore>();

export const selectDiagramActions = pickFromStore([
  "addDiagram",
  "addImportedDiagram",
  "importDiagram",
  "duplicateDiagram",
  "openDiagram",
  "updateDiagram",
  "updateDiagramDescription",
  "setTextsVisible",
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
  "batchUpdateNodeLayouts",
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

export const selectComponentActions = pickFromStore([
  "addComponent",
  "addComponentConnectedFrom",
  "addSharedRef",
  "routeConnectionThroughRef",
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

export const selectConnectionActions = pickFromStore([
  "addConnection",
  "updateConnection",
  "removeConnection",
]);

export const selectLayoutActions = pickFromStore([
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
  "fitGroupToChildren",
  "applyAutoLayout",
  "batchCommitNodeDrag",
  "setParent",
]);

export const selectVersionActions = pickFromStore([
  "addVersion",
  "duplicateVersion",
  "removeVersion",
  "mergeVersionIntoBase",
  "setActiveVersion",
  "setCompareVersion",
  "renameVersion",
  "addComponentToVersion",
  "removeComponentFromVersion",
  "addConnectionToVersion",
  "removeConnectionFromVersion",
  "updateVersionNodeLayout",
]);

export const selectClipboardActions = pickFromStore([
  "copyToClipboard",
  "pasteFromClipboard",
  "clearClipboard",
  "hydrateClipboard",
]);

export const selectIconActions = pickFromStore([
  "addIcon",
  "removeIcon",
  "updateIconName",
  "incrementIconUsage",
  "decrementIconUsage",
]);

export const selectServiceActions = pickFromStore([
  "addService",
  "updateService",
  "removeService",
  "linkComponentToService",
]);
