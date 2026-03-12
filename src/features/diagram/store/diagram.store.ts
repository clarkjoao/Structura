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
import { generateId } from "../model/diagram.utils";
import type { ServiceDefinition } from "@/features/registry";
import { SEED_DIAGRAMS, SEED_SERVICE_REGISTRY } from "@/fixtures/seed";
import type { AppState, DiagramSnapshot } from "./store.types";
import { activeDiagram as _activeDiagram } from "./store.types";
import { historySlice, pushHistory } from "./slices/history.slice";
import { componentsSlice } from "./slices/components.slice";
import { connectionsSlice } from "./slices/connections.slice";
import { flowsSlice } from "./slices/flows.slice";
import { layoutSlice } from "./slices/layout.slice";
import { servicesSlice } from "./slices/services.slice";
import { clipboardSlice } from "./slices/clipboard.slice";

export type { AppState, DiagramSnapshot };
export type { ClipboardEntry } from "./store.types";

// ── Store interface ────────────────────────────────────────────────────────

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
        diagrams: SEED_DIAGRAMS,
        folders: {},
        serviceRegistry: SEED_SERVICE_REGISTRY,
        activeDiagramId: null,
        past: [],
        future: [],
        _lastUndoRedoAt: 0,
        clipboard: null,

        ...componentsSlice(set),
        ...connectionsSlice(set),
        ...flowsSlice(set, get as () => AppState),
        ...layoutSlice(set),
        ...servicesSlice(set),
        ...clipboardSlice(set),
        ...historySlice(set),

      addDiagram: (name, level, domain, folderId) => {
        const diagram: Diagram = {
          id: generateId("d"),
          name,
          level,
          domain: domain || undefined,
          updatedAt: "agora",
          snapshot: { components: {}, connections: {}, flows: {} },
          nodeLayouts: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          folderId: folderId ?? undefined,
        };
        set((state) => { state.diagrams[diagram.id] = diagram; });
        return diagram;
      },

      addFolder: (name, parentId, domain) => {
        const folder: Folder = {
          id: generateId("folder"),
          name,
          parentId,
          domain: domain || undefined,
        };
        set((state) => { state.folders[folder.id] = folder; });
        return folder;
      },

      renameFolder: (id, name) => {
        set((state) => {
          const f = state.folders[id];
          if (f) f.name = name;
        });
      },

      deleteFolder: (id) => {
        set((state) => {
          const hasChildren = Object.values(state.folders).some((f) => f.parentId === id);
          const hasDiagrams = Object.values(state.diagrams).some((d) => d.folderId === id);
          if (hasChildren || hasDiagrams) return;
          delete state.folders[id];
        });
      },

      moveDiagram: (diagramId, folderId) => {
        set((state) => {
          const d = state.diagrams[diagramId];
          if (d) d.folderId = folderId ?? undefined;
        });
      },

      openDiagram: (id) => {
        set((state) => { state.activeDiagramId = id; });
      },

      deleteDiagram: (id) => {
        set((state) => {
          delete state.diagrams[id];
          if (state.activeDiagramId === id) state.activeDiagramId = null;
        });
      },

      insertPattern: (template, position) => {
        const GRID_X = 220;
        const ids: string[] = template.components.map(() => generateId("el"));
        set((state) => {
          pushHistory(state);
          const d = _activeDiagram(state);
          template.components.forEach((c: { name: string; type: ComponentType; description?: string; technology?: string; awsService?: string }, i: number) => {
            const comp: Component = {
              id: ids[i],
              name: c.name,
              type: c.type,
              description: c.description ?? "",
              parentId: null,
              technology: c.technology ?? undefined,
              awsService: c.awsService ?? undefined,
            };
            d.snapshot.components[comp.id] = comp;
            d.nodeLayouts.push({ elementId: comp.id, x: position.x + i * GRID_X, y: position.y });
          });
          template.connections.forEach((conn: { fromIndex: number; toIndex: number; label: string }) => {
            const connId = generateId("conn");
            d.snapshot.connections[connId] = {
              id: connId,
              sourceId: ids[conn.fromIndex],
              targetId: ids[conn.toIndex],
              label: conn.label,
            };
          });
          d.updatedAt = "agora";
        });
      },
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
          // Migrate (ETAPA 6): move loose connection style fields into style: {}
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
          // Migrate (ETAPA 7): move component width/height into nodeLayout
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

// ── Selectors ──────────────────────────────────────────────────────────────

export const useDiagrams = () => useDiagramStore((s) => s.diagrams);
export const useAllDiagrams = () =>
  useDiagramStore(useShallow((s) => Object.values(s.diagrams)));
export const useFolders = () => useDiagramStore((s) => s.folders);
export const useAllFolders = () =>
  useDiagramStore(useShallow((s) => Object.values(s.folders)));
export const useActiveDiagramId = () =>
  useDiagramStore((s) => s.activeDiagramId);

export const useActiveDiagram = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId] : null,
  );

export const useComponents = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.components : {},
  );

export const useComponent = (id: string) =>
  useDiagramStore((s) =>
    s.activeDiagramId
      ? s.diagrams[s.activeDiagramId].snapshot.components[id]
      : undefined,
  );

export const useConnections = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.connections : {},
  );

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(d.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(d.snapshot.components).filter((c) => visibleIds.has(c.id));
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(d.nodeLayouts.map((nl) => nl.elementId));
      return Object.values(d.snapshot.connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );

export const useCanNavigateInto = (_elementId: string) => false;

export const useServiceRegistry = () =>
  useDiagramStore(useShallow((s) => s.serviceRegistry));

export const useAllServices = () =>
  useDiagramStore(useShallow((s) => Object.values(s.serviceRegistry)));

export const useAllComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.components);
    }),
  );

export const useAllConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.connections);
    }),
  );

export const useFlows = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      return Object.values(s.diagrams[s.activeDiagramId].snapshot.flows);
    }),
  );

export const useAllComponentsAcrossDiagrams = () =>
  useDiagramStore(
    useShallow((s) =>
      Object.values(s.diagrams).flatMap((d) =>
        Object.values(d.snapshot.components).map((c) => ({ ...c, diagramId: d.id, diagramName: d.name })),
      ),
    ),
  );

// ── Action hooks ───────────────────────────────────────────────────────────

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
