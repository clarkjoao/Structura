import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { defaultStorage } from "@/infrastructure/persistence";
import type { AppState } from "./store.types";
import {
  historySlice,
  componentsSlice,
  connectionsSlice,
  flowsSlice,
  layoutSlice,
  servicesSlice,
  clipboardSlice,
  diagramsSlice,
  foldersSlice,
  patternsSlice,
} from "./slices";
import { createPersistConfig } from "./persist.config";

export type { AppState, DiagramSnapshot } from "./store.types";
export type { ClipboardEntry, DiagramStore } from "./store.types";

export function createDiagramStore(storage = defaultStorage) {
  return create<import("./store.types").DiagramStore>()(
    persist(
      immer((set, get) => ({
        past: [],
        future: [],
        _lastUndoRedoAt: 0,
        ...diagramsSlice(set, get as () => AppState),
        ...componentsSlice(set, get as () => AppState),
        ...connectionsSlice(set, get as () => AppState),
        ...flowsSlice(set, get as () => AppState),
        ...layoutSlice(set, get as () => AppState),
        ...servicesSlice(set, get as () => AppState),
        ...clipboardSlice(set, get as () => AppState),
        ...historySlice(set, get as () => AppState),
        ...foldersSlice(set, get as () => AppState),
        ...patternsSlice(set, get as () => AppState),
      })),
      createPersistConfig(storage),
    ),
  );
}

export const useDiagramStore = createDiagramStore();

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addDiagram: s.addDiagram,
      openDiagram: s.openDiagram,
      updateDiagram: s.updateDiagram,
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
      addConnection: s.addConnection,
      updateConnection: s.updateConnection,
      removeConnection: s.removeConnection,
      updateNodeLayout: s.updateNodeLayout,
      updateViewport: s.updateViewport,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
      addService: s.addService,
      updateService: s.updateService,
      removeService: s.removeService,
      linkComponentToService: s.linkComponentToService,
      linkComponentToDiagram: s.linkComponentToDiagram,
      setParent: s.setParent,
      addFlow: s.addFlow,
      updateFlow: s.updateFlow,
      removeFlow: s.removeFlow,
      insertPattern: s.insertPattern,
      undo: s.undo,
      redo: s.redo,
      copyToClipboard: s.copyToClipboard,
      pasteFromClipboard: s.pasteFromClipboard,
      clearClipboard: s.clearClipboard,
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