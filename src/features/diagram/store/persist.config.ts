import { createJSONStorage } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence";
import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";
import {
  clearLocalStorageDiagramSyncTimestamp,
  recordLocalStorageDiagramSyncSuccess,
} from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useIconStore } from "@/features/icons";
import type { Diagram, Component, Connection, IconDefinition, NodeLayout } from "../model/diagram.types";
import type { DiagramSnapshot, DiagramStore } from "./store.types";
import type { ServiceDefinition } from "../model/service.types";
import { ServiceSource } from "../enums";
import { migrateFlow } from "../utils/flow-migration";

export const PERSIST_KEY = "diagram-store";

/** Coalesce rapid Zustand persist writes — avoids main-thread JSON.stringify stalls on large diagrams. */
const PERSIST_DEBOUNCE_MS = 1000;

/** Must match `version` passed to zustand `persist` (used when writing localStorage manually). */
export const PERSIST_SCHEMA_VERSION = 4;

/** Alias for consumers that refer to “current” schema version in docs or tooling. */
export const CURRENT_SCHEMA_VERSION = PERSIST_SCHEMA_VERSION;

export type PersistedDiagramStoreSlice = ReturnType<typeof partializeState>;

export function partializeState(state: DiagramStore) {
  return {
    diagrams: state.diagrams,
    folders: state.folders,
    userTemplates: state.userTemplates,
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

/**
 * Idempotent: ensures `iconLibrary` exists and legacy components expose `customIconId`.
 * Used for persist rehydration and for schema upgrades from version &lt; 1.
 */
function migrateAddIconLibrary(state: Partial<DiagramStore>): void {
  const touchSnapshot = (snapshot: Diagram["snapshot"] | undefined): void => {
    if (!snapshot) return;
    if (!snapshot.iconLibrary) {
      snapshot.iconLibrary = {};
    }
    for (const component of Object.values(snapshot.components ?? {})) {
      if (!("customIconId" in component)) {
        (component as Component).customIconId = undefined;
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    touchSnapshot((diagram as Diagram).snapshot);
  }
  for (const entry of [...(state.past ?? []), ...(state.future ?? [])]) {
    touchSnapshot(entry.snapshot);
  }
}

/**
 * Idempotent: moves legacy top-level `svgContent` into `source: { kind: "svg", svgContent }`.
 */
function migrateAddEdgeLayouts(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const diagramRecord = diagram as Diagram;
    diagramRecord.edgeLayouts ??= [];
  }
}

function migrateAddDiagramDescription(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const diagramRecord = diagram as Diagram;
    diagramRecord.description ??= undefined;
  }
}

function migrateAddUserTemplates(state: Partial<DiagramStore>): void {
  state.userTemplates ??= {};
}

function migrateIconDefinitionToSource(state: Partial<DiagramStore>): void {
  const migrateLibrary = (library: Record<string, IconDefinition> | undefined): void => {
    if (!library) return;
    for (const [id, icon] of Object.entries(library)) {
      const entry = icon as unknown as Record<string, unknown>;
      if (
        typeof entry.svgContent === "string" &&
        entry.svgContent.length > 0 &&
        !("source" in entry)
      ) {
        const svgContent = entry.svgContent as string;
        library[id] = {
          id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : id,
          name: typeof entry.name === "string" ? entry.name : id,
          createdAt:
            typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
              ? entry.createdAt
              : Date.now(),
          usageCount:
            typeof entry.usageCount === "number" &&
            entry.usageCount >= 0 &&
            Number.isFinite(entry.usageCount)
              ? entry.usageCount
              : 0,
          source: { kind: "svg", svgContent },
        };
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    migrateLibrary((diagram as Diagram)?.snapshot?.iconLibrary);
  }
  for (const entry of [...(state.past ?? []), ...(state.future ?? [])]) {
    migrateLibrary(entry.snapshot?.iconLibrary);
  }
}

function migrateIconLibraryToGlobalStore(state: DiagramStore): void {
  try {
    const migrateSnapshot = (snapshot: Diagram["snapshot"] | undefined): void => {
      if (!snapshot) {
        return;
      }
      const library = snapshot.iconLibrary;
      if (!library || Object.keys(library).length === 0) {
        return;
      }
      const globalIcons = useIconStore.getState().icons;
      for (const [iconId, icon] of Object.entries(library)) {
        if (!globalIcons[iconId]) {
          useIconStore.getState().addIcon(icon);
        }
      }
      snapshot.iconLibrary = {};
    };

    for (const diagram of Object.values(state.diagrams ?? {})) {
      migrateSnapshot((diagram as Diagram).snapshot);
    }
    for (const entry of [...(state.past ?? []), ...(state.future ?? [])]) {
      migrateSnapshot((entry as DiagramSnapshot).snapshot);
    }
  } catch {
    // Store may not be ready; rehydration must not block.
  }
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
  migrateAddUserTemplates(state);

  let next = state;
  next = migrateServiceSources(next);
  next = migrateDiagramCreatedAt(next);
  next = migrateNodeLayoutsFromArray(next);
  next = migrateConnectionStyles(next);
  next = migrateComponentDimensions(next);
  next = migrateFlowsToGraph(next);
  migrateAddIconLibrary(next);
  migrateIconDefinitionToSource(next);
  migrateAddEdgeLayouts(next);
  migrateAddDiagramDescription(next);
  migrateIconLibraryToGlobalStore(next);

  return next;
}

const SCHEMA_VERSION_WITH_ICON_LIBRARY = 1;
const SCHEMA_VERSION_ICON_SOURCE = 2;
const SCHEMA_VERSION_EDGE_LAYOUTS = 3;
const SCHEMA_VERSION_DIAGRAM_DESCRIPTION = 3;
const SCHEMA_VERSION_USER_TEMPLATES = 4;

/**
 * Wraps the diagram persist storage so each successful write of `PERSIST_KEY`
 * updates `structura:lastLocalStorageSync` (and matching window event).
 */
export function wrapIStoragePortWithDiagramPersistTracking(
  storage: IStoragePort,
): IStoragePort {
  let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPersist: { name: string; value: string } | null = null;

  const flushPersist = async (): Promise<void> => {
    persistDebounceTimer = null;
    if (!pendingPersist) return;
    const { name, value } = pendingPersist;
    pendingPersist = null;
    await storage.setItem(name, value);
    if (name !== PERSIST_KEY) return;
    if (storage instanceof LocalStorageAdapter && storage.paused) return;
    recordLocalStorageDiagramSyncSuccess();
  };

  const schedulePersist = (name: string, value: string): void => {
    pendingPersist = { name, value };
    if (persistDebounceTimer !== null) {
      clearTimeout(persistDebounceTimer);
    }
    persistDebounceTimer = setTimeout(() => {
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (persistDebounceTimer !== null) {
        clearTimeout(persistDebounceTimer);
        persistDebounceTimer = null;
      }
      if (!pendingPersist || pendingPersist.name !== PERSIST_KEY) return;
      const { name, value } = pendingPersist;
      pendingPersist = null;
      void storage.setItem(name, value);
      if (storage instanceof LocalStorageAdapter && storage.paused) return;
      recordLocalStorageDiagramSyncSuccess();
    });
  }

  return {
    getItem: (key) => storage.getItem(key),
    setItem: async (name, value) => {
      if (name !== PERSIST_KEY) {
        await storage.setItem(name, value);
        return;
      }
      schedulePersist(name, value);
    },
    removeItem: async (key) => {
      if (key === PERSIST_KEY) {
        if (persistDebounceTimer !== null) {
          clearTimeout(persistDebounceTimer);
          persistDebounceTimer = null;
        }
        pendingPersist = null;
      }
      await storage.removeItem(key);
      if (key === PERSIST_KEY) {
        clearLocalStorageDiagramSyncTimestamp();
      }
    },
    save: (key, data) => storage.save(key, data),
    load: (key) => storage.load(key),
    delete: async (key) => {
      if (key === PERSIST_KEY) {
        if (persistDebounceTimer !== null) {
          clearTimeout(persistDebounceTimer);
          persistDebounceTimer = null;
        }
        pendingPersist = null;
      }
      await storage.delete(key);
      if (key === PERSIST_KEY) {
        clearLocalStorageDiagramSyncTimestamp();
      }
    },
  };
}

export function createPersistConfig(storage: IStoragePort) {
  const trackedStorage = wrapIStoragePortWithDiagramPersistTracking(storage);
  return {
    name: PERSIST_KEY,
    storage: createJSONStorage(() => trackedStorage),
    partialize: partializeState,
    merge: mergePersistedState,
    version: PERSIST_SCHEMA_VERSION,
    migrate: (persistedState, fromVersion) => {
      if (typeof fromVersion !== "number") {
        return persistedState as PersistedDiagramStoreSlice;
      }
      const partial = persistedState as Partial<DiagramStore>;
      if (fromVersion < SCHEMA_VERSION_WITH_ICON_LIBRARY) {
        migrateAddIconLibrary(partial);
      }
      if (fromVersion < SCHEMA_VERSION_ICON_SOURCE) {
        migrateIconDefinitionToSource(partial);
      }
      if (fromVersion < SCHEMA_VERSION_EDGE_LAYOUTS) {
        migrateAddEdgeLayouts(partial);
      }
      if (fromVersion < SCHEMA_VERSION_DIAGRAM_DESCRIPTION) {
        migrateAddDiagramDescription(partial);
      }
      if (fromVersion < SCHEMA_VERSION_USER_TEMPLATES) {
        migrateAddUserTemplates(partial);
      }
      return persistedState as PersistedDiagramStoreSlice;
    },
  };
}
