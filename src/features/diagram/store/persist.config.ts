import { createJSONStorage } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence";
import type { Diagram, Component, Connection, NodeLayout } from "../model/diagram.types";
import type { DiagramStore } from "./store.types";
import type { ServiceDefinition } from "../model/service.types";
import { ServiceSource } from "../enums";
import { migrateFlow } from "../utils/flow-migration";

export const PERSIST_KEY = "diagram-store";

/** Must match `version` passed to zustand `persist` (used when writing localStorage manually). */
export const PERSIST_SCHEMA_VERSION = 0;

export type PersistedDiagramStoreSlice = ReturnType<typeof partializeState>;

export function partializeState(state: DiagramStore) {
  return {
    diagrams: state.diagrams,
    folders: state.folders,
    serviceRegistry: state.serviceRegistry,
    activeDiagramId: state.activeDiagramId,
    past: state.past,
    future: state.future,
    _lastUndoRedoAt: state._lastUndoRedoAt,
  };
}

/** Same shape zustand `persist` writes via `setItem` — required for rehydration after `forceSave`. */
export function buildPersistStoragePayload(state: DiagramStore): {
  state: PersistedDiagramStoreSlice;
  version: number;
} {
  return {
    state: partializeState(state),
    version: PERSIST_SCHEMA_VERSION,
  };
}

function migrateServiceSources(state: DiagramStore): DiagramStore {
  Object.values(state.serviceRegistry).forEach((service) => {
    const svc = service as ServiceDefinition;
    if (svc.sources && svc.sources.length > 0) return;
    if (svc.source) {
      svc.sources = [{ type: svc.source, sourceId: svc.sourceId }];
      return;
    }
    svc.sources = [{ type: ServiceSource.Manual }];
  });
  return state;
}

function migrateDiagramCreatedAt(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram & { createdAt?: string };
    if (!diagram.createdAt) diagram.createdAt = diagram.updatedAt;
  });
  return state;
}

function migrateNodeLayoutsFromArray(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram & { nodeLayouts: unknown };
    if (Array.isArray(diagram.nodeLayouts)) {
      const arr = diagram.nodeLayouts as NodeLayout[];
      (diagram as Diagram).nodeLayouts = Object.fromEntries(arr.map((nl) => [nl.elementId, nl]));
    }
  });
  [...(state.past ?? []), ...(state.future ?? [])].forEach((entry) => {
    if (Array.isArray(entry.nodeLayouts)) {
      const arr = entry.nodeLayouts as NodeLayout[];
      (entry as typeof entry & { nodeLayouts: unknown }).nodeLayouts = Object.fromEntries(
        arr.map((nl) => [nl.elementId, nl]),
      );
    }
  });
  return state;
}

function migrateConnectionStyles(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    Object.values(diagram.snapshot.connections ?? {}).forEach((conn) => {
      type LegacyConn = Connection & {
        edgeStyle?: string;
        strokeStyle?: string;
        strokeWidth?: number;
        markerEnd?: string;
        markerStart?: string;
        animated?: boolean;
      };
      const c = conn as LegacyConn;
      const hasLoose =
        c.edgeStyle !== undefined ||
        c.strokeStyle !== undefined ||
        c.strokeWidth !== undefined ||
        c.markerEnd !== undefined ||
        c.markerStart !== undefined ||
        c.animated !== undefined;
      if (hasLoose) {
        (c as { style?: object }).style = {
          edgeStyle: c.edgeStyle,
          strokeStyle: c.strokeStyle,
          strokeWidth: c.strokeWidth,
          markerEnd: c.markerEnd,
          markerStart: c.markerStart,
          animated: c.animated,
          ...c.style,
        };
        delete c.edgeStyle;
        delete c.strokeStyle;
        delete c.strokeWidth;
        delete c.markerEnd;
        delete c.markerStart;
        delete c.animated;
      }
    });
  });
  return state;
}

function migrateComponentDimensions(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    Object.values(diagram.snapshot.components ?? {}).forEach((comp) => {
      type LegacyComp = Component & { width?: number; height?: number };
      const co = comp as LegacyComp;
      if (co.width !== undefined || co.height !== undefined) {
        const layout = diagram.nodeLayouts[co.id];
        if (layout) {
          if (co.width !== undefined && layout.width === undefined) layout.width = co.width;
          if (co.height !== undefined && layout.height === undefined) layout.height = co.height;
        }
        delete co.width;
        delete co.height;
      }
    });
  });
  return state;
}

function migrateFlowsToGraph(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    if (diagram.snapshot?.flows) {
      for (const flowId of Object.keys(diagram.snapshot.flows)) {
        diagram.snapshot.flows[flowId] = migrateFlow(diagram.snapshot.flows[flowId]);
      }
    }
  });
  return state;
}

export function mergePersistedState(
  persistedState: unknown,
  currentState: DiagramStore,
): DiagramStore {
  const state = {
    ...currentState,
    ...(persistedState && (persistedState as Partial<DiagramStore>)),
  } as DiagramStore;

  state.clipboard = currentState.clipboard ?? null;

  if (!state.serviceRegistry) state.serviceRegistry = {};
  if (!state.folders) state.folders = {};

  let next = state;
  next = migrateServiceSources(next);
  next = migrateDiagramCreatedAt(next);
  next = migrateNodeLayoutsFromArray(next);
  next = migrateConnectionStyles(next);
  next = migrateComponentDimensions(next);
  next = migrateFlowsToGraph(next);

  return next;
}

export function createPersistConfig(storage: IStoragePort) {
  return {
    name: PERSIST_KEY,
    storage: createJSONStorage(() => storage),
    partialize: partializeState,
    merge: mergePersistedState,
    version: PERSIST_SCHEMA_VERSION,
  };
}
