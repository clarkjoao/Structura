import { create } from "zustand";
import type { StoreApi } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { defaultStorage, type IStoragePort } from "@/infrastructure/persistence";
import { recordLocalStorageDiagramSyncSuccess } from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useIconStore, type IconStore } from "@/features/icons";
import type { UserTemplate } from "../model/diagram.types";
import type { AppState } from "./store.types";
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
  scenesSlice,
  iconsSlice,
  userTemplatesSlice,
} from "./slices";
import {
  buildPersistStoragePayload,
  createPersistConfig,
  PERSIST_KEY,
} from "./persist.config";

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
        past: [],
        future: [],
        _lastUndoRedoAt: 0,
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
        ...scenesSlice(set, get as () => AppState),
        ...iconsSlice(set, get as () => AppState),
        ...userTemplatesSlice(set, get as () => AppState),
        addIcon: (_diagramId, icon) => {
          iconStore.getState().addIcon(icon);
        },
        removeIcon: (diagramId, iconId) => {
          iconStore.getState().removeIcon(iconId);
          (get() as AppState & { removeIconReferences?: (diagramId: string, iconId: string) => void })
            .removeIconReferences?.(diagramId, iconId);
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

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushDiagramStoreToLocalStorageBeforeUnloadSync();
  });
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

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addDiagram: s.addDiagram,
      addImportedDiagram: s.addImportedDiagram,
      importDiagram: s.importDiagram,
      duplicateDiagram: s.duplicateDiagram,
      openDiagram: s.openDiagram,
      updateDiagram: s.updateDiagram,
      updateDiagramDescription: s.updateDiagramDescription,
      deleteDiagram: s.deleteDiagram,
      addFolder: s.addFolder,
      renameFolder: s.renameFolder,
      deleteFolder: s.deleteFolder,
      moveDiagram: s.moveDiagram,
      groupNodes: s.groupNodes,
      ungroupNodes: s.ungroupNodes,
      addComponent: s.addComponent,
      updateComponent: s.updateComponent,
      removeComponent: s.removeComponent,
      updateHandleOrder: s.updateHandleOrder,
      addExternalLink: s.addExternalLink,
      updateExternalLink: s.updateExternalLink,
      removeExternalLink: s.removeExternalLink,
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
      updateNodeLayout: s.updateNodeLayout,
      updateViewport: s.updateViewport,
      updateEdgeWaypoints: s.updateEdgeWaypoints,
      clearEdgeWaypoints: s.clearEdgeWaypoints,
      updateEdgeLabelOffset: s.updateEdgeLabelOffset,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      fitGroupToChildren: s.fitGroupToChildren,
      applyAutoLayout: s.applyAutoLayout,
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
      linkComponentToDiagram: s.linkComponentToDiagram,
      setParent: s.setParent,
      commitNodeDrag: s.commitNodeDrag,
      batchCommitNodeDrag: s.batchCommitNodeDrag,
      addFlow: s.addFlow,
      updateFlow: s.updateFlow,
      removeFlow: s.removeFlow,
      addFlowStep: s.addFlowStep,
      updateFlowStep: s.updateFlowStep,
      removeFlowStep: s.removeFlowStep,
      addFlowBranch: s.addFlowBranch,
      removeFlowBranch: s.removeFlowBranch,
      convertStepToCondition: s.convertStepToCondition,
      insertPattern: s.insertPattern,
      undo: s.undo,
      redo: s.redo,
      copyToClipboard: s.copyToClipboard,
      pasteFromClipboard: s.pasteFromClipboard,
      importDrawioResult: s.importDrawioResult,
      importMermaidSequenceResult: s.importMermaidSequenceResult,
      clearClipboard: s.clearClipboard,
      addScene: s.addScene,
      duplicateScene: s.duplicateScene,
      removeScene: s.removeScene,
      mergeSceneIntoBase: s.mergeSceneIntoBase,
      setActiveScene: s.setActiveScene,
      setCompareScene: s.setCompareScene,
      renameScene: s.renameScene,
      addComponentToScene: s.addComponentToScene,
      removeComponentFromScene: s.removeComponentFromScene,
      addConnectionToScene: s.addConnectionToScene,
      removeConnectionFromScene: s.removeConnectionFromScene,
      updateSceneNodeLayout: s.updateSceneNodeLayout,
      saveUserTemplate: s.saveUserTemplate,
      updateUserTemplate: s.updateUserTemplate,
      deleteUserTemplate: s.deleteUserTemplate,
    })),
  );

// --- Hooks focados por domínio ---

export const useComponentActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addComponent: s.addComponent,
      updateComponent: s.updateComponent,
      removeComponent: s.removeComponent,
      groupNodes: s.groupNodes,
      ungroupNodes: s.ungroupNodes,
      updateHandleOrder: s.updateHandleOrder,
      addExternalLink: s.addExternalLink,
      updateExternalLink: s.updateExternalLink,
      removeExternalLink: s.removeExternalLink,
    })),
  );

export const useConnectionActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
    })),
  );

export const useLayoutActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      updateNodeLayout: s.updateNodeLayout,
      updateViewport: s.updateViewport,
      updateEdgeWaypoints: s.updateEdgeWaypoints,
      clearEdgeWaypoints: s.clearEdgeWaypoints,
      updateEdgeLabelOffset: s.updateEdgeLabelOffset,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      fitGroupToChildren: s.fitGroupToChildren,
      applyAutoLayout: s.applyAutoLayout,
      commitNodeDrag: s.commitNodeDrag,
      batchCommitNodeDrag: s.batchCommitNodeDrag,
      setParent: s.setParent,
    })),
  );

export const useSceneActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addScene: s.addScene,
      duplicateScene: s.duplicateScene,
      removeScene: s.removeScene,
      mergeSceneIntoBase: s.mergeSceneIntoBase,
      setActiveScene: s.setActiveScene,
      setCompareScene: s.setCompareScene,
      renameScene: s.renameScene,
      addComponentToScene: s.addComponentToScene,
      removeComponentFromScene: s.removeComponentFromScene,
      addConnectionToScene: s.addConnectionToScene,
      removeConnectionFromScene: s.removeConnectionFromScene,
      updateSceneNodeLayout: s.updateSceneNodeLayout,
    })),
  );

export const useFlowActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addFlow: s.addFlow,
      updateFlow: s.updateFlow,
      removeFlow: s.removeFlow,
      addFlowStep: s.addFlowStep,
      updateFlowStep: s.updateFlowStep,
      removeFlowStep: s.removeFlowStep,
      addFlowBranch: s.addFlowBranch,
      removeFlowBranch: s.removeFlowBranch,
      convertStepToCondition: s.convertStepToCondition,
    })),
  );

export const useHistoryActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
    })),
  );

export const useClipboardActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      copyToClipboard: s.copyToClipboard,
      pasteFromClipboard: s.pasteFromClipboard,
      clearClipboard: s.clearClipboard,
    })),
  );

export const useIconActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addIcon: s.addIcon,
      removeIcon: s.removeIcon,
      updateIconName: s.updateIconName,
      incrementIconUsage: s.incrementIconUsage,
      decrementIconUsage: s.decrementIconUsage,
    })),
  );

export const useRegistryActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
    })),
  );
