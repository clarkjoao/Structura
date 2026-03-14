import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { defaultStorage } from "@/infrastructure/persistence";
import type {
  Component,
  ComponentPatch,
  Connection,
  Flow,
  FlowStep,
  Diagram,
  Folder,
  ComponentType,
  Level,
} from "../model/diagram.types";
import type { ServiceDefinition } from "./store.types";
import type { AppState, DiagramSnapshot } from "./store.types";
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
   patternsSlice 
} from "./slices";

export type { AppState, DiagramSnapshot };
export type { ClipboardEntry } from "./store.types";


interface AppActions {
  addDiagram: (name: string, level: Level, domain?: string, folderId?: string | null) => Diagram;
  openDiagram: (id: string) => void;
  deleteDiagram: (id: string) => void;
  addFolder: (name: string, parentId: string | null, domain?: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveDiagram: (diagramId: string, folderId: string | null) => void;

  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
    panelKind?: import("../model/diagram.types").PanelKind,
  ) => Component;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  updateHandleOrder: (componentId: string, side: "incoming" | "outgoing", orderedConnectionIds: string[]) => void;

  addConnection: (sourceId: string, targetId: string, label: string) => Connection;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  removeConnection: (id: string) => void;

  updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  bringToFront: (elementId: string) => void;
  sendToBack: (elementId: string) => void;

  addService: (service: Omit<ServiceDefinition, "id">) => ServiceDefinition;
  updateService: (id: string, patch: Partial<Omit<ServiceDefinition, "id">>) => void;
  removeService: (id: string) => void;
  linkComponentToService: (componentId: string, serviceId: string | undefined) => void;
  linkComponentToDiagram: (componentId: string, diagramId: string | undefined) => void;
  setParent: (childId: string, parentId: string | null) => void;
  groupNodes: (componentIds: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;

  addFlow: (diagramId: string, name: string, mermaid: string, steps?: FlowStep[]) => Flow;
  updateFlow: (id: string, patch: Partial<Omit<Flow, "id">>) => void;
  removeFlow: (id: string) => void;

  insertPattern: (
    template: import("@/lib/patterns-catalog").PatternTemplate,
    position: { x: number; y: number },
  ) => void;

  undo: () => void;
  redo: () => void;

  copyToClipboard: (componentIds: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => void;
  clearClipboard: () => void;
}

export type DiagramStore = AppState & AppActions;

// ── Store ──────────────────────────────────────────────────────────────────

const PERSIST_KEY = "diagram-store";

export function createDiagramStore(storage = defaultStorage) {
  return create<DiagramStore>()(
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
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        diagrams: state.diagrams,
        folders: state.folders,
        serviceRegistry: state.serviceRegistry,
        activeDiagramId: state.activeDiagramId,
        past: state.past,
        future: state.future,
        _lastUndoRedoAt: state._lastUndoRedoAt,
      }),
      merge: (persistedState, currentState) => {
        const state = {
          ...currentState,
          ...(persistedState && (persistedState as Partial<DiagramStore>)),
        };
        state.clipboard = currentState.clipboard ?? null;
        if (!state.serviceRegistry) state.serviceRegistry = {};
        Object.values(state.diagrams ?? {}).forEach((d) => {
          const diagram = d as Diagram;
          Object.values(diagram.snapshot.connections ?? {}).forEach((conn) => {
            type LegacyConn = Connection & { edgeStyle?: string; strokeStyle?: string; strokeWidth?: number; markerEnd?: string; markerStart?: string; animated?: boolean };
            const c = conn as LegacyConn;
            const hasLoose = c.edgeStyle !== undefined || c.strokeStyle !== undefined || c.strokeWidth !== undefined || c.markerEnd !== undefined || c.markerStart !== undefined || c.animated !== undefined;
            if (hasLoose) {
              (c as { style?: object }).style = { edgeStyle: c.edgeStyle, strokeStyle: c.strokeStyle, strokeWidth: c.strokeWidth, markerEnd: c.markerEnd, markerStart: c.markerStart, animated: c.animated, ...c.style };
              delete c.edgeStyle; delete c.strokeStyle; delete c.strokeWidth;
              delete c.markerEnd; delete c.markerStart; delete c.animated;
            }
          });
          Object.values(diagram.snapshot.components ?? {}).forEach((comp) => {
            type LegacyComp = Component & { width?: number; height?: number };
            const co = comp as LegacyComp;
            if (co.width !== undefined || co.height !== undefined) {
              const layout = diagram.nodeLayouts.find((nl) => nl.elementId === co.id);
              if (layout) {
                if (co.width !== undefined && layout.width === undefined) layout.width = co.width;
                if (co.height !== undefined && layout.height === undefined) layout.height = co.height;
              }
              delete co.width;
              delete co.height;
            }
          });
        });
        if (!state.folders) state.folders = {};
        return state;
      },
    },
  ),
);
}

export const useDiagramStore = createDiagramStore();

export const useDiagramActions = () =>
  useDiagramStore(
    useShallow((s) => ({
      addDiagram: s.addDiagram,
      openDiagram: s.openDiagram,
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