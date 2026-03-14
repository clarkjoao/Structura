import { createJSONStorage } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence";
import type { Diagram, Component, Connection } from "../model/diagram.types";
import type { DiagramStore } from "./store.types";

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
        const layout = diagram.nodeLayouts.find((nl) => nl.elementId === co.id);
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
