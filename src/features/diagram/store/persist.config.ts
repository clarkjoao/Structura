import { createJSONStorage } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence";
import type { Diagram, Component, Connection, NodeLayout } from "../model/diagram.types";
import type { DiagramStore } from "./store.types";
import type { ServiceDefinition } from "../model/service.types";
import { ServiceSource } from "../enums";

export const PERSIST_KEY = "diagram-store";

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

  // Migrate legacy service.source/sourceId into service.sources[]
  Object.values(state.serviceRegistry).forEach((service) => {
    const svc = service as ServiceDefinition;
    if (svc.sources && svc.sources.length > 0) return;
    if (svc.source) {
      svc.sources = [{ type: svc.source, sourceId: svc.sourceId }];
      return;
    }
    svc.sources = [{ type: ServiceSource.Manual }];
  });

  // Migrate diagrams missing createdAt
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram & { createdAt?: string };
    if (!diagram.createdAt) diagram.createdAt = diagram.updatedAt;
  });

  // Migrate nodeLayouts from legacy array format to Record<string, NodeLayout>
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
      (entry as typeof entry & { nodeLayouts: unknown }).nodeLayouts = Object.fromEntries(arr.map((nl) => [nl.elementId, nl]));
    }
  });

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
    Object.values(diagram.snapshot.components ?? {}).forEach((comp) => {
      type LegacyComp = Component & { width?: number; height?: number };
      const co = comp as LegacyComp;
      if (co.width !== undefined || co.height !== undefined) {
        const layout = diagram.nodeLayouts[co.id];
        if (layout) {
          if (co.width !== undefined && layout.width === undefined)
            layout.width = co.width;
          if (co.height !== undefined && layout.height === undefined)
            layout.height = co.height;
        }
        delete co.width;
        delete co.height;
      }
    });
  });

  return state;
}

export function createPersistConfig(storage: IStoragePort) {
  return {
    name: PERSIST_KEY,
    storage: createJSONStorage(() => storage),
    partialize: partializeState,
    merge: mergePersistedState,
  };
}
